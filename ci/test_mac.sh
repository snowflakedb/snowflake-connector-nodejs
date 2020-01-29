#!/bin/bash -e
#
# Test NodeJS for Mac
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/_init.sh
source $THIS_DIR/set_git_info.sh

export WORKSPACE=$GITHUB_WORKSPACE
export CI_ROOT=$GITHUB_WORKSPACE/ci
$THIS_DIR/container/test_component.sh
