#!/bin/bash -e
#
# Download Artifact
#
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
[[ -z "$DRIVER_NAME" ]] && echo "Set DRIVER_NAME to download the artifact" && exit 1
[[ -z "$GIT_BRANCH" ]] && echo "Set GIT_BRANCH to download the artifact" && exit 1
[[ -z "$GIT_COMMIT" ]] && echo "Set GIT_COMMIT to download the artifact" && exit 1

if ! git status; then
    echo "[ERROR] Must be in the GIT repo directory."
fi
if [[ -z "$GITHUB_ACTIONS" ]]; then
    BRANCH=$(basename $GIT_BRANCH)
    # LATEST_COMMIT=$(aws s3 cp --only-show-errors s3://sfc-jenkins/repository/$DRIVER_NAME/$BRANCH/latest_commit -)
    aws s3 cp --only-show-errors s3://sfc-jenkins/repository/$DRIVER_NAME/$BRANCH/${GIT_COMMIT}/ $HOME --recursive
else
    cp /mnt/workspace/artifacts/* $HOME
    ls -l $HOME
fi
