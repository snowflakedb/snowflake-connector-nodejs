#!/bin/bash -e
export INTERNAL_REPO=nexus.int.snowflakecomputing.com:8086
export INTERNAL_CLIENT_REPO=$INTERNAL_REPO/docker/client

export DRIVER_NAME=nodejs

# Build images
BUILD_IMAGE_VERSION=1

declare -A BUILD_IMAGE_NAMES=(
    [$DRIVER_NAME-centos6-default]=$INTERNAL_CLIENT_REPO/$DRIVER_NAME/centos6/default/build:$BUILD_IMAGE_VERSION
)
export BUILD_IMAGE_NAMES

# Test Images
TEST_IMAGE_VERSION=1

declare -A TEST_IMAGE_NAMES=(
    [$DRIVER_NAME-centos6-default]=$INTERNAL_CLIENT_REPO/$DRIVER_NAME/centos6/default/test:$BUILD_IMAGE_VERSION
    [$DRIVER_NAME-centos7-fips]=$INTERNAL_CLIENT_REPO/$DRIVER_NAME/centos7/fips/test:$BUILD_IMAGE_VERSION
)
export TEST_IMAGE_NAMES

NEXUS_USER=${USERNAME:-jenkins}
if [[ -z "$NEXUS_PASSWORD" ]]; then
    echo "[ERROR] Set NEXUS_PASSWORD to your LDAP password to access the internal repository!"
    exit 1
fi
if ! docker login --username "$NEXUS_USER" --password "$NEXUS_PASSWORD" $INTERNAL_REPO; then
    echo "[ERROR] Failed to connect to the nexus server. Verify the environment variable NEXUS_PASSWORD is set correctly for NEXUS_USER: $NEXUS_USER"
    exit 1
fi
