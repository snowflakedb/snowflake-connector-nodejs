#!/bin/bash -e
#
# Build NodeJS
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/_init.sh
source $THIS_DIR/scripts/login_internal_docker.sh

if [[ -z "$GITHUB_ACTIONS" ]]; then
    export GIT_URL=${GIT_URL:-https://github.com/snowflakedb/snowflake-connector-nodejs.git}
    export GIT_BRANCH=${GIT_BRANCH:-origin/$(git rev-parse --abbrev-ref HEAD)}
    export GIT_COMMIT=${GIT_COMMIT:-$(git rev-parse HEAD)}
else
    export GIT_URL=https://github.com/${GITHUB_REPOSITORY}.git
    export GIT_BRANCH=origin/$(basename ${GITHUB_REF})
    export GIT_COMMIT=${GITHUB_SHA}
fi

echo "GIT_URL: $GIT_URL, GIT_BRANCH: $GIT_BRANCH, GIT_COMMIT: $GIT_COMMIT"
