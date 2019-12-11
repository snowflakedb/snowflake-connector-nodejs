#!/bin/bash -ex
#
# Test NodeJS Driver
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
[[ -z "$GIT_BRANCH" ]] && echo "Set GIT_BRANCH to build" && exit 1
[[ -z "$GIT_URL" ]] && echo "Set GIT_URL to build" && exit 1
echo "[INFO] checking out from branch $GIT_BRANCH"
git clone $GIT_URL target
cd target
[[ "$GIT_BRANCH" != "origin/master" ]] && git checkout --track $GIT_BRANCH
if [[ -n "$GIT_COMMIT" ]]; then
    echo "[INFO] Checking out with the commit hash $GIT_COMMIT"
    git checkout $GIT_COMMIT
else
    GIT_COMMIT=$(git rev-parse HEAD)
    echo "[INFO] Resetting the commit hash to $GIT_COMMIT"
fi
TS=$(TZ=UTC git show -s --date='format-local:%Y%m%dT%H%M%S' --format="%cd" $GIT_COMMIT)
echo "[INFO] Testing"
cd ~
echo "[INFO] aws s3 cp --only-show-errors --recursive s3://sfc-jenkins/repository/nodejs/$GIT_BRANCH/${TS}_${GIT_COMMIT}/ ."
aws s3 cp --only-show-errors --recursive s3://sfc-jenkins/repository/nodejs/$GIT_BRANCH/${TS}_${GIT_COMMIT}/ .

export DOCKER_HOST_IP=$(route -n | awk '/UG[ \t]/{print $2}')
echo "[INFO] Setting snowflake.reg.local to $DOCKER_HOST_IP"
cat <<EOF >> /etc/hosts
$DOCKER_HOST_IP snowflake.reg.local testaccount.reg.snowflakecomputing.com snowflake.reg.snowflakecomputing.com externalaccount.reg.local.snowflakecomputing.com
EOF

PACKAGE_NAME=$(ls snowflake-sdk*.tgz)
cp /mnt/host/scripts/package.json .
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

if [[ -z "$TRAVIS" ]]; then
    echo "[INFO] Running Internal Tests"
    mocha --timeout 90000 "target/system_test/**/*.js"
fi

echo "[INFO] Running Tests"
mocha --timeout 90000 "target/test/**/*.js"
