#!/bin/bash -e
#
# Download Artifact
#
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
[[ -z "$DRIVER_NAME" ]] && echo "Set DRIVER_NAME to download the artifact" && exit 1
[[ -z "$GIT_BRANCH" ]] && echo "Set GIT_BRANCH to download the artifact" && exit 1
[[ -z "$GIT_COMMIT" ]] && echo "Set GIT_COMMIT to download the artifact" && exit 1
[[ -z "$WORKSPACE" ]] && echo "Set WORKSPACE to download the artifact" && exit 1

if [[ -z "$GITHUB_ACTIONS" ]]; then
    BRANCH=$(basename $GIT_BRANCH)
    # LATEST_COMMIT=$(aws s3 cp --only-show-errors s3://sfc-eng-jenkins/repository/$DRIVER_NAME/$BRANCH/latest_commit -)
    echo "aws s3 cp --only-show-errors s3://sfc-eng-jenkins/repository/$DRIVER_NAME/$BRANCH/${GIT_COMMIT}/ $WORKSPACE --recursive"
    aws s3 cp --only-show-errors s3://sfc-eng-jenkins/repository/$DRIVER_NAME/$BRANCH/${GIT_COMMIT}/ $WORKSPACE --recursive
elif [[ -e "$WORKSPACE/artifacts/" ]]; then
    # Linux Container
    echo "[INFO] cp $WORKSPACE/artifacts/* $WORKSPACE"
    cp $WORKSPACE/artifacts/* $WORKSPACE
    ls -l $WORKSPACE
else
    echo "[ERROR] No $WORKSPACE/artifacts exists"
    ls -l $WORKSPACE
    exit 1
fi
