#!/bin/bash -e
#
# Test NodeJS
#
# - target_platform - the target platform key. It must be registered in _init.sh
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/_init.sh

export WORKSPACE=${WORKSPACE:-/tmp}
export NETWORK_NAME=proxytest
export PROXY_NAME=$DOCKER_REGISTRY_NAME/client-squid
export SUBNET=192.168.0.0/16
export PROXY_IP=192.168.0.100
export PROXY_PORT=3128
export GATEWAY_HOST=192.168.0.1
echo "[INFO] The host IP address: $GATEWAY_HOST"

#
# set Jenkins GIT parameters propagated from Build job.
# 
export client_git_url=${client_git_url:-https://github.com/snowflakedb/snowflake-connector-nodejs.git}
export client_git_branch=${client_git_branch:-origin/$(git rev-parse --abbrev-ref HEAD)}
export client_git_commit=${client_git_commit:-$(git log --pretty=oneline | head -1 | awk '{print $1}')}

#
# set GIT parameters used in the following scripts
#
export GIT_URL=$client_git_url
export GIT_BRANCH=$client_git_branch
export GIT_COMMIT=$client_git_commit
echo "GIT_BRANCH: $GIT_BRANCH, GIT_COMMIT: $GIT_COMMIT"

echo "[INFO] Creating a subnet for tests"
if ! docker network ls | awk '{print $2}' | grep -q $NETWORK_NAME; then
    echo "[INFO] Creating a network $NETWORK_NAME"
    docker network create --subnet $SUBNET --gateway $GATEWAY_HOST $NETWORK_NAME
else
    echo "[INFO] The network $NETWORK_NAME already up."
fi

for h in $(docker ps --filter "label=proxy-node" --format "{{.ID}}"); do
    echo "[INFO] Killing the existing proxy node"
    docker kill $h
done
echo "[INFO] Starting Squid proxy server"
docker run --net $NETWORK_NAME --ip $PROXY_IP --add-host snowflake.reg.local:$GATEWAY_HOST --label proxy-node -d $PROXY_NAME
exit 0

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
echo "[INFO] USERID=$USERID"
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
