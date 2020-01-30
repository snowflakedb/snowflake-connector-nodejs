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
echo [INFO] Account: %SNOWFLAKE_TEST_ACCOUNT%
echo [INFO] User: %SNOWFLAKE_TEST_USER%
cmd /c npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] failed to install test packages
    exit /b 1
)
echo [INFO] Installing Snowflake NodeJS Driver
for %%f in (snowflake-sdk*.tgz) do cmd /c npm install %%f
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] failed to install the Snowflake NodeJS Driver
    exit /b 1
)
echo [INFO] Testing
cmd /c node_modules\.bin\mocha --timeout 90000 --recursive --full-trace  test/**/*.js
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] failed to run mocha
    exit /b 1
)
