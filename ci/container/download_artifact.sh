#!/bin/bash -e
#
# Download Artifact
#
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
[[ -z "$DRIVER_NAME" ]] && echo "Set DRIVER_NAME to upload the artifact" && exit 1
[[ -z "$GIT_BRANCH" ]] && echo "Set GIT_BRANCH to upload the artifact" && exit 1
[[ -z "$GIT_COMMIT" ]] && echo "Set GIT_COMMIT to upload the artifact" && exit 1

if ! git status; then
    echo "[ERROR] Must be in the GIT repo directory."
fi
TS=$(TZ=UTC git show -s --date='format-local:%Y%m%dT%H%M%S' --format="%cd" $GIT_COMMIT)
echo "[INFO] aws s3 cp --only-show-errors s3://sfc-jenkins/repository/$DRIVER_NAME/$GIT_BRANCH/${TS}_${GIT_COMMIT}/ . --recursive"
aws s3 cp --only-show-errors s3://sfc-jenkins/repository/$DRIVER_NAME/$GIT_BRANCH/${TS}_${GIT_COMMIT}/ $HOME --recursive
