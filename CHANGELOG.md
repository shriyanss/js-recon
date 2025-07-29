# Change Log

## 1.1.4-alpha.2 - (unreleased)

### Added

- Add description to chunks in mapped.json by default when using `map` module (an axios lib is detected) or when using the `endpoints` module (when a client-side path is detected)
- Add `list desc` command to show functions with non-empty descriptions in interactive mode
- Add `refactor` module
- Iterate through all the chunks, and write it to a separate file, and add export statements

### Changed

### Fixed

## 1.1.4-alpha.1 - 2025.07.28

### Added

- Get the exports of the chunks in next.js
- Added command to get the exports of a chunk in next.js - `list exportnames`
- Added `--mapped-json` flag to endpoints module

### Changed

- Type for `exports` is now `string[]` rather than `string` in `mapped.json`
- Remove `md` output format for endpoints module
- Removed `--subsequent-requests-dir` option from endpoints module (now use `-d` only)

### Fixed

## 1.1.3 - 2025.07.28

### Added

### Changed

### Fixed

## 1.1.3-beta.3 - 2025.07.26

### Added

- Added path and query parameter extraction to OpenAPI spec generation

### Changed

### Fixed

## 1.1.3-beta.2 - 2025.07.25

### Added

- Added flags for generating OpenAPI config

### Changed

- Prepend the baseUrl when printing the URL of axios.create() calls in next.js

### Fixed

## 1.1.3-beta.1 - 2025.07.24

### Added

- Added support for axios.create() detection in Next.js resolver

### Changed

### Fixed

- Fixed [issue 30](https://github.com/shriyanss/js-recon/issues/30): `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`

## 1.1.3-alpha.2 - 2025.07.23

### Added

- Added request body extraction and display for axios calls
- Resolve `.concat()` operations when traversing code

### Changed

- Display full file path in fetch call log message
- Improve output in the openapi file

### Fixed

## 1.1.3-alpha.1 - 2025.07.22

### Added

- Added axios URL resolution in next.js (those using `.concat()`)
- Added openapi spec generation for map module

### Changed

### Fixed

## 1.1.2 - 2025.07.21

### Added

### Changed

### Fixed

## 1.1.2-alpha.4 - 2025.07.21

### Added

### Changed

### Fixed

- Fix CI pipeline for GitHub Container Registry publishing

## 1.1.2-alpha.3 - 2025.07.21

### Added

### Changed

- Remove `--no-sandbox` arg when launching browser (security)

### Fixed

- Disable chrome sandbox when running in docker to fix errors

## 1.1.2-alpha.2 - 2025.07.20

### Added

- Created docker image for js-recon

### Changed

### Fixed

## 1.1.2-alpha.1 - 2025.07.19

### Added

- Added axios client detection in next.js
- Added `list axios` command in interactive mode for next.js

### Changed

### Fixed

- Provide proper directory for JS files to the `map` module when the `run` module is used
- Added output directory conflict check when using `run` module

## 1.1.1 - 2025.07.18

### Added

### Changed

### Fixed

- Fixed the version number mismatch in `CHANGELOG.md` (stated 1.1.0) and `package.json` (stated 1.1.0-beta.5)

## 1.1.0/1.1.0-beta.5 - 2025.07.18

### Added

- Detect next in servers in which src includes '/\_next/' rather than just startsWith
- Detect webpack chunks in \_buildManifest.js

### Changed

### Fixed

## 1.1.0-beta.4 - 2025.07.09

### Added

- Added `set funcdesc <functionId> <description>` command to interactive mode

### Changed

- Pressing C-c in input box (interactive mode) will now also print the command like OS terminal
- Set the default value of `set writeimports` as `false`
- Do not store dupe and non-existent entries in `state.functionNavHistory` (interactive mode)

### Fixed

- Fix error of body has been read when running the tool for first time
- Print an error when the user passes a URL list (file) to the run command
- Add error recovery in Nuxt ast parse

## 1.1.0-beta.3 - 2025.07.08

### Added

- Added command `set writeimports` in interactive mode for next.js
- Detect ArrowFunctionExpression when getting webpack connections (Next.JS)

### Changed

### Fixed

- Implement proper error handling in `list nav` in interactive mode
- Implement error handling when going to non-existent function by `back` and `ahead` in interactive mode
- Add errorRecovery in all parser.parse to enable parsing the file even if invalid due to any reason
- Implement coderabbit suggestion: 'Truthiness check can skip fd 0'

## 1.1.0-beta.2 - 2025.07.07

### Added

### Changed

### Fixed

- Fix build errors (type errors)

## 1.1.0-beta.1 - 2025.07.07

### Added

- Svelte framework detection, and JS extraction
- JSON-based file cache
- Auto-approve executing JS code (`-y`/`--yes`)
- Added max threads for downloading JS files `-t`/`--threads`
- Add timeout handling and network idle check for page load in tech detection
- Parse script tags to extract additional JavaScript URLs from page
- Add secret scanning
- Add feasibility check to API gateway function
- Add endpoints module to support client-side path extraction
- Add subsequent-requests feature (`RSC: 1`) in Next.JS
- Add map module
    - Webpack chunk parsing
    - Interactive mode
    - `fetch()` detection
- Permutation in `strings` module
- OpenAI and Ollama integration for AI descriptions

### Changed

### Fixed

- Standardize UTF-8 encoding and improve URL path handling in lazy load module

## 1.0.0 - 2025.06.18

### Added

- Lazy Load Support for Next.js and Nuxt.js
- JavaScript String Extraction from downloaded JS files
- API Gateway Proxying to rotate IP addresses

### Changed

### Fixed
