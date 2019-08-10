#!/bin/bash -e
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
~/WebStorm/bin/format.sh -mask "*.js" -settings $THIS_DIR/../webstorm-codestyle.xml -R $(pwd)/lib/ -R $(pwd)/test -R $(pwd)/system_test
