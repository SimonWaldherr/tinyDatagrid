.DEFAULT_GOAL := help

NPM ?= npm
NODE ?= node
PYTHON ?= python3
PRETTIER ?= prettier
PORT ?= 8080

FORMAT_FILES := src demo test benchmarks scripts docs README.md package.json

.PHONY: help run fmt fmt-check test check benchmark benchmark-large benchmark-sql docs release-check release-pack

help:
	@printf '%s\n' \
	  'make run             Serve the demo at http://localhost:$(PORT)/demo/' \
	  'make fmt             Format source, tests, and documentation with Prettier' \
	  'make fmt-check       Check formatting without changing files' \
	  'make test            Run the core test suite and formula-doc checks' \
	  'make check           Check JavaScript syntax and run tests' \
	  'make benchmark       Run recalculation benchmarks' \
	  'make benchmark-large Run large-grid benchmarks' \
	  'make benchmark-sql   Run local SQL benchmarks' \
	  'make release-check   Check tests, types and the installed npm tarball' \
	  'make release-pack    Validate and create the npm tarball in dist/' \
	  'make docs            Regenerate the formula reference'

run:
	$(PYTHON) -m http.server $(PORT)

fmt:
	$(PRETTIER) --write $(FORMAT_FILES)

fmt-check:
	$(PRETTIER) --check $(FORMAT_FILES)

test:
	$(NPM) test

check:
	$(NPM) run check

benchmark:
	$(NPM) run benchmark

benchmark-large:
	$(NPM) run benchmark:large

benchmark-sql:
	$(NPM) run benchmark:sql

release-check:
	$(NPM) run release:check

release-pack:
	$(NPM) run release:pack

docs:
	$(NPM) run docs:formulas
