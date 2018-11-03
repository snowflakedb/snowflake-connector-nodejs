#!/bin/bash -e
#
# Run NodeJS Driver tests
#
set -o pipefail
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

TEST_TIMEOUT=90000

source $DIR/env.sh
echo "[INFO] mocha: $(which mocha) - $(mocha --version)"
ERR=
if [[ -e "system_test" ]]; then
    echo "[INFO] Running System Tests"
    mocha system_test --timeout 90000 --reporter xunit --reporter-options output=$DIR/../junit-system-test.xml || ERR=1
fi
echo "[INFO] Running Tests"
mocha --recursive test/**/*.js --timeout 90000 --reporter xunit --reporter-options output=$DIR/../junit.xml
# exit 1 if the test failed.
[[ -n "$ERR" ]] && exit 1 || exit 0
