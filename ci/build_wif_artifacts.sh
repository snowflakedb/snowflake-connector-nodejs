#!/bin/bash -e
#
# Builds the WIF e2e test artifacts on the Jenkins node, inside the
# Node build image (which carries npm). The resulting tree is staged
# as ci/wif/artifacts/wif_tests.tar.gz so the outer ci/test_wif.sh
# can scp it to the bare WIF cloud VMs and run the tests there. This
# avoids the VMs needing to pull source from GitHub.
#
set -o pipefail

THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$THIS_DIR/.." && pwd )"
ARTIFACT_DIR="$THIS_DIR/wif/artifacts"
source "$THIS_DIR/_init.sh"

cd "$REPO_ROOT"
rm -rf "$ARTIFACT_DIR"
mkdir -p "$ARTIFACT_DIR"

BUILD_IMAGE="${BUILD_IMAGE_NAMES[nodejs-chainguard-node18]}"
echo "Using build image: $BUILD_IMAGE"
docker pull "$BUILD_IMAGE"

echo "Installing dependencies and compiling TypeScript for WIF tests..."
docker run \
    --rm \
    -v "$REPO_ROOT":/mnt/host \
    -e LOCAL_USER_ID=$(id -u $USER) \
    -w /mnt/host \
    "$BUILD_IMAGE" \
    bash -c "npm install && npm run prepack"

echo "Creating wif_tests.tar.gz..."
tar czf "$ARTIFACT_DIR/wif_tests.tar.gz" \
    --exclude='.git' \
    --exclude='ci/wif/artifacts' \
    --exclude='ci/wif/rsa_wif_aws_azure' \
    --exclude='ci/wif/rsa_wif_gcp' \
    --exclude='ci/wif/parameters_wif.json' \
    --exclude='coverage' \
    --exclude='.nyc_output' \
    -C "$REPO_ROOT" .

echo "WIF artifacts staged in $ARTIFACT_DIR:"
ls -la "$ARTIFACT_DIR"
