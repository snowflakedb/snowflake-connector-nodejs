#!/bin/bash -e
#
# Test NodeJS for Linux
#
# - TARGET_DOCKER_TEST_IMAGE - the target Docker image key. It must be registered in _init.sh
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/_init.sh

export WORKSPACE=${WORKSPACE:-/tmp}

source $THIS_DIR/scripts/set_git_info.sh

declare -A TARGET_TEST_IMAGES
if [[ -n "$TARGET_DOCKER_TEST_IMAGE" ]]; then
    echo "[INFO] TARGET_DOCKER_TEST_IMAGE: $TARGET_DOCKER_TEST_IMAGE"
    IMAGE_NAME=${TEST_IMAGE_NAMES[$TARGET_DOCKER_TEST_IMAGE]}
    if [[ -z "$IMAGE_NAME" ]]; then
        echo "[ERROR] The target platform $TARGET_DOCKER_TEST_IMAGE doesn't exist. Check $THIS_DIR/_init.sh"
        exit 1
    fi
    TARGET_TEST_IMAGES=([$TARGET_DOCKER_TEST_IMAGE]=$IMAGE_NAME)
else
    echo "[ERROR] Set TARGET_DOCKER_TEST_IMAGE to the docker image name to run the test"
    for name in "${!TEST_IMAGE_NAMES[@]}"; do
        echo "  " $name
    done
    exit 2
fi

export USERID=$(id -u $(whoami))
echo "[INFO] USERID=$USERID"
for name in "${!TARGET_TEST_IMAGES[@]}"; do
    echo "[INFO] Testing $DRIVER_NAME on $name"
    docker pull  "${TARGET_TEST_IMAGES[$name]}"
    docker run \
        --network=host \
        -v $(cd $THIS_DIR/.. && pwd):/mnt/host \
        -v $WORKSPACE:/mnt/workspace \
        -e LOCAL_USER_ID=$(id -u $USER) \
        -e LOCAL_USER_NAME=$USER \
        -e USERID \
        -e GIT_COMMIT \
        -e GIT_BRANCH \
        -e GIT_URL \
        -e AWS_ACCESS_KEY_ID \
        -e AWS_SECRET_ACCESS_KEY \
        -e GITHUB_ACTIONS \
        -e GITHUB_SHA \
        -e GITHUB_REF \
        -e GITHUB_EVENT_NAME \
        -e RUNNER_TRACKING_ID \
        "${TARGET_TEST_IMAGES[$name]}" \
        "/mnt/host/ci/container/test_component.sh"
    echo "[INFO] Test Results: $WORKSPACE/junit*,xml"
done
