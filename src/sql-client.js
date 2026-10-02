/**
 * Bind tinyDatagrid to a host SQL client without assuming a driver or SQL dialect.
 * The host remains responsible for query parameter binding and transactions.
 */
export class SQLClientAdapter {
  constructor(
    grid,
    client,
    { autoPage = false, autoPageThreshold = 240, pageSize } = {},
  ) {
    if (!grid || typeof grid.loadResultSet !== "function")
      throw new TypeError("SQLClientAdapter requires a tinyDatagrid instance");
    if (!client || typeof client.query !== "function")
      throw new TypeError(
        "SQL client must provide query({ sql, params, signal, cursor })",
      );
    this.grid = grid;
    this.client = client;
    this.state = "idle";
    this.listeners = new Map();
    this._request = 0;
    this._queryController = null;
    this._queryWasReadOnly = null;
    this._queryPreviousQuery = null;
    this._saveController = null;
    this._saveWasReadOnly = null;
    this._lastQuery = null;
    this._destroyed = false;
    this.autoPage = Boolean(autoPage);
    this.autoPageThreshold = Math.max(0, Number(autoPageThreshold) || 0);
    this.pageSize =
      Number.isInteger(pageSize) && pageSize > 0 ? pageSize : undefined;
    this._gridUnsubscribers = [
      grid.on("sort", (detail) =>
        this._emit("sortRequest", {
          ...detail,
          requiresServerQuery: this._isServerPaged(),
        }),
      ),
      grid.on("filter", (detail) =>
        this._emit("filterRequest", {
          ...detail,
          requiresServerQuery: this._isServerPaged(),
        }),
      ),
      grid.on("scroll", (detail) => this._maybeAutoPage(detail.remaining)),
    ];
  }

  _maybeAutoPage(
    remaining = this.grid.scroll?.scrollHeight -
      this.grid.scroll?.scrollTop -
      this.grid.scroll?.clientHeight,
  ) {
    if (
      this.autoPage &&
      remaining <= this.autoPageThreshold &&
      !this._queryController &&
      this.grid.getSQLMetadata()?.hasMore
    ) {
      this.loadNextPage().catch(() => {});
    }
  }

  _isServerPaged() {
    const metadata = this.grid.getSQLMetadata();
    return Boolean(
      metadata &&
      (metadata.hasMore || metadata.fetchedRows < metadata.totalRows),
    );
  }

  on(type, listener) {
    if (typeof listener !== "function")
      throw new TypeError("Listener must be a function");
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
    return () => listeners.delete(listener);
  }

  _emit(type, detail) {
    const errors = [];
    for (const listener of this.listeners.get(type) || []) {
      try {
        listener(detail);
      } catch (error) {
        errors.push(error);
      }
    }
    if (type !== "listenerError")
      for (const error of errors)
        for (const listener of this.listeners.get("listenerError") || []) {
          try {
            listener({ sourceType: type, error });
          } catch {}
        }
  }

  _setState(state, detail = {}) {
    this.state = state;
    this._emit("state", { state, ...detail });
  }

  async query(sql, params = [], options = {}) {
    if (this._destroyed) throw new Error("SQL adapter has been destroyed");
    if (this._saveController)
      throw new Error(
        "Wait for the current database save to finish before running another query",
      );
    if (typeof sql !== "string" || !sql.trim())
      throw new TypeError("A non-empty SQL statement is required");
    this.cancelQuery();
    this.grid.commitEdit?.();
    const pending = this.grid.getDataChanges?.();
    const hasChanges =
      pending && Object.values(pending).some((items) => items.length);
    if (hasChanges && !options.discardChanges)
      throw new Error(
        "Save or explicitly discard pending grid changes before running another query",
      );
    const request = ++this._request;
    const controller = new AbortController();
    this._queryController = controller;
    this._queryWasReadOnly = this.grid.readOnly;
    if (!this.grid.readOnly) this.grid.setReadOnly(true);
    if (options.signal) {
      if (options.signal.aborted) controller.abort(options.signal.reason);
      else
        options.signal.addEventListener(
          "abort",
          () => controller.abort(options.signal.reason),
          { once: true },
        );
    }
    this._queryPreviousQuery = this._lastQuery;
    const pageSize =
      Number.isInteger(options.pageSize) && options.pageSize > 0
        ? options.pageSize
        : this.pageSize;
    this._lastQuery = {
      sql,
      params,
      context: options.context,
      pageSize,
      resultOptions: options.resultOptions || {},
    };
    this._setState("loading");
    this._emit("queryStart", { sql, params });
    try {
      const result = await this.client.query({
        sql,
        params,
        signal: controller.signal,
        context: options.context,
        pageSize,
      });
      if (request !== this._request) return null;
      if (controller.signal.aborted) {
        this._setState("idle");
        this._emit("queryCancelled", {});
        return null;
      }
      this.grid.loadResultSet(result, {
        readOnly: true,
        ...this._lastQuery.resultOptions,
      });
      this._queryWasReadOnly = null;
      this._queryPreviousQuery = null;
      this._setState("ready", {
        rows: result.rows?.length || 0,
        totalRows: result.rowCount ?? result.rows?.length ?? 0,
      });
      this._emit("querySuccess", { result });
      return result;
    } catch (error) {
      if (request !== this._request) return null;
      if (controller.signal.aborted) {
        this._setState("idle");
        this._emit("queryCancelled", {});
        return null;
      }
      this._setState("error", { error });
      this._emit("queryError", { error });
      throw error;
    } finally {
      if (request === this._request) {
        this._queryController = null;
        if (this._queryWasReadOnly != null) {
          this.grid.setReadOnly(this._queryWasReadOnly);
          this._lastQuery = this._queryPreviousQuery;
        }
        this._queryWasReadOnly = null;
        this._queryPreviousQuery = null;
      }
    }
  }

