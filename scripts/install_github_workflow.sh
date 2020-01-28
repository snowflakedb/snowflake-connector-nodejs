#!/bin/bash -e
set -o pipefail

THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Decrypt the parameters.json"
gpg --quiet --batch --yes --decrypt --passphrase="$PARAMETERS_SECRET" --output $THIS_DIR/../parameters.json $THIS_DIR/../.github/workflows/parameters_aws.json.gpg

source $THIS_DIR/env.sh

pyenv local 3.6
pip install -U pip
pip --version
python -m venv env
source env/bin/activate
npm install
npm install istanbul
