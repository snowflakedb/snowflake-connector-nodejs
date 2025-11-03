#!/bin/bash -e
#
# Test NodeJS driver in RHEL 9
# NOTES:
#   - Node.js major version MUST be passed in as the first argument, e.g: "18", "20", "22"
#   - This is the script that test_rhel9_docker.sh runs inside of the docker container

if [[ -z "${1}" ]]; then
    echo "[ERROR] Node.js major version is required as first argument (e.g., '18', '20', '22')"
    echo "Usage: $0 <node_major_version>"
    exit 1
fi

NODE_VERSION="${1}"
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# CONNECTOR_DIR is the repo root (parent of ci directory)
CONNECTOR_DIR="$( dirname "$( dirname "${THIS_DIR}")")"

# Validate prerequisites - parameters.json should be decrypted before container runs
if [[ ! -f "${CONNECTOR_DIR}/parameters.json" ]]; then
    echo "[ERROR] parameters.json not found at ${CONNECTOR_DIR}/parameters.json"
    echo "[ERROR] Parameters must be decrypted before running the container"
    exit 1
fi

# Setup locale explicitly to ensure UTF-8 encoding (critical for bind tests)
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
# Ensure Node.js uses UTF-8 encoding for all operations
export NODE_OPTIONS="--max-old-space-size=4096"
echo "[INFO] Locale settings: LANG=${LANG}, LC_ALL=${LC_ALL}"
locale
echo "[INFO] Verifying locale is available:"
locale -a | grep -i "en_us.utf" || echo "[WARN] en_US.UTF-8 locale not found in available locales"

# Setup Node.js environment
echo "[INFO] Using Node.js major version ${NODE_VERSION}"

# Verify Node.js is available (should be installed directly in Dockerfile)
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found in PATH!"
    exit 1
fi

# Verify Node.js major version matches
INSTALLED_NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [[ "${INSTALLED_NODE_VERSION}" != "${NODE_VERSION}" ]]; then
    echo "[WARN] Installed Node.js major version (${INSTALLED_NODE_VERSION}) does not match requested version (${NODE_VERSION})"
    echo "[INFO] Continuing with installed version: ${INSTALLED_NODE_VERSION}"
fi

# Verify Node.js and npm versions
echo "[INFO] Node.js version: $(node --version)"
echo "[INFO] npm version: $(npm --version)"

cd $CONNECTOR_DIR

echo "[INFO] Installing npm dependencies"
npm install

# Load connection parameters (same pattern as test_component.sh)
echo "[INFO] Setting test parameters"
PARAMETER_FILE=${CONNECTOR_DIR}/parameters.json
if [[ ! -f "$PARAMETER_FILE" ]]; then
    echo "[ERROR] parameters.json not found at $PARAMETER_FILE"
    exit 1
fi
eval $(jq -r '.testconnection | to_entries | map("export \(.key)=\(.value|tostring)")|.[]' $PARAMETER_FILE)

# Sanitize RUNNER_TRACKING_ID to handle spaces (e.g., "GitHub Actions" -> "GitHub_Actions")
# This ensures schema names are SQL-safe when used by both shell and Python scripts
if [[ -n "$RUNNER_TRACKING_ID" ]]; then
    export RUNNER_TRACKING_ID=$(echo "$RUNNER_TRACKING_ID" | tr ' ' '_' | tr -cd '[:alnum:]_')
fi

export TARGET_SCHEMA_NAME=${RUNNER_TRACKING_ID//-/_}_${GITHUB_SHA}
export DRIVER_NAME=nodejs
export TIMEOUT=180000
export SF_OCSP_TEST_OCSP_RESPONDER_TIMEOUT=1000

function finish() {
    pushd ${CONNECTOR_DIR}/ci/container >& /dev/null
        echo "[INFO] Drop schema $TARGET_SCHEMA_NAME"
        python3 drop_schema.py
    popd >& /dev/null
}
trap finish EXIT

pushd ${CONNECTOR_DIR}/ci/container >& /dev/null
    echo "[INFO] Create schema $TARGET_SCHEMA_NAME"
    if python3 create_schema.py; then
        export SNOWFLAKE_TEST_SCHEMA=$TARGET_SCHEMA_NAME
    else
        echo "[WARN] SNOWFLAKE_TEST_SCHEMA: $SNOWFLAKE_TEST_SCHEMA"
    fi
popd >& /dev/null

env | grep SNOWFLAKE_ | grep -v PASS

[[ -n "$PROXY_IP" ]] && echo "[INFO] SNOWFLAKE_TEST_PROXY_HOST=$PROXY_IP" && export SNOWFLAKE_TEST_PROXY_HOST=$PROXY_IP
[[ -n "$PROXY_PORT" ]] && echo "[INFO] SNOWFLAKE_TEST_PROXY_PORT=$PROXY_PORT" && export SNOWFLAKE_TEST_PROXY_PORT=$PROXY_PORT

echo "[INFO] Starting hang_webserver.py 12345"
python3 ${CONNECTOR_DIR}/ci/container/hang_webserver.py 12345 > hang_webserver.out 2>&1 &

# Configure Wiremock for RHEL9 environment
# Pre-warm Java JVM to help Wiremock start faster
if command -v java &> /dev/null; then
    echo "[INFO] Pre-warming Java JVM for faster Wiremock startup"
    java -version > /dev/null 2>&1 || true
fi

# Set environment variables for optimized Wiremock startup on RHEL9
# Increase timeout to 60s for slower RHEL9 Java startup
export WIREMOCK_STARTUP_TIMEOUT_MS=60000
echo "[INFO] Wiremock startup timeout set to ${WIREMOCK_STARTUP_TIMEOUT_MS}ms for RHEL9"

# Run tests using npm test:ci (unit and integration tests)
cd ${CONNECTOR_DIR}
echo "[INFO] Running Tests"
npm run test:ci

# Restore original wiremockRunner.js if backup exists
if [[ -f "${WIREMOCK_RUNNER}.bak" ]]; then
    echo "[INFO] Restoring original wiremockRunner.js"
    mv "${WIREMOCK_RUNNER}.bak" "$WIREMOCK_RUNNER" 2>/dev/null || true
fi

