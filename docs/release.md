# npm release

The prepared package is **tiny-datagrid 0.1.0**. It is ESM-only, ships its sources
and declarations without a build step, and has no runtime dependencies.
Development and release checks require Node.js 20 or later.

```sh
npm ci
npm run release:check
npm run release:pack
```

The final command validates the checkout and creates
`dist/tiny-datagrid-0.1.0.tgz` and `dist/package-info.json`, including the npm
SHA-512 integrity value and file manifest. `dist/`, installed dependencies and tarballs are
ignored by Git. The package includes `src/`, `demo/`, `docs/`, the README, license,
and changelog; native prototypes and development tooling are excluded.

`release:check` checks JavaScript syntax, every functional test, the generated
formula reference, and strict TypeScript usage. It also creates a temporary
tarball, installs it offline into a clean project, imports every JavaScript
entry point, resolves the CSS, checks relative imports and worker assets, and
runs SQL/materialization and numerical simulation checks against the installed package.
The same consumer's TypeScript is checked against the installed declarations.

The dedicated demo/library parity test requires every library import used by
the demo to have a public, typed package entry point. It also checks that demo
compatibility wrappers resolve to the same implementations. DOM tests cover
the public SQL, analysis, simulations, object-browser and autosave tools and
their cleanup. Canvas rendering and native browser dialog behavior require
browser verification.

The CI workflow runs these checks with Node.js 20, 22, 24 and 26.
`npm run prepublishOnly` repeats the release checks before publishing from the
checkout. It is also invoked automatically by `npm publish`.
See the official [npm lifecycle documentation](https://docs.npmjs.com/cli/v11/using-npm/scripts/)
and [npm pack documentation](https://docs.npmjs.com/cli/v11/commands/npm-pack/).

To publish after reviewing the prepared package, authenticate the intended
npm account with `npm login` and run `npm publish` from the checkout.
The package's publish configuration selects the public npm registry and public
access. These preparation scripts do not publish or create Git tags.

For later releases, update `package.json` and the lockfile with
`npm version <next-version> --no-git-tag-version`, update the changelog separately,
then rerun `release:pack`.
For formula-catalog changes, run `npm run docs:formulas` before validation.
The generated formula overview is excluded from Prettier so formatting does
not make the generator check stale.
