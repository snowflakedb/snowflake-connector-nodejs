#!/bin/bash -e
#
# Upload Artifact
#
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
[[ -z "$DRIVER_NAME" ]] && echo "Set DRIVER_NAME to upload the artifact" && exit 1
[[ -z "$GIT_BRANCH" ]] && echo "Set GIT_BRANCH to upload the artifact" && exit 1
[[ -z "$GIT_COMMIT" ]] && echo "Set GIT_COMMIT to upload the artifact" && exit 1
[[ -z "$ARTIFACTS" ]] && echo "Set ARTIFACTS to upload the artifact" && exit 1

if ! git status; then
    echo "[ERROR] Must be in the GIT repo directory."
fi
if [[ -z "$GITHUB_ACTIONS" ]]; then
    BRANCH=$(basename $GIT_BRANCH)
    for f in "${ARTIFACTS[@]}"; do
        echo $f
        echo "[INFO] aws s3 cp --only-show-errors $f s3://sfc-jenkins/repository/$DRIVER_NAME/$BRANCH/${GIT_COMMIT}/"
        aws s3 cp --only-show-errors $f s3://sfc-jenkins/repository/$DRIVER_NAME/$BRANCH/${GIT_COMMIT}/
        COMMIT_FILE=$(mktemp)
        cat > $COMMIT_FILE <<COMMIT_FILE_CONTENTS
${GIT_COMMIT}
COMMIT_FILE_CONTENTS
        aws s3 cp --only-show-errors $COMMIT_FILE s3://sfc-jenkins/repository/$DRIVER_NAME/$BRANCH/latest_commit
        rm -f $COMMIT_FILE
    done
else
    ls -l /mnt/host
    ls -l /mnt/host/..
    mkdir -p /mnt/host/../artifacts
    for f in "${ARTIFACTS[@]}"; do
        echo "[INFO] cp $f /mnt/host/artifacts"
        cp $f /mnt/host/../artifacts
    done
    echo "DIR"
    ls /mnt/host
    echo "DIR"
    ls /mnt/host/..
    echo "DIR"
    ls /mnt/host/../artifacts
fi
