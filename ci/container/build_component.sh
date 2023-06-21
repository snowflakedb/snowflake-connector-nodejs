#!/bin/bash -e
#
# Build NodeJS Driver
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

[[ -z "$GIT_BRANCH" ]] && echo "Set GIT_BRANCH to build" && exit 1
[[ -z "$GIT_URL" ]] && echo "Set GIT_URL to build" && exit 1

cd /mnt/host
echo "[INFO] Building"
rm -f snowflake-sdk*.tgz
echo "[DEBUG] Version"
npm version
echo "[DEBUG] Installing newer node - bundled npm version 6.0.1 does not support setting audit level"
export NVM_PARENT_DIR=`pwd`/ignore
mkdir -p $NVM_PARENT_DIR
export NVM_DIR="$NVM_PARENT_DIR/nvm"
cp -r /usr/local/nvm $NVM_DIR
source $NVM_DIR/nvm.sh && nvm install 10
echo "[DEBUG] Packing"
npm pack
echo "[DEBUG] Installing"
npm install
rm -f ~/.npmrc
echo "[DEBUG] Auditing"
npm audit --audit-level moderate # TODO SNOW-841052 fast-xml-parser has low vulnerability - when new version will be released `moderate` option should be removed

echo "[INFO] Uploading Artifacts"
ARTIFACTS=($(ls snowflake-sdk*))
export ARTIFACTS
export DRIVER_NAME=nodejs
source $THIS_DIR/upload_artifact.sh
