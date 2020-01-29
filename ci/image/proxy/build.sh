#!/bin/bash -e
#
# Build Squid proxy server image
#

set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/../../_init.sh

cd $THIS_DIR
# Squid without auth
docker build -f $THIS_DIR/Dockerfile -t $DOCKER_REGISTRY_NAME/client-squid .
docker push $DOCKER_REGISTRY_NAME/client-squid

# Squid with auth
docker build -f $THIS_DIR/Dockerfile.auth -t $DOCKER_REGISTRY_NAME/client-squid-auth .
docker push $DOCKER_REGISTRY_NAME/client-squid-auth
