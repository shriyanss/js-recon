# Change Log

## 1.1.2-alpha.1 - (unreleased)

### Added

- Added axios client detection in next.js

### Changed

### Fixed

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
