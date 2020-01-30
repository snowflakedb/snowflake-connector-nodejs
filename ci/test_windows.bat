cd %GITHUB_WORKSPACE%
gpg --quiet --batch --yes -decrypt --passphrase=%PARAMETERS_SECRET% --output parameters.json .github/workflows/parameters_aws.json.gpg
dir
