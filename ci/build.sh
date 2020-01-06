#!/bin/bash -e
#
# Build NodeJS
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/_init.sh

for name in "${!BUILD_IMAGE_NAMES[@]}"; do
    echo "[INFO] Building $DRIVER_NAME on $name"
    docker pull "${BUILD_IMAGE_NAMES[$name]}"
    docker run \
        -v $THIS_DIR:/mnt/host \
        -e GIT_COMMIT \
        -e GIT_BRANCH \
        -e GIT_URL \
        -e AWS_ACCESS_KEY_ID \
        -e AWS_SECRET_ACCESS_KEY \
        "${BUILD_IMAGE_NAMES[$name]}" \
        "/mnt/host/container/build_component.sh"
done
