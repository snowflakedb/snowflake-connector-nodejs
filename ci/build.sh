#!/bin/bash -e
#
# Build NodeJS
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/_init.sh

docker pull $BUILD_IMAGE_NAME
docker run \
    -v $THIS_DIR:/mnt/host \
    -e GIT_COMMIT \
    -e GIT_BRANCH \
    -e GIT_URL \
    -e AWS_ACCESS_KEY_ID \
    -e AWS_SECRET_ACCESS_KEY \
    $BUILD_IMAGE_NAME \
    "/mnt/host/container/build_component.sh"
