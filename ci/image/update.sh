#!/bin/bash -e
#
# Build Docker images
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/../_init.sh

source $THIS_DIR/../scripts/login_internal_docker.sh
source $THIS_DIR/../scripts/login_docker.sh
