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
echo "[DEBUG] Packing"
npm pack
echo "[DEBUG] Installing"
npm install
rm -f ~/.npmrc

echo "[INFO] Uploading Artifacts"
ARTIFACTS=($(ls snowflake-sdk*))
export ARTIFACTS
export DRIVER_NAME=nodejs
source $THIS_DIR/upload_artifact.sh
