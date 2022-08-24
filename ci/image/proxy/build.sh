#!/bin/bash -e
#
# Build Squid proxy server image
#

set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/../../_init.sh

cd $THIS_DIR
# Squid without auth
docker build \
    --file $THIS_DIR/Dockerfile \
    --tag $DOCKER_REGISTRY_NAME/client-squid .

# Squid with auth
docker build \
    --file $THIS_DIR/Dockerfile.auth \
    --tag $DOCKER_REGISTRY_NAME/client-squid-auth .
