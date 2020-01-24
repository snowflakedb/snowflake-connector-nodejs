#!/bin/bash -ex
#
# Test NodeJS
#
# - target_platform - the target platform key. It must be registered in _init.sh
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/_init.sh

sysctl net.ipv4.ip_forward

export WORKSPACE=${WORKSPACE:-/tmp}
export NETWORK_NAME=proxytest
export PROXY_NAME=$INTERNAL_CLIENT_REPO/squid
export SUBNET=192.168.0.0/16
export PROXY_IP=192.168.0.100
export PROXY_PORT=3128
export GATEWAY_HOST=192.168.0.1

#
# set Jenkins GIT parameters propagated from Build job.
# 
export client_git_url=${client_git_url:-https://github.com/snowflakedb/snowflake-connector-nodejs.git}
export client_git_branch=${client_git_branch:-origin/master}
# client_git_commit is optional, even if not set, it is ok.

#
# set GIT parameters used in the following scripts
#
export GIT_URL=${GIT_URL:-$client_git_url}
export GIT_BRANCH=${GIT_BRANCH:-$client_git_branch}
export GIT_COMMIT=${GIT_COMMIT:-$client_git_commit}
echo "GIT_BRANCH: $GIT_BRANCH, GIT_COMMIT: $GIT_COMMIT"

echo "[INFO] Creating a subnet for tests"
if ! docker network ls | awk '{print $2}' | grep -q $NETWORK_NAME; then
    echo "[INFO] Creating a network $NETWORK_NAME"
    docker network create --subnet $SUBNET --gateway $GATEWAY_HOST $NETWORK_NAME
else
    echo "[INFO] The network $NETWORK_NAME already up."
fi

if ! docker ps | awk '{print $2}' | grep -q $PROXY_NAME; then
    echo "[INFO] Starting Squid proxy server"
    docker run --net $NETWORK_NAME --ip $PROXY_IP --add-host snowflake.reg.local:$GATEWAY_HOST -d $PROXY_NAME
else
    echo "[INFO] Squid proxy server already up."
fi

declare -A TARGET_TEST_IMAGES
if [[ -n "$TARGET_PLATFORM" ]]; then
    IMAGE_NAME=${TEST_IMAGE_NAMES[$target_platform]}
    if [[ -z "$IMAGE_NAME" ]]; then
        echo "[ERROR] The target platform $TARGET_PLATFORM doesn't exist. Check $THIS_DIR/_init.sh"
        exit 1
    fi
    TARGET_TEST_IMAGES=([$TARGET_PLATFORM]=$IMAGE_NAME)
else
    for name in "${!TEST_IMAGE_NAMES[@]}"; do
        TARGET_TEST_IMAGES[$name]=${TEST_IMAGE_NAMES[$name]}
    done
fi

export USERID=$(id -u $(whoami))
for name in "${!TARGET_TEST_IMAGES[@]}"; do
    echo "[INFO] Testing $DRIVER_NAME on $name"
    docker pull "${TARGET_TEST_IMAGES[$name]}"
    docker run \
        --net $NETWORK_NAME \
        -v $THIS_DIR:/mnt/host \
        -v $WORKSPACE:/mnt/workspace \
        --add-host snowflake.reg.local:$GATEWAY_HOST \
        --add-host testaccount.reg.snowflakecomputing.com:$GATEWAY_HOST \
        --add-host snowflake.reg.snowflakecomputing.com:$GATEWAY_HOST \
        --add-host externalaccount.reg.local.snowflakecomputing.com:$GATEWAY_HOST \
        -e LOCAL_USER_ID=$(id -u $USER) \
        -e USERID \
        -e PROXY_IP \
        -e PROXY_PORT \
        -e GIT_COMMIT \
        -e GIT_BRANCH \
        -e GIT_URL \
        -e AWS_ACCESS_KEY_ID \
        -e AWS_SECRET_ACCESS_KEY \
        "${TARGET_TEST_IMAGES[$name]}" \
        "/mnt/host/container/test_component.sh"
done
