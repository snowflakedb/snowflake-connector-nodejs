cd %GITHUB_WORKSPACE%
gpg --quiet --batch --yes --decrypt --passphrase=%PARAMETERS_SECRET% --output parameters.json .github/workflows/parameters_aws.json.gpg
copy artifacts\* .
copy ci\container\package.json .

echo @echo off>parameters.bat
jq -r ".testconnection | to_entries | map(\"set \(.key)=\(.value)\") | .[]" parameters.json >> parameters.bat
call parameters.bat
if %ERRORLEVEL% NEQ 0 (
    echo === failed to set the test parameters
    exit /b 1
)
npm install
for %%f in (snowflake-sdk*.tgz) do npm install %%f
mocha --timeout 90000 --recursive --full-trace --color test/**/*.js
