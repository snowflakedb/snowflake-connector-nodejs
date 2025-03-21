#!/bin/bash -e

set -o pipefail

AUTH_PARAMETER_FILE=./.github/workflows/parameters_aws_auth_tests.json
eval $(jq -r '.authtestparams | to_entries | map("export \(.key)=\(.value|tostring)")|.[]' $AUTH_PARAMETER_FILE)

export SNOWFLAKE_AUTH_TEST_PRIVATE_KEY_PATH=./.github/workflows/rsa_keys/rsa_key.p8
export SNOWFLAKE_AUTH_TEST_ENCRYPTED_PRIVATE_KEY_PATH=./.github/workflows/rsa_keys/rsa_encrypted_key.p8
export SNOWFLAKE_AUTH_TEST_INVALID_PRIVATE_KEY_PATH=./.github/workflows/rsa_keys/rsa_key_invalid.p8

npm run test:authentication