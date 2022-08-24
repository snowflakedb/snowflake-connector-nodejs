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

echo "[INFO] install sudo"
yum install sudo

export NVM_DIR=./nvm
echo "[INFO] mkdir"
sudo mkdir -p $NVM_DIR

echo "[INFO] install curl-devel"
sudo yum install curl-devel
echo "[INFO] install libcurl4-openssl-dev"
sudo yum install libcurl4-openssl-dev
echo "[INFO] install nvm"
sudo curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.1/install.sh | bash

echo "[INFO] source nvm"
source $NVM_DIR/nvm.sh \
  && nvm install $NODE_VERSION \
  && nvm alias default $NODE_VERSION \
  && nvm use default

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
