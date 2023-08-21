#!/bin/bash -e
#
# Test NodeJS Driver for Linux and Mac
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export WORKSPACE=${WORKSPACE:-/mnt/workspace}
export SOURCE_ROOT=${SOURCE_ROOT:-/mnt/host}
export DRIVER_NAME=nodejs
export TIMEOUT=180000
export SF_OCSP_TEST_OCSP_RESPONDER_TIMEOUT=1000

[[ -z "$GIT_BRANCH" ]] && echo "Set GIT_BRANCH to test" && exit 1
[[ -z "$GIT_URL" ]] && echo "Set GIT_URL to test" && exit 1

source $THIS_DIR/download_artifact.sh

echo "[INFO] Testing"
cd $WORKSPACE

if [[ "$LOCAL_USER_NAME" == "jenkins" ]]; then
    cd target_client
    export PATH=$WORKSPACE/target_client/node_modules/mocha/bin:$PATH
else
    export PATH=$WORKSPACE/node_modules/mocha/bin:$PATH
fi
cp $SOURCE_ROOT/ci/container/package.json .
npm install

PACKAGE_NAME=$(cd $WORKSPACE && ls snowflake-sdk*.tgz)
npm install $WORKSPACE/${PACKAGE_NAME}

echo "[INFO] Setting test parameters"
if [[ "$LOCAL_USER_NAME" == "jenkins" ]]; then
    echo "[INFO] Use the default test parameters.json"
    PARAMETER_FILE=$SOURCE_ROOT/test/parameters.json
else
    echo "[INFO] Found parameter file in $WORKSPACE"
    PARAMETER_FILE=$WORKSPACE/parameters.json
fi
eval $(jq -r '.testconnection | to_entries | map("export \(.key)=\(.value|tostring)")|.[]' $PARAMETER_FILE)

export TARGET_SCHEMA_NAME=${RUNNER_TRACKING_ID//-/_}_${GITHUB_SHA}

function finish() {
    pushd $SOURCE_ROOT/ci/container >& /dev/null
        echo "[INFO] Drop schema $TARGET_SCHEMA_NAME"
        python3 drop_schema.py
    popd >& /dev/null
}
trap finish EXIT

pushd $SOURCE_ROOT/ci/container >& /dev/null
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
python3 $THIS_DIR/hang_webserver.py 12345 > hang_webserver.out 2>&1 &

if [[ "$SHOULD_GENERATE_COVERAGE_REPORT" == "1" ]];
  then
    MOCHA_CMD=(
       "npx" "nyc" "--reporter=lcov" "--reporter=text" "mocha" "--exit" "--timeout" "$TIMEOUT" "--recursive" "--full-trace"
    )
  else
    MOCHA_CMD=(
        "mocha" "--timeout" "$TIMEOUT" "--recursive" "--full-trace"
    )
fi

if [[ -z "$GITHUB_ACTIONS" ]]; then
    MOCHA_CMD+=(
        "--reporter" "xunit"
        "--reporter-options" "output=$WORKSPACE/junit.xml"
    )
else
    # Github Action doesn't generate junit.xml
    MOCHA_CMD+=(
        "--color"
        "--reporter" "spec"
    )
fi

if [[ -z "$GITHUB_ACTIONS" ]]; then
    echo "[INFO] Running Internal Tests. Test result: $WORKSPACE/junit-system-test.xml"
    if ! ${MOCHA_CMD[@]} "$SOURCE_ROOT/system_test/**/*.js"; then
        echo "[ERROR] Test failed"
        [[ -f "$WORKSPACE/junit.xml" ]] && cat $WORKSPACE/junit.xml
        exit 1
    elif [[ -f "$WORKSPACE/junit.xml" ]]; then
        cp -f $WORKSPACE/junit.xml $WORKSPACE/junit-system-test.xml
    fi
fi

echo "[INFO] Running Tests: Test result: $WORKSPACE/junit.xml"
if ! ${MOCHA_CMD[@]} "$SOURCE_ROOT/test/**/*.js"; then
    echo "[ERROR] Test failed"
    [[ -f "$WORKSPACE/junit.xml" ]] && cat $WORKSPACE/junit.xml
    exit 1
fi
