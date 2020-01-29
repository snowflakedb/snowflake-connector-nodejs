#!/bin/bash -e
#
# Update Docker Registry
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/../_init.sh

source $THIS_DIR/../login_internal_docker.sh
source $THIS_DIR/../login_docker.sh

docker push $DOCKER_REGISTRY_NAME/client-squid
docker tag $DOCKER_REGISTRY_NAME/client-squid snowflakedb/client-squid
docker push snowflakedb/client-squid

docker push $DOCKER_REGISTRY_NAME/client-squid-auth
docker tag $DOCKER_REGISTRY_NAME/client-squid-auth snowflakedb/client-squid-auth
docker push snowflakedb/client-squid-auth
