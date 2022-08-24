#!/bin/bash -e
#
# Upload Artifact
#
    mkdir -p /mnt/workspace/artifacts
    for f in "${ARTIFACTS[@]}"; do
        echo "[INFO] cp $f /mnt/workspace/artifacts"
        cp $f /mnt/workspace/artifacts
    done
    ls /mnt/workspace/artifacts
