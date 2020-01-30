#!/bin/bash -e
#
# Test NodeJS for Mac
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/_init.sh
source $THIS_DIR/scripts/set_git_info.sh

export WORKSPACE=$GITHUB_WORKSPACE
export CI_ROOT=$GITHUB_WORKSPACE/ci
python3 -m venv venv
source venv/bin/activate
pip3 install -U pip
pip3 install -U snowflake-connector-python
$THIS_DIR/container/test_component.sh
