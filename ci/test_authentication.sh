#!/bin/bash -e

set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export WORKSPACE=${WORKSPACE:-/tmp}

source "$THIS_DIR/setup_gpg_home.sh"

gpg --quiet --batch --yes --decrypt --passphrase="$PARAMETERS_SECRET" --output $THIS_DIR/../.github/workflows/parameters_aws_auth_tests.json "$THIS_DIR/../.github/workflows/parameters_aws_auth_tests.json.gpg"
gpg --quiet --batch --yes --decrypt --passphrase="$PARAMETERS_SECRET" --output $THIS_DIR/../.github/workflows/rsa_keys/rsa_encrypted_key.p8 "$THIS_DIR/../.github/workflows/rsa_keys/rsa_encrypted_key.p8.gpg"
gpg --quiet --batch --yes --decrypt --passphrase="$PARAMETERS_SECRET" --output $THIS_DIR/../.github/workflows/rsa_keys/rsa_key.p8 "$THIS_DIR/../.github/workflows/rsa_keys/rsa_key.p8.gpg"
gpg --quiet --batch --yes --decrypt --passphrase="$PARAMETERS_SECRET" --output $THIS_DIR/../.github/workflows/rsa_keys/rsa_key_invalid.p8 "$THIS_DIR/../.github/workflows/rsa_keys/rsa_key_invalid.p8.gpg"

# NOTE:
# To run on MacOS, add -mac suffix to the image name or build it manually from snowflakedb/snowdrivers-test-commons
docker run \
  -v $(cd $THIS_DIR/.. && pwd):/mnt/host \
  -v $WORKSPACE:/mnt/workspace \
  --rm \
  artifactory.ci1.us-west-2.aws-dev.app.snowflake.com/internal-production-docker-snowflake-virtual/docker/snowdrivers-test-external-browser:14 \
  "/mnt/host/ci/container/test_authentication.sh"
