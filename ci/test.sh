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

if [[ -z "$GITHUB_ACTIONS" ]]; then
    #
    # set Jenkins GIT parameters propagated from Build job.
    # 
    export client_git_url=${client_git_url:-https://github.com/snowflakedb/snowflake-connector-nodejs.git}
    export client_git_branch=${client_git_branch:-origin/$(git rev-parse --abbrev-ref HEAD)}
    export client_git_commit=${client_git_commit:-$(git log --pretty=oneline | head -1 | awk '{print $1}')}
else
    gpg --quiet --batch --yes --decrypt --passphrase="$PARAMETERS_SECRET" --output $THIS_DIR/../parameters.json $THIS_DIR/../.github/workflows/parameters_aws.json.gpg
    export client_git_url=https://github.com/${GITHUB_REPOSITORY}.git
    export client_git_branch=origin/$(basename ${GITHUB_REF})
    export client_git_commit=${GITHUB_SHA}
fi

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

echo "[INFO] Checking any proxy node"
for h in $(docker ps --filter "label=proxy-node" --format "{{.ID}}"); do
    echo "[INFO] Killing the existing proxy node"
    docker kill $h
done
echo "[INFO] Starting a proxy node"
docker run --net $NETWORK_NAME --ip $PROXY_IP --add-host snowflake.reg.local:$GATEWAY_HOST --label proxy-node -d $PROXY_NAME

declare -A TARGET_TEST_IMAGES
if [[ -n "$TARGET_IMAGE" ]]; then
    echo "[INFO] TARGET_IMAGE: $TARGET_IMAGE"
    IMAGE_NAME=${TEST_IMAGE_NAMES[$TARGET_IMAGE]}
    if [[ -z "$IMAGE_NAME" ]]; then
        echo "[ERROR] The target platform $TARGET_IMAGE doesn't exist. Check $THIS_DIR/_init.sh"
        exit 1
    fi
    TARGET_TEST_IMAGES=([$TARGET_IMAGE]=$IMAGE_NAME)
else
    echo "[ERROR] Set TARGET_IMAGE to the docker image name to run the test"
    for name in "${!TEST_IMAGE_NAMES[@]}"; do
        echo "  " $name
    done
    exit 2
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
        -e GITHUB_ACTIONS \
        -e GITHUB_SHA \
        -e RUNNER_TRACKING_ID \
        "${TARGET_TEST_IMAGES[$name]}" \
        "/mnt/host/container/test_component.sh"
    echo "[INFO] Test Results: $WORKSPACE/junit*,xml"
done
