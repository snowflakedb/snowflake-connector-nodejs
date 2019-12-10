#!/bin/bash -e
#
# Build NodeJS Driver
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
[[ -z "$GIT_BRANCH" ]] && echo "Set GIT_BRANCH to build" && exit 1
[[ -z "$GIT_URL" ]] && echo "Set GIT_URL to build" && exit 1
echo "[INFO] checking out from branch $GIT_BRANCH"
git clone $GIT_URL target
cd target
git checkout --track $GIT_BRANCH
if [[ -n "$GIT_COMMIT" ]]; then
    echo "[INFO] Checking out with the commit hash $GIT_COMMIT"
    git checkout $GIT_COMMIT
else
    GIT_COMMIT=$(git rev-parse HEAD)
    echo "[INFO] Resetting the commit hash to $GIT_COMMIT"
fi
echo "[INFO] Building"
npm pack
npm install --package-lock-only
# The internal repository 10.180.20.84 doesn't support audit command.
# We no longer use this repo and need to find out it the new version does support audit.
rm -f ~/.npmrc
npm audit
PACKAGE_NAME=$(ls snowflake-sdk*)
echo aws s3 cp --only-show-errors $PACKAGE_NAME s3://sfc-jenkins/repository/nodejs/$GIT_BRANCH/$GIT_COMMIT/
aws s3 cp --only-show-errors $PACKAGE_NAME s3://sfc-jenkins/repository/nodejs/$GIT_BRANCH/$GIT_COMMIT/
