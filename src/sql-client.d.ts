import type {
  TinyDatagrid,
  SQLColumnMetadata,
  SQLResultSet,
  SQLPendingChanges,
} from "./tinygrid.js";

export type SQLAdapterState =
  "idle" | "loading" | "loadingPage" | "ready" | "saving" | "error";

export interface SQLClient {
  query(input: {
    sql: string;
    params?: unknown;
    signal: AbortSignal;
    context?: unknown;
    pageSize?: number;
  }): Promise<SQLResultSet>;
  queryPage?(input: {
    sql: string;
    params?: unknown;
    cursor: unknown;
    signal: AbortSignal;
    context?: unknown;
    pageSize?: number;
  }): Promise<SQLResultSet>;
  commitChanges?(
    changes: SQLPendingChanges,
    context: {
      signal: AbortSignal;
      tableName: string | null;
      queryId: string | null;
      context?: unknown;
    },
  ): Promise<{
    ok?: boolean;
    message?: string;
    conflicts?: unknown[];
    keyMap?: Record<string, unknown> | Map<string, unknown>;
    recordsByClientId?:
      | Record<string, Record<string, unknown>>
      | Map<string, Record<string, unknown>>;
  } | void>;
}

export interface SQLQueryOptions {
  signal?: AbortSignal;
  discardChanges?: boolean;
  context?: unknown;
  pageSize?: number;
  resultOptions?: {
    tableName?: string;
    keyColumns?: string[];
    editableColumns?: string[];
    readOnly?: boolean;
  };
}

export interface SQLAdapterEvents {
  listenerError: { sourceType: string; error: unknown };
  state: { state: SQLAdapterState; [key: string]: unknown };
  queryStart: { sql: string; params: unknown };
  querySuccess: { result: SQLResultSet };
  queryError: { error: unknown };
  queryCancelled: Record<string, never>;
  saveCancelled: { changes: Record<"updates" | "inserts" | "deletes", number> };
  pageSuccess: {
    result: SQLResultSet;
    page: {
      rows: number;
      loadedRows: number;
      fetchedRows: number;
      totalRows: number;
      hasMore: boolean;
      nextCursor: unknown;
    };
  };
  sortRequest: {
    column: number;
    direction: "asc" | "desc";
    requiresServerQuery: boolean;
  };
  filterRequest: {
    column?: number;
    values?: string[] | null;
    clear?: boolean;
    rows?: number[];
    requiresServerQuery: boolean;
  };
  saveSuccess: {
    changes: Record<"updates" | "inserts" | "deletes", number>;
    result: unknown;
  };
  saveError: {
    error: unknown;
    changes: Record<"updates" | "inserts" | "deletes", number>;
  };
}

export class SQLClientAdapter {
  constructor(
    grid: TinyDatagrid,
    client: SQLClient,
    options?: {
      autoPage?: boolean;
      autoPageThreshold?: number;
      pageSize?: number;
    },
  );
  readonly grid: TinyDatagrid;
  readonly client: SQLClient;
  readonly state: SQLAdapterState;
  on<K extends keyof SQLAdapterEvents>(
    type: K,
    listener: (detail: SQLAdapterEvents[K]) => void,
  ): () => void;
  query(
    sql: string,
    params?: unknown,
    options?: SQLQueryOptions,
  ): Promise<SQLResultSet | null>;
  loadNextPage(options?: { signal?: AbortSignal; pageSize?: number }): Promise<{
    rows: number;
    loadedRows: number;
    fetchedRows: number;
    totalRows: number;
    hasMore: boolean;
    nextCursor: unknown;
  } | null>;
  cancelQuery(): boolean;
  commitChanges(options?: {
    signal?: AbortSignal;
    context?: unknown;
  }): Promise<{
    changes: Record<"updates" | "inserts" | "deletes", number>;
    result: unknown;
    cancelled?: boolean;
  }>;
  cancelSave(): boolean;
  destroy(): void;
}

export { SQLColumnMetadata, SQLResultSet, SQLPendingChanges };
export default SQLClientAdapter;
