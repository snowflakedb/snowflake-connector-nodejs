#!/bin/bash -e
#
# Build NodeJS Driver
#
set -o pipefail

echo "[INFO] Building"
rm -f snowflake-sdk*.tgz
npm pack
npm install
rm -f ~/.npmrc
npm audit


echo "[INFO] Uploading Artifacts"
ARTIFACTS=($(ls snowflake-sdk*))
export ARTIFACTS
export DRIVER_NAME=nodejs
source $THIS_DIR/upload_artifact.sh
