#!/bin/bash -e
#
# Bun smoke test for NodeJS Driver (Linux, GitHub Actions only).
#
# Installs the packed snowflake-sdk tarball produced by the build job and runs
# a single Bun-driven smoke test (ci/container/test_npm_package_bun.ts).
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/_init.sh
source $THIS_DIR/scripts/set_git_info.sh

export WORKSPACE=$GITHUB_WORKSPACE
export SOURCE_ROOT=$GITHUB_WORKSPACE

# Stage the build artifact (snowflake-sdk-*.tgz) at $WORKSPACE root,
# matching the layout that ci/container/download_artifact.sh produces for GHA.
if [[ -e "$WORKSPACE/artifacts/" ]]; then
    echo "[INFO] cp $WORKSPACE/artifacts/* $WORKSPACE"
    cp $WORKSPACE/artifacts/* $WORKSPACE
    ls -l $WORKSPACE
else
    echo "[ERROR] No $WORKSPACE/artifacts exists"
    ls -l $WORKSPACE
    exit 1
fi

echo "[INFO] Setting test parameters"
PARAMETER_FILE=$WORKSPACE/parameters.json
eval $(jq -r '.testconnection | to_entries | map("export \(.key)=\(.value|tostring)")|.[]' $PARAMETER_FILE)

# Resolve private key path to absolute (mirrors ci/container/test_component.sh)
if [[ -n "$SNOWFLAKE_TEST_PRIVATE_KEY_FILE" && "$SNOWFLAKE_TEST_PRIVATE_KEY_FILE" != /* ]]; then
    export SNOWFLAKE_TEST_PRIVATE_KEY_FILE="$WORKSPACE/$SNOWFLAKE_TEST_PRIVATE_KEY_FILE"
fi

env | grep SNOWFLAKE_ | grep -v -E "(PASS|KEY|SECRET|TOKEN)" | sort

PACKAGE_NAME=$(cd $WORKSPACE && ls snowflake-sdk*.tgz)

# Run Bun in an isolated directory OUTSIDE the repo. The repo's tsconfig.json
# has `paths: { "asn1.js": ["./lib/types/asn1.js.d.ts"] }`, and Bun honors
# tsconfig `paths` for runtime module resolution. Bun walks UP from the script
# location looking for a tsconfig.json, so any directory inside $WORKSPACE (=
# repo root in GHA) inherits that mapping and breaks transitive `require('asn1.js')`
# calls from asn1.js-rfc5280 / @techteamer/ocsp.
#
# Using a temp directory outside $WORKSPACE side-steps the walk-up. We also
# drop a neutral tsconfig.json next to the test as a belt-and-suspenders guard.
BUN_TEST_DIR=$(mktemp -d -t bun-smoke-XXXXXX)
echo "[INFO] Bun smoke test workdir: $BUN_TEST_DIR"
trap "rm -rf $BUN_TEST_DIR" EXIT

cp $SOURCE_ROOT/ci/container/test_npm_package_bun.ts $BUN_TEST_DIR/
cp $WORKSPACE/${PACKAGE_NAME} $BUN_TEST_DIR/

# Neutral tsconfig that resets `paths` so Bun doesn't pick up anything from
# parent directories (defense-in-depth; the workdir is already outside the repo).
cat > $BUN_TEST_DIR/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "module": "node16",
    "target": "ES2022",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {}
  }
}
EOF

cd $BUN_TEST_DIR

echo "[INFO] === Bun smoke test debug ==="
echo "[INFO] pwd: $(pwd)"
echo "[INFO] bun version: $(bun --version)"
echo "[INFO] node version: $(node --version)"
echo "[INFO] workdir contents:"
ls -la
echo "[INFO] === end debug ==="

echo "[INFO] Installing $PACKAGE_NAME for Bun smoke test"
npm init -y > /dev/null
npm install ./${PACKAGE_NAME}

# Sanity-check that `asn1.js` resolves to the real package (lib/asn1.js with
# `asn1.define = require('./asn1/api').define`) and not to a .d.ts shim.
echo "[INFO] Resolved asn1.js main:"
ls -la node_modules/asn1.js/ 2>&1 || echo "[WARN] node_modules/asn1.js not found"
node -e "console.log('asn1.js define typeof =', typeof require('asn1.js').define)" 2>&1 || true
bun -e "console.log('bun asn1.js define typeof =', typeof require('asn1.js').define)" 2>&1 || true

echo "[INFO] Running Bun smoke test"
bun run ./test_npm_package_bun.ts
