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
echo "[INFO] npm version"
npm -v
echo "[INFO] node version"
node -v



echo "[INFO] curl node"
curl -sL https://rpm.nodesource.com/setup_14.x | bash -

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
