#!/bin/bash -e
#
# Build Docker images
#
set -o pipefail
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source $THIS_DIR/../_init.sh

echo "[INFO] Login the internal Docker Resistry"
NEXUS_USER=${USERNAME:-jenkins}
if [[ -z "$NEXUS_PASSWORD" ]]; then
    echo "[ERROR] Set NEXUS_PASSWORD to your LDAP password to access the internal repository!"
    exit 1
fi
if ! docker login --username "$NEXUS_USER" --password "$NEXUS_PASSWORD" $INTERNAL_REPO; then
    echo "[ERROR] Failed to connect to the nexus server. Verify the environment variable NEXUS_PASSWORD is set correctly for NEXUS_USER: $NEXUS_USER"
    exit 1
fi
echo "[INFO] Login the Docker Hub"
if [[ -z "$DOCKER_HUB_USER" ]] || [[ -z "$DOCKER_HUB_TOKEN" ]]; then
    echo "[ERROR] Set DOCKER_HUB_USER and DOCKER_HUB_Token to push the images to the Docker Hub"
    exit 1
fi
docker login --username "$DOCKER_HUB_USER" --password "$DOCKER_HUB_TOKEN"

for image in $(docker images --format "{{.ID}},{{.Repository}}:{{.Tag}}" | grep "nexus.int.snowflakecomputing.com" | grep "client-$DRIVER_NAME"); do
    # echo $image
    target_id=$(echo $image | awk -F, '{print $1}')
    target_name=$(echo $image | awk -F, '{print $2}')
    for name in "${!BUILD_IMAGE_NAMES[@]}"; do
        if [[ "$target_name" == "${BUILD_IMAGE_NAMES[$name]}" ]]; then
            echo $name
            docker_hub_image_name=$(echo ${BUILD_IMAGE_NAMES[$name]/$DOCKER_REGISTRY_NAME/snowflakedb})
            set -x
            docker tag $target_id $docker_hub_image_name
            set +x
            docker push "${BUILD_IMAGE_NAMES[$name]}"
            docker push "$docker_hub_image_name"
        fi
    done
    for name in "${!TEST_IMAGE_NAMES[@]}"; do
        if [[ "$target_name" == "${TEST_IMAGE_NAMES[$name]}" ]]; then
            echo $name
            docker_hub_image_name=$(echo ${TEST_IMAGE_NAMES[$name]/$DOCKER_REGISTRY_NAME/snowflakedb})
            set -x
            docker tag $target_id $docker_hub_image_name
            set +x
            docker push "${TEST_IMAGE_NAMES[$name]}"
            docker push "$docker_hub_image_name"
        fi
    done
done
