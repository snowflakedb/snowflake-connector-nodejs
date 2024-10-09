#!/bin/bash -e
#
# Build Docker images
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/../_init.sh

for name in "${!BUILD_IMAGE_NAMES[@]}"; do
    docker build \
        --platform=linux/amd64 \
        --file $THIS_DIR/Dockerfile \
        --label snowflake \
        --label $DRIVER_NAME \
        --build-arg IMAGE=${BASE_IMAGES[$name]} \
        --tag ${BUILD_IMAGE_NAMES[$name]} .
done

for name in "${!TEST_IMAGE_NAMES[@]}"; do
    docker build \
        --platform=linux/amd64 \
        --file $THIS_DIR/Dockerfile \
        --label snowflake \
        --label $DRIVER_NAME \
        --build-arg IMAGE=${BASE_IMAGES[$name]} \
        --tag ${TEST_IMAGE_NAMES[$name]} .
done
