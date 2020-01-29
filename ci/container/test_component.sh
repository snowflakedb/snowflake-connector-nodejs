#!/bin/bash -e
#
# Test NodeJS Driver
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export WORKSPACE=${WORKSPACE:-/mnt/workspace}
export DRIVER_NAME=nodejs

[[ -z "$GIT_BRANCH" ]] && echo "Set GIT_BRANCH to build" && exit 1
[[ -z "$GIT_URL" ]] && echo "Set GIT_URL to build" && exit 1

echo "[INFO] checking out from branch $GIT_BRANCH"
git clone $GIT_URL target
cd target
[[ "$GIT_BRANCH" != "origin/master" ]] && git checkout --track $GIT_BRANCH
source $THIS_DIR/get_git_commit.sh
source $THIS_DIR/download_artifact.sh

echo "[INFO] Testing"
cd ~

PACKAGE_NAME=$(ls snowflake-sdk*.tgz)
cp /mnt/host/container/package.json .
npm install
npm install ${PACKAGE_NAME}
export PATH=$(pwd)/node_modules/.bin:$PATH

echo "[INFO] Setting test parameters"
if [[ -f "/mnt/workspace/parameters.json" ]]; then
    echo "[INFO] Found parameter file in /mnt/workspace"
    PARAMETER_FILE=/mnt/workspace/parameters.json
else
    echo "[INFO] Use the default test parameters.json"
    PARAMETER_FILE=target/test/parameters.json
fi
eval $(jq -r '.testconnection | to_entries | map("export \(.key)=\(.value|tostring)")|.[]' $PARAMETER_FILE)

pushd /mnt/host/container
    if python3 create_schema.py; then
        export SNOWFLAKE_TEST_SCHEMA=GITHUB_${GITHUB_SHA}
    fi
popd

env | grep SNOWFLAKE_ | grep -v PASS

[[ -n "$PROXY_IP" ]] && echo "[INFO] SNOWFLAKE_TEST_PROXY_HOST=$PROXY_IP" && export SNOWFLAKE_TEST_PROXY_HOST=$PROXY_IP
[[ -n "$PROXY_PORT" ]] && echo "[INFO] SNOWFLAKE_TEST_PROXY_PORT=$PROXY_PORT" && export SNOWFLAKE_TEST_PROXY_PORT=$PROXY_PORT

echo "[INFO] Starting hang_webserver.py 12345"
$THIS_DIR/hang_webserver.py 12345 &
MOCHA_CMD=(
    "mocha"
    "--timeout" "90000"
    "--recursive"
    "--full-trace"
    "--color"
    "--reporter" "xunit"
    "--reporter-options"
)

if [[ -z "$GITHUB_ACTIONS" ]]; then
    echo "[INFO] Running Internal Tests"
    if ! ${MOCHA_CMD[@]} "output=$WORKSPACE/junit-system-test.xml" "target/system_test/**/*.js"; then
        exit 1
    fi
fi

echo "[INFO] Running Tests"
if ! ${MOCHA_CMD[@]} "output=$WORKSPACE/junit.xml" "target/test/**/*.js"; then
    exit 1
fi
