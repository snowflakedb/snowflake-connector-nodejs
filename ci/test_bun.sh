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
# location looking for a tsconfig.json, so any directory inside $WORKSPACE
# (= repo root in GHA) inherits that mapping and breaks transitive
# `require('asn1.js')` calls from asn1.js-rfc5280 / @techteamer/ocsp.
# A workdir under /tmp side-steps the walk-up entirely.
BUN_TEST_DIR=$(mktemp -d -t bun-smoke-XXXXXX)
echo "[INFO] Bun smoke test workdir: $BUN_TEST_DIR"
trap "rm -rf $BUN_TEST_DIR" EXIT

cp $SOURCE_ROOT/ci/container/test_npm_package_bun.ts $BUN_TEST_DIR/
cp $WORKSPACE/${PACKAGE_NAME} $BUN_TEST_DIR/
cd $BUN_TEST_DIR

echo "[INFO] Installing $PACKAGE_NAME for Bun smoke test"
npm init -y > /dev/null
npm install ./${PACKAGE_NAME}

echo "[INFO] Running Bun smoke test"
bun run ./test_npm_package_bun.ts
