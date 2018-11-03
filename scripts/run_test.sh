#!/bin/bash -e
#
# Run NodeJS Driver tests
#
set -o pipefail
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

TEST_TIMEOUT=90000

MOCHA_CMD=()
MOCHA_OPTS=("--timeout" "$TEST_TIMEOUT")
if [[ -z "$TRAVIS_JOB_ID" ]]; then
    MOCHA_CMD+=(
        "mocha"
    )
    MOCHA_OPTS+=(
        "--reporter" "xunit"
        "--reporter-options" "output=$DIR/../junit.xml"
    )
    rm -f $DIR/../junit*.xml
else
    MOCHA_CMD+=(
        "./node_modules/.bin/istanbul" "cover" "./node_modules/.bin/_mocha"
    )
fi

source $DIR/env.sh
echo "[INFO] mocha: $(which mocha) - $(mocha --version)"
ERR=
if [[ -e "system_test" ]]; then
    echo "[INFO] Running System Tests"
    ${MOCHA_CMD[@]} ${MOCHA_OPTS[@]} system_test || (echo "[ERROR] Failed." && ERR=1)
    cp -f $DIR/../junit.xml $DIR/../junit-system-test.xml || true
fi
echo "[INFO] Running Tests"
TESTS=$(find test -name "*.js")
${MOCHA_CMD[@]} ${MOCHA_OPTS[@]} ${TESTS} || ERR=1

# exit 1 if the test failed.
if [[ -n "$ERR" ]]; then
    echo "[ERROR] FAILED!"
    cat $DIR/../junit*.xml || true
    exit 1
else
    echo "[INFO] SUCCESS!"
    exit 0
fi
