#!/bin/bash -e
#
# Test NodeJS driver in Rocky Linux 9 Docker
# NOTES:
#   - Node.js major version MUST be specified as first argument
#   - Usage: ./test_rhel9_docker.sh "18"

set -o pipefail

if [[ -z "${1}" ]]; then
    echo "[ERROR] Node.js major version is required as first argument (e.g., '18', '20', '22')"
    echo "Usage: $0 <node_major_version>"
    exit 1
fi

NODE_VERSION=${1}

# Set constants
THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CONNECTOR_DIR="$( dirname "${THIS_DIR}")"
WORKSPACE=${WORKSPACE:-${CONNECTOR_DIR}}

cd ${THIS_DIR}/image

CONTAINER_NAME=test_nodejs_rockylinux9

echo "[INFO] Building docker image for Rocky Linux 9 with Node.js ${NODE_VERSION} (major version)"

# Get current user/group IDs to match host permissions
USER_ID=$(id -u)
GROUP_ID=$(id -g)

docker build --pull -t ${CONTAINER_NAME}:1.0 \
    --build-arg BASE_IMAGE=rockylinux:9 \
    --build-arg NODE_VERSION=$NODE_VERSION \
    --build-arg USER_ID=$USER_ID \
    --build-arg GROUP_ID=$GROUP_ID \
    . -f Dockerfile.rhel9

# Setup connection parameters - decrypt parameters.json before running container
if [[ -n "$PARAMETERS_SECRET" && -n "$CLOUD_PROVIDER" ]]; then
    if [[ "$CLOUD_PROVIDER" == "AZURE" ]]; then
        ENCODED_PARAMETERS_FILE="${CONNECTOR_DIR}/.github/workflows/parameters_azure.json.gpg"
    elif [[ "$CLOUD_PROVIDER" == "GCP" ]]; then
        ENCODED_PARAMETERS_FILE="${CONNECTOR_DIR}/.github/workflows/parameters_gcp.json.gpg"
    elif [[ "$CLOUD_PROVIDER" == "AWS" ]]; then
        ENCODED_PARAMETERS_FILE="${CONNECTOR_DIR}/.github/workflows/parameters_aws.json.gpg"
    else
        echo "[ERROR] Unknown cloud provider: $CLOUD_PROVIDER (must be AWS, AZURE, or GCP)"
        exit 1
    fi
    
    if [[ ! -f "$ENCODED_PARAMETERS_FILE" ]]; then
        echo "[ERROR] Encrypted parameters file not found: $ENCODED_PARAMETERS_FILE"
        exit 1
    fi
    
    echo "[INFO] Decrypting connection parameters for $CLOUD_PROVIDER"
    gpg --quiet --batch --yes --decrypt \
        --passphrase="$PARAMETERS_SECRET" \
        --output "${CONNECTOR_DIR}/parameters.json" \
        "$ENCODED_PARAMETERS_FILE"
    
    if [[ ! -f "${CONNECTOR_DIR}/parameters.json" ]]; then
        echo "[ERROR] Failed to decrypt parameters.json"
        exit 1
    fi
    echo "[INFO] Successfully decrypted parameters.json"

    # Decrypt RSA private key for keypair authentication if secret is available
    if [[ -n "$NODEJS_PRIVATE_KEY_SECRET" ]]; then
        if [[ "$CLOUD_PROVIDER" == "AZURE" ]]; then
            ENCODED_RSA_KEY_FILE="${CONNECTOR_DIR}/.github/workflows/rsa_keys/rsa_key_nodejs_azure.p8.gpg"
        elif [[ "$CLOUD_PROVIDER" == "GCP" ]]; then
            ENCODED_RSA_KEY_FILE="${CONNECTOR_DIR}/.github/workflows/rsa_keys/rsa_key_nodejs_gcp.p8.gpg"
        else
            ENCODED_RSA_KEY_FILE="${CONNECTOR_DIR}/.github/workflows/rsa_keys/rsa_key_nodejs_aws.p8.gpg"
        fi
        gpg --quiet --batch --yes --decrypt \
            --passphrase="$NODEJS_PRIVATE_KEY_SECRET" \
            --output "${CONNECTOR_DIR}/rsa_key_nodejs.p8" \
            "$ENCODED_RSA_KEY_FILE"
        chmod 600 "${CONNECTOR_DIR}/rsa_key_nodejs.p8"
        echo "[INFO] Decrypted RSA private key for keypair authentication"
    fi
elif [[ ! -f "${CONNECTOR_DIR}/parameters.json" ]]; then
    echo "[ERROR] parameters.json not found and PARAMETERS_SECRET/CLOUD_PROVIDER not provided"
    echo "[ERROR] Either provide PARAMETERS_SECRET and CLOUD_PROVIDER to decrypt, or manually decrypt parameters.json"
    exit 1
else
    echo "[INFO] Using existing parameters.json"
fi

# Run the container
# Mount source directory directly - permissions work because container user matches host user IDs
docker run --network=host \
    -e TERM=vt102 \
    -e JENKINS_HOME \
    -e GITHUB_ACTIONS \
    -e GITHUB_SHA \
    -e GITHUB_REF \
    -e GITHUB_REPOSITORY \
    -e GITHUB_EVENT_NAME \
    -e RUNNER_TRACKING_ID \
    -e CLOUD_PROVIDER \
    --mount type=bind,source="${CONNECTOR_DIR}",target=/home/user/snowflake-connector-nodejs,readonly=false \
    ${CONTAINER_NAME}:1.0 \
    bash -c "cd /home/user/snowflake-connector-nodejs && ci/container/test_rhel9_component.sh ${NODE_VERSION}"

