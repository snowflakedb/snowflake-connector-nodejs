#!/bin/bash -e
#
# Test NodeJS for Mac
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/_init.sh
source $THIS_DIR/set_git_info.sh

export WORKSPACE=$GITHUB_WORKSPACE
$THIS_DIR/container/test_component.sh
