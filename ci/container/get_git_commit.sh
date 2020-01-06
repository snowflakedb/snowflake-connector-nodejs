#!/bin/bash -e
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
[[ -z "$GIT_BRANCH" ]] && echo "Set GIT_BRANCH to build" && exit 1
[[ -z "$GIT_URL" ]] && echo "Set GIT_URL to build" && exit 1

if [[ -n "$GIT_COMMIT" ]]; then
    echo "[INFO] Checking out with the commit hash $GIT_COMMIT"
    git checkout $GIT_COMMIT
else
    export GIT_COMMIT=$(git rev-parse HEAD)
    echo "[INFO] Resetting the commit hash to $GIT_COMMIT"
fi
