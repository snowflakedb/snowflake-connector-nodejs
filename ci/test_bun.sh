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

cd $WORKSPACE

PACKAGE_NAME=$(ls snowflake-sdk*.tgz)
echo "[INFO] Installing $PACKAGE_NAME for Bun smoke test"
npm install $WORKSPACE/${PACKAGE_NAME}

echo "[INFO] Running Bun smoke test"
bun run $SOURCE_ROOT/ci/container/test_npm_package_bun.ts
