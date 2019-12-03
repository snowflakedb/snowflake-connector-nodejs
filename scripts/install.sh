#!/bin/bash -e
set -o pipefail

if [[ -n "$SNOWFLAKE_AZURE" ]]; then
    openssl aes-256-cbc -k "$super_azure_secret_password" -in parameters_az.json.enc -out parameters.json -d
elif [[ -n "$SNOWFLAKE_GCP" ]]; then
    openssl aes-256-cbc -k "$super_gcp_secret_password" -in parameters_gcp.json.enc -out parameters.json -d
else
    openssl aes-256-cbc -k "$super_secret_password" -in parameters.json.enc -out parameters.json -d
fi
pyenv local 3.6
pip install -U pip
pip --version
python -m venv env
source env/bin/activate
npm install
npm install istanbul
