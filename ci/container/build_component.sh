#!/bin/bash -e
#
# Build NodeJS Driver
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

[[ -z "$GIT_BRANCH" ]] && echo "Set GIT_BRANCH to build" && exit 1
[[ -z "$GIT_URL" ]] && echo "Set GIT_URL to build" && exit 1

echo "[INFO] Checking out branch $GIT_BRANCH from $GIT_URL."
git clone $GIT_URL target
cd target
git checkout --track $GIT_BRANCH
source $THIS_DIR/get_git_commit.sh

echo "[INFO] Building"
npm pack
npm install --package-lock-only
# The internal repository 10.180.20.84 doesn't support audit command.
# We no longer use this repo and need to find out it the new version does support audit.
rm -f ~/.npmrc
npm audit

echo "[INFO] Uploading Artifacts"
ARTIFACTS=($(ls snowflake-sdk*))
export ARTIFACTS
source $THIS_DIR/upload_artifact.sh
