#!/bin/bash -e
#
# Set the environment variables for tests
#

set -o pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Default parameter file for internal tests
DEFAULT_PARAMETER_FILE=$( cd "$DIR/../test" && pwd)/parameters.json

# Public CI parameter file
PARAMETER_FILE=$( cd "$DIR/.." && pwd)/parameters.json

# Error out if neither parameter file exist.
[[ ! -e "$PARAMETER_FILE" ]] && [[ ! -e "$DEFAULT_PARAMETER_FILE" ]] && echo "The parameter file doesn't exist: $PARAMETER_FILE" && exit 1

if [[ ! -e "$PARAMETER_FILE" ]]; then
    # Use the default parameter file if Public CI parameter file doesn't exist.
    PARAMETER_FILE=$DEFAULT_PARAMETER_FILE
fi

eval $(jq -r '.testconnection | to_entries | map("export \(.key)=\(.value|tostring)")|.[]' $PARAMETER_FILE)

if [[ -n "$TRAVIS_JOB_ID" ]]; then
    echo "==> Set the test schema to TRAVIS_JOB_${TRAVIS_JOB_ID}"
    export SNOWFLAKE_TEST_SCHEMA=TRAVIS_JOB_${TRAVIS_JOB_ID}
fi

echo "==> Test Connection Parameters"
env | grep SNOWFLAKE | grep -v PASSWORD