  async loadNextPage(options = {}) {
    if (this._saveController)
      throw new Error(
        "Wait for the current database save to finish before loading another page",
      );
    if (this._queryController)
      throw new Error("Wait for the current query or page load to finish");
    if (!this._lastQuery || !this.grid.sqlBinding)
      throw new Error("Run a query before requesting another page");
    const metadata = this.grid.getSQLMetadata();
    if (!metadata.hasMore) return null;
    if (typeof this.client.queryPage !== "function")
      throw new Error(
        "SQL client must provide queryPage({ sql, params, cursor, signal }) for paginated results",
      );
    const controller = new AbortController();
    this._queryController?.abort();
    this._queryController = controller;
    const request = ++this._request;
    if (options.signal) {
      if (options.signal.aborted) controller.abort(options.signal.reason);
      else
        options.signal.addEventListener(
          "abort",
          () => controller.abort(options.signal.reason),
          { once: true },
        );
    }
    this._setState("loadingPage", {
      loadedRows: metadata.loadedRows,
      totalRows: metadata.totalRows,
    });
    try {
      const pageSize =
        Number.isInteger(options.pageSize) && options.pageSize > 0
          ? options.pageSize
          : (this._lastQuery.pageSize ?? this.pageSize);
      const result = await this.client.queryPage({
        sql: this._lastQuery.sql,
        params: this._lastQuery.params,
        cursor: metadata.nextCursor ?? metadata.fetchedRows,
        pageSize,
        signal: controller.signal,
        context: this._lastQuery.context,
      });
      if (request !== this._request) return null;
      if (controller.signal.aborted) {
        this._setState("ready");
        return null;
      }
      const page = this.grid.appendResultPage(result);
      this._setState("ready", page);
      this._emit("pageSuccess", { result, page });
      if (this.autoPage && page.hasMore)
        queueMicrotask(() => this._maybeAutoPage());
      return page;
    } catch (error) {
      if (request !== this._request) return null;
      if (controller.signal.aborted) {
        this._setState("ready");
        return null;
      }
      this._setState("error", { error });
      this._emit("queryError", { error });
      throw error;
    } finally {
      if (request === this._request) this._queryController = null;
    }
  }

  cancelQuery() {
    if (!this._queryController) return false;
    this._request++;
    this._queryController.abort();
    this._queryController = null;
    if (this._queryWasReadOnly != null) {
      this.grid.setReadOnly(this._queryWasReadOnly);
      this._lastQuery = this._queryPreviousQuery;
    }
    this._queryWasReadOnly = null;
    this._queryPreviousQuery = null;
    this._setState("idle");
    this._emit("queryCancelled", {});
    return true;
  }

  async commitChanges(options = {}) {
    if (this._destroyed) throw new Error("SQL adapter has been destroyed");
    if (this._queryController)
      throw new Error(
        "Wait for the current query to finish before saving database changes",
      );
    if (this._saveController)
      throw new Error("A database save is already in progress");
    if (typeof this.client.commitChanges !== "function")
      throw new Error(
        "SQL client must provide commitChanges(changes, { signal, tableName, queryId })",
      );
    this.grid.commitEdit?.();
    const changes = this.grid.getDataChanges();
    const counts = Object.fromEntries(
      Object.entries(changes).map(([type, items]) => [type, items.length]),
    );
    if (!Object.values(counts).some(Boolean))
      return { changes: counts, result: null };
    const metadata = this.grid.getSQLMetadata();
    const controller = new AbortController();
    this._saveController = controller;
    this._saveWasReadOnly = this.grid.readOnly;
    if (!this.grid.readOnly) this.grid.setReadOnly(true);
    if (options.signal) {
      if (options.signal.aborted) controller.abort(options.signal.reason);
      else
        options.signal.addEventListener(
          "abort",
          () => controller.abort(options.signal.reason),
          { once: true },
        );
    }
    this._setState("saving", { changes: counts });
    try {
      // The host adapter should apply this batch atomically, using bound parameters.
      const result = await this.client.commitChanges(changes, {
        signal: controller.signal,
        tableName: metadata?.tableName,
        queryId: metadata?.queryId,
        context: options.context,
      });
      if (result?.ok === false || result?.conflicts?.length)
        throw new Error(
          result.message || "The database rejected one or more changes",
        );
      this.grid.acceptDataChanges({
        keyMap: result?.keyMap || {},
        recordsByClientId: result?.recordsByClientId || {},
      });
      this._setState("ready", { saved: counts });
      this._emit("saveSuccess", { changes: counts, result });
      return { changes: counts, result };
    } catch (error) {
      if (controller.signal.aborted) {
        this._setState("ready");
        this._emit("saveCancelled", { changes: counts });
        return { changes: counts, result: null, cancelled: true };
      }
      this._setState("error", { error, changes: counts });
      this._emit("saveError", { error, changes: counts });
      throw error;
    } finally {
      this._saveController = null;
      if (this._saveWasReadOnly != null)
        this.grid.setReadOnly(this._saveWasReadOnly);
      this._saveWasReadOnly = null;
    }
  }

  cancelSave() {
    if (!this._saveController) return false;
    this._saveController.abort();
    return true;
  }

  destroy() {
    this.cancelQuery();
    this.cancelSave();
    this._destroyed = true;
    for (const unsubscribe of this._gridUnsubscribers) unsubscribe();
    this._gridUnsubscribers.length = 0;
    this.listeners.clear();
  }
}

export default SQLClientAdapter;
