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

function chown_junit() {
    chown $USERID $WORKSPACE/junit*.xml
}
trap chown_junit EXIT

echo "[INFO] adding testuser"
echo $USERID
useradd -u $USERID testuser

echo "[INFO] checking out from branch $GIT_BRANCH"
git clone $GIT_URL target
cd target
[[ "$GIT_BRANCH" != "origin/master" ]] && git checkout --track $GIT_BRANCH
source $THIS_DIR/get_git_commit.sh
source $THIS_DIR/download_artifact.sh

echo "[INFO] Testing"
cd ~

export DOCKER_HOST_IP=$(route -n | awk '/UG[ \t]/{print $2}')
echo "[INFO] Setting snowflake.reg.local to $DOCKER_HOST_IP"
cat <<EOF >> /etc/hosts
$DOCKER_HOST_IP snowflake.reg.local testaccount.reg.snowflakecomputing.com snowflake.reg.snowflakecomputing.com externalaccount.reg.local.snowflakecomputing.com
EOF

PACKAGE_NAME=$(ls snowflake-sdk*.tgz)
cp /mnt/host/container/package.json .
npm install
npm install ${PACKAGE_NAME}
export PATH=$(pwd)/node_modules/.bin:$PATH

echo "[INFO] Setting test parameters"
PARAMETER_FILE=target/test/parameters.json
eval $(jq -r '.testconnection | to_entries | map("export \(.key)=\(.value|tostring)")|.[]' $PARAMETER_FILE)
env | grep SNOWFLAKE_ | grep -v PASS

[[ -n "$PROXY_IP" ]] && echo "[INFO] SNOWFLAKE_TEST_PROXY_HOST=$PROXY_IP" && export SNOWFLAKE_TEST_PROXY_HOST=$PROXY_IP
[[ -n "$PROXY_PORT" ]] && echo "[INFO] SNOWFLAKE_TEST_PROXY_PORT=$PROXY_PORT" && export SNOWFLAKE_TEST_PROXY_PORT=$PROXY_PORT

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

if [[ -z "$TRAVIS" ]]; then
    echo "[INFO] Running Internal Tests"
    if ! ${MOCHA_CMD[@]} "output=$WORKSPACE/junit-system-test.xml" "target/system_test/**/*.js"; then
        exit 1
    fi
fi

echo "[INFO] Running Tests"
if ! ${MOCHA_CMD[@]} "output=$WORKSPACE/junit.xml" "target/test/**/*.js"; then
    exit 1
fi
