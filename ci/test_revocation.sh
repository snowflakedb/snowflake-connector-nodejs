#!/bin/bash
#
# Test certificate revocation validation using the revocation-validation framework.
#

set -o pipefail

THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DRIVER_DIR="$( dirname "${THIS_DIR}")"
WORKSPACE=${WORKSPACE:-${DRIVER_DIR}}

echo "[Info] Starting revocation validation tests"

# The Build stage already ran npm install + npm pack inside Docker,
# producing snowflake-sdk*.tgz in the repo root. Install it into
# the revocation-validation client's node_modules so the framework
# uses the branch build without needing npm registry access.

TARBALL=$(find "$DRIVER_DIR" -maxdepth 1 -name "snowflake-sdk*.tgz" 2>/dev/null | head -1)
if [ -z "$TARBALL" ]; then
    echo "[Error] No snowflake-sdk tarball found in $DRIVER_DIR"
    echo "[Error] The Build stage should have produced snowflake-sdk*.tgz via npm pack"
    ls -la "$DRIVER_DIR"/snowflake-sdk* 2>/dev/null || echo "  None found"
    exit 1
fi
echo "[Info] Using tarball: $(basename "$TARBALL")"

set -e

# Clone revocation-validation framework
REVOCATION_DIR="/tmp/revocation-validation"
REVOCATION_BRANCH="${REVOCATION_BRANCH:-main}"

rm -rf "$REVOCATION_DIR"
if [ -n "$GITHUB_USER" ] && [ -n "$GITHUB_TOKEN" ]; then
    git clone --depth 1 --branch "$REVOCATION_BRANCH" "https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/snowflakedb/revocation-validation.git" "$REVOCATION_DIR"
else
    git clone --depth 1 --branch "$REVOCATION_BRANCH" "https://github.com/snowflakedb/revocation-validation.git" "$REVOCATION_DIR"
fi

cd "$REVOCATION_DIR"

# Pre-install the tarball into the framework's nodejs client directory
# so the framework skips npm ci + npm pack (which needs network access)
CLIENT_DIR="$REVOCATION_DIR/validation/clients/snowflake-nodejs"
echo "[Info] Installing tarball into framework's Node.js client..."
(cd "$CLIENT_DIR" && npm install --no-audit --no-fund "$TARBALL")
echo "[Info] npm install from tarball complete"

echo "[Info] Running tests with Go $(go version | grep -oE 'go[0-9]+\.[0-9]+')..."

go run . \
    --client snowflake-nodejs \
    --output "${WORKSPACE}/revocation-results.json" \
    --output-html "${WORKSPACE}/revocation-report.html" \
    --log-level debug

EXIT_CODE=$?

if [ -f "${WORKSPACE}/revocation-results.json" ]; then
    echo "[Info] Results: ${WORKSPACE}/revocation-results.json"
fi
if [ -f "${WORKSPACE}/revocation-report.html" ]; then
    echo "[Info] Report: ${WORKSPACE}/revocation-report.html"
fi

exit $EXIT_CODE
