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
echo "[DEBUG] Installing Build Dependencies"
npm install
echo "[DEBUG] Installing Cloud Dependencies"
if [[ "$CLOUD_PROVIDER" == "AZURE" ]]; then
    echo "Install Azure"
    npm install @azure/storage-blob
elif [[ "$CLOUD_PROVIDER" == "GCP" ]]; then
    echo "Install GCP"
    npm install @google-cloud/storage
elif [[ "$CLOUD_PROVIDER" == "AWS" ]]; then
    echo "Install AWS"
    npm install @aws-sdk/client-s3 
else
    echo "[ERROR] unknown cloud provider"
fi
echo "[DEBUG] Packing"
npm pack
rm -f ~/.npmrc

echo "[INFO] Uploading Artifacts"
ARTIFACTS=($(ls snowflake-sdk*))
export ARTIFACTS
export DRIVER_NAME=nodejs
source $THIS_DIR/upload_artifact.sh
