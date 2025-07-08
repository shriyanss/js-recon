# Change Log

## (Unreleased)

### Added

### Changed

### Fixed

- Implement proper error handling in `list nav` in interactive mode

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
