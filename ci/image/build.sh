#!/bin/bash -e
#
# Build Docker images
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/../_init.sh

for name in "${!BUILD_IMAGE_NAMES[@]}"; do


done

for name in "${!TEST_IMAGE_NAMES[@]}"; do


done
