#!/bin/bash -e
#
# Test NodeJS for Mac
#

echo "DOWNLOADED"
echo $(ls /Users/runner/work/snowflake-connector-nodejs/snowflake-connector-nodejs/)
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/_init.sh
source $THIS_DIR/scripts/set_git_info.sh


export WORKSPACE=$GITHUB_WORKSPACE
export SOURCE_ROOT=$GITHUB_WORKSPACE
export SHOULD_GENERATE_COVERAGE_REPORT=1
export SNOWFLAKE_TEST_CA_BUNDLE_FILE=$THIS_DIR/../libsfclient/cacert.pem

python3 --version
python3 -m venv venv
source venv/bin/activate
pip3 install -U pip
pip3 install -U snowflake-connector-python
$THIS_DIR/container/test_component.sh $SHOULD_GENERATE_COVERAGE_REPORT
