#!/bin/bash -e
set -o pipefail

openssl aes-256-cbc -k "$super_secret_password" -in parameters.json.enc -out parameters.json -d
pyenv local 3.6
pip install -U pip
pip --version
python -m venv env
source env/bin/activate
npm install
npm install istanbul
