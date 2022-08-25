#!/bin/bash -e
#
# Test NodeJS for Linux
#
set -o pipefail

rm -f snowflake-sdk*.tgz
npm pack
npm install
rm -f ~/.npmrc
npm audit