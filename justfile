set positional-arguments

# Download test fixtures from GitHub Release
setup:
    bash scripts/download-fixtures.sh

# Run all tests
test: setup
    moon test

# Run tests for a specific package
test-pkg pkg: setup
    moon test -p {{pkg}}

# Type check
check:
    moon check --deny-warn

# Format code
fmt:
    moon fmt

# Generate type definition files
info:
    moon info

# Update snapshot tests
update: setup
    moon test -u

# Install browser test dependencies and Chromium, Firefox and WebKit
setup-browser: setup
    pnpm install --frozen-lockfile
    pnpm exec playwright install chromium firefox webkit

# Build the MoonBit browser module
build-browser:
    moon build --target js --release --deny-warn

# Run headless browser comparisons and attach measured JSON to test results
test-browser: setup build-browser
    pnpm run check:browser
    pnpm run test:browser

# Save Canvas, DOM and MoonBit measurements (including --axis tag=value and --stretch)
measure-browser *args: setup build-browser
    pnpm run measure:browser "$@"

# Validate both the default backend and the browser integration
ci: check test test-browser

# Validate tests, formatting and the packaged module before publishing
release-check: ci
    moon test --target js --deny-warn
    moon fmt --check
    moon publish --dry-run

# Regenerate original GSUB/GPOS fixtures (requires uv; no external fonts)
gen-shaping-fixtures:
    uv run scripts/gen_shaping.py

# Regenerate pinned OFL font subsets used by browser tests
gen-shaping-references:
    uv run scripts/gen_shaping_references.py

# Collect shaped text, RTL runs and cluster rectangles
measure-shaping: setup build-browser
    pnpm run measure:browser --font fixtures/shaping.ttf --text 'fi AV' --text 'A אבג 123' --text 'ببب' --output _build/measurements/shaping.json

# Inspect single-line width limits and actual wrapped/clipped layout
check-fit *args: build-browser
    pnpm run check:fit "$@"

# Regenerate bold, italic, variable and Japanese fit reference fonts
gen-fit-references:
    uv run scripts/gen_fit_references.py
