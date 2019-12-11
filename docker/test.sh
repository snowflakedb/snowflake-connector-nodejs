#!/bin/bash -e
#
# Build NodeJS
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/_init.sh

NETWORK_NAME=proxytest
PROXY_NAME=$INTERNAL_CLIENT_REPO/squid
export PROXY_IP=172.20.128.10
export PROXY_PORT=3128

#
# set Jenkins GIT parameters propagated from Build job.
# 
export client_git_url=${client_git_url:-https://github.com/snowflakedb/snowflake-connector-nodejs.git}
export client_git_branch=${git_branch:-origin/master}
# client_git_commit is optional, even if not set, it is ok.

#
# set GIT parameters used in the following scripts
#
export GIT_URL=${GIT_URL:-$client_git_url}
export GIT_BRANCH=${GIT_BRANCH:-$client_git_branch}
export GIT_COMMIT=${GIT_COMMIT:-$client_git_commit}

docker pull $TEST_IMAGE_NAME
if ! docker network ls | awk '{print $2}' | grep -q $NETWORK_NAME; then
    echo "[INFO] Creating a network $NETWORK_NAME"
    docker network create --subnet 172.20.0.0.0/16 --ip-range 172.20.240.0/20 $NETWORK_NAME
else
    echo "[INFO] The network $NETWORK_NAME already up."
fi

if ! docker ps | awk '{print $2}' | grep -q $PROXY_NAME; then
    echo "[INFO] Starting Squid proxy server"
    docker run --net $NETWORK_NAME --ip $PROXY_IP -d $PROXY_NAME
else
    echo "[INFO] Squid proxy server already up."
fi
docker run \
    --net $NETWORK_NAME \
    -v $THIS_DIR:/mnt/host \
    -e PROXY_IP \
    -e PROXY_PORT \
    -e GIT_COMMIT \
    -e GIT_BRANCH \
    -e GIT_URL \
    -e AWS_ACCESS_KEY_ID \
    -e AWS_SECRET_ACCESS_KEY \
    $TEST_IMAGE_NAME \
    "/mnt/host/scripts/test_component.sh"
