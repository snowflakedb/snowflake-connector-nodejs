#!/bin/bash -ex
#
# Build NodeJS
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/_init.sh

export GIT_URL=${GIT_URL:-https://github.com/snowflakedb/snowflake-connector-nodejs.git}
export GIT_BRANCH=${GIT_BRANCH:-origin/$(git rev-parse --abbrev-ref HEAD)}
export GIT_COMMIT=${GIT_COMMIT:-$(git rev-parse HEAD)}

echo "GIT_URL: $GIT_URL, GIT_BRANCH: $GIT_BRANCH, GIT_COMMIT; $GIT_COMMIT"

for name in "${!BUILD_IMAGE_NAMES[@]}"; do
    echo "[INFO] Building $DRIVER_NAME on $name"
    docker pull "${BUILD_IMAGE_NAMES[$name]}"
    docker run \
        -v $THIS_DIR:/mnt/host \
        -e LOCAL_USER_ID=$(id -u $USER) \
        -e GIT_URL \
        -e GIT_BRANCH \
        -e GIT_COMMIT \
        -e AWS_ACCESS_KEY_ID \
        -e AWS_SECRET_ACCESS_KEY \
        "${BUILD_IMAGE_NAMES[$name]}" \
        "/mnt/host/container/build_component.sh"
done
