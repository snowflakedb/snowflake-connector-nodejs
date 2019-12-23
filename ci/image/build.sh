#!/bin/bash -e
#
# Build Docker images
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/../_init.sh

docker build -f $THIS_DIR/Dockerfile.build -t $BUILD_IMAGE_NAME .
docker push $BUILD_IMAGE_NAME
