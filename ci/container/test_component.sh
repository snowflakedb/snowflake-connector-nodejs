#!/bin/bash -e
#
# Test NodeJS Driver
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export WORKSPACE=${WORKSPACE:-/mnt/workspace}
export CI_ROOT=${CI_ROOT:-/mnt/host}
export DRIVER_NAME=nodejs
export TIMEOUT=300000

[[ -z "$GIT_BRANCH" ]] && echo "Set GIT_BRANCH to build" && exit 1
[[ -z "$GIT_URL" ]] && echo "Set GIT_URL to build" && exit 1

echo "[INFO] checking out from branch $GIT_BRANCH"
export SOURCE_DIR=$(pwd)
git clone $GIT_URL target
cd target
[[ "$GIT_BRANCH" != "origin/master" ]] && git checkout --track $GIT_BRANCH
source $THIS_DIR/get_git_commit.sh
source $THIS_DIR/download_artifact.sh

echo "[INFO] Testing"
cd ~

PACKAGE_NAME=$(ls snowflake-sdk*.tgz)
cp $CI_ROOT/container/package.json .
npm install
npm install ${PACKAGE_NAME}
export PATH=$(pwd)/node_modules/.bin:$PATH

echo "[INFO] Setting test parameters"
if [[ -f "$WORKSPACE/parameters.json" ]]; then
    echo "[INFO] Found parameter file in $WORKSPACE"
    PARAMETER_FILE=$WORKSPACE/parameters.json
else
    echo "[INFO] Use the default test parameters.json"
    PARAMETER_FILE=target/test/parameters.json
fi
eval $(jq -r '.testconnection | to_entries | map("export \(.key)=\(.value|tostring)")|.[]' $PARAMETER_FILE)

export TARGET_SCHEMA_NAME=${RUNNER_TRACKING_ID//-/_}_${GITHUB_SHA}

function finish() {
    pushd $CI_ROOT/container
        echo "[INFO] Drop schema $TARGET_SCHEMA_NAME"
        python3 drop_schema.py
    popd
}
trap finish EXIT

pushd $CI_ROOT/container
    echo "[INFO] Create schema $TARGET_SCHEMA_NAME"
    if python3 create_schema.py; then
        export SNOWFLAKE_TEST_SCHEMA=$TARGET_SCHEMA_NAME
    else
        echo "[WARN] SNOWFLAKE_TEST_SCHEMA; $SNOWFLAKE_TEST_SCHEMA"
    fi
popd

env | grep SNOWFLAKE_ | grep -v PASS

[[ -n "$PROXY_IP" ]] && echo "[INFO] SNOWFLAKE_TEST_PROXY_HOST=$PROXY_IP" && export SNOWFLAKE_TEST_PROXY_HOST=$PROXY_IP
[[ -n "$PROXY_PORT" ]] && echo "[INFO] SNOWFLAKE_TEST_PROXY_PORT=$PROXY_PORT" && export SNOWFLAKE_TEST_PROXY_PORT=$PROXY_PORT

echo "[INFO] Starting hang_webserver.py 12345"
python3 $THIS_DIR/hang_webserver.py 12345 &
MOCHA_CMD=(
    "mocha"
    "--timeout" "$TIMEOUT"
    "--recursive"
    "--full-trace"
    "--color"
)

if [[ -z "$GITHUB_ACTIONS" ]]; then
    # Github Action doesn't generate junit.xml
    MOCHA_CMD+=(
        "--reporter" "xunit"
        "--reporter-options"
    )
    echo "[INFO] Running Internal Tests. Test result: $WORKSPACE/junit-system-test.xml"
    if ! ${MOCHA_CMD[@]} "output=$WORKSPACE/junit-system-test.xml" "$SOURCE_DIR/target/system_test/**/*.js"; then
        echo "[ERROR] Test failed"
        cat $WORKSPACE/junit-system-test.xml
        exit 1
    fi
fi

echo "[INFO] Running Tests: Test result: $WORKSPACE/junit.xml"
if ! ${MOCHA_CMD[@]} "output=$WORKSPACE/junit.xml" "$SOURCE_DIR/target/test/**/*.js"; then
    echo "[ERROR] Test failed"
    cat $WORKSPACE/junit.xml
    exit 1
fi
