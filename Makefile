.DEFAULT_GOAL := help

NPM ?= npm
NODE ?= node
PYTHON ?= python3
PRETTIER ?= prettier
PORT ?= 8080

FORMAT_FILES := src demo test benchmarks scripts docs README.md package.json

.PHONY: help run fmt fmt-check test check benchmark benchmark-large docs

help:
	@printf '%s\n' \
	  'make run             Serve the demo at http://localhost:$(PORT)/demo/' \
	  'make fmt             Format source, tests, and documentation with Prettier' \
	  'make fmt-check       Check formatting without changing files' \
	  'make test            Run the core test suite and formula-doc checks' \
	  'make check           Check JavaScript syntax and run tests' \
	  'make benchmark       Run recalculation benchmarks' \
	  'make benchmark-large Run large-grid benchmarks' \
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
	@find src demo test benchmarks scripts -type f \( -name '*.js' -o -name '*.mjs' \) -exec sh -c 'for file do "$$0" --check "$$file" || exit; done' $(NODE) {} +
	$(NPM) test

benchmark:
	$(NPM) run benchmark

benchmark-large:
	$(NPM) run benchmark:large

docs:
	$(NPM) run docs:formulas
