#!/bin/bash -e
#
# Build Squid proxy server image
#

set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/../../_init.sh

cd $THIS_DIR
# Squid without auth
docker build -f $THIS_DIR/Dockerfile -t $INTERNAL_CLIENT_REPO/squid .
docker push $INTERNAL_CLIENT_REPO/squid

# Squid with auth
docker build -f $THIS_DIR/Dockerfile.auth -t $INTERNAL_CLIENT_REPO/squid-auth .
docker push $INTERNAL_CLIENT_REPO/squid-auth
