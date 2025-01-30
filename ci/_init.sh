#!/bin/bash -e

export PLATFORM=$(echo $(uname) | tr '[:upper:]' '[:lower:]')
export INTERNAL_REPO=nexus.int.snowflakecomputing.com:8086
if [[ -z "$GITHUB_ACTIONS" ]]; then
    # Use the internal Docker Registry
    export DOCKER_REGISTRY_NAME=$INTERNAL_REPO/docker
    export WORKSPACE=${WORKSPACE:-/tmp}
else
    # Use Docker Hub
    export DOCKER_REGISTRY_NAME=snowflakedb
    export WORKSPACE=$GITHUB_WORKSPACE
fi

export DRIVER_NAME=nodejs

# Build images
BUILD_IMAGE_VERSION=1

# Test Images
TEST_IMAGE_VERSION=2

declare -A BUILD_IMAGE_NAMES=(
    [$DRIVER_NAME-chainguard-node18]=$DOCKER_REGISTRY_NAME/client-$DRIVER_NAME-chainguard-node18-build:$BUILD_IMAGE_VERSION
)
export BUILD_IMAGE_NAMES

declare -A TEST_IMAGE_NAMES=(
    [$DRIVER_NAME-chainguard-node18]=$DOCKER_REGISTRY_NAME/client-$DRIVER_NAME-chainguard-node18-test:$TEST_IMAGE_VERSION
    [$DRIVER_NAME-chainguard-node18-fips]=$DOCKER_REGISTRY_NAME/client-$DRIVER_NAME-chainguard-node18-fips-test:$TEST_IMAGE_VERSION
)
export TEST_IMAGE_NAMES

BASE_IMAGE_PATH=artifactory.int.snowflakecomputing.com/development-chainguard-virtual/snowflake.com
declare -A BASE_IMAGES=(
    [$DRIVER_NAME-chainguard-node18]=$BASE_IMAGE_PATH/"node:18-dev"
    [$DRIVER_NAME-chainguard-node18-fips]=$BASE_IMAGE_PATH/"node-fips:18-dev"
)
export BASE_IMAGES
