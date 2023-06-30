REM 
REM Tests NodeJS Driver on Windows
REM
setlocal
set TIMEOUT=90000
python -m venv venv
call venv\scripts\activate
pip install -U snowflake-connector-python

cd %GITHUB_WORKSPACE%

if "%CLOUD_PROVIDER%"=="AZURE" (
  set ENCODED_PARAMETERS_FILE=.github/workflows/parameters_azure.json.gpg
) else if "%CLOUD_PROVIDER%"=="GCP" (
  set ENCODED_PARAMETERS_FILE=.github/workflows/parameters_gcp.json.gpg
) else if "%CLOUD_PROVIDER%"=="AWS" (
  set ENCODED_PARAMETERS_FILE=.github/workflows/parameters_aws.json.gpg
) else (
  echo === unknown cloud provider
  exit /b 1
)

gpg --quiet --batch --yes --decrypt --passphrase=%PARAMETERS_SECRET% --output parameters.json %ENCODED_PARAMETERS_FILE%

REM DON'T FORGET TO include @echo off here or the password may be leaked!
echo @echo off>parameters.bat
jq -r ".testconnection | to_entries | map(\"set \(.key)=\(.value)\") | .[]" parameters.json >> parameters.bat
call parameters.bat
if %ERRORLEVEL% NEQ 0 (
    echo === failed to set the test parameters
    exit /b 1
)
set SNOWFLAKE_TEST_SCHEMA=%RUNNER_TRACKING_ID:-=_%_%GITHUB_SHA%

echo [INFO] Account:   %SNOWFLAKE_TEST_ACCOUNT%
echo [INFO] User   :   %SNOWFLAKE_TEST_USER%
echo [INFO] Database:  %SNOWFLAKE_TEST_DATABASE%
echo [INFO] Schema:    %SNOWFLAKE_TEST_SCHEMA%
echo [INFO] Warehouse: %SNOWFLAKE_TEST_WAREHOUSE%
echo [INFO] Role:      %SNOWFLAKE_TEST_ROLE%

echo [INFO] Creating schema %SNOWFLAKE_TEST_SCHEMA%
pushd %GITHUB_WORKSPACE%\ci\container
python create_schema.py
popd

echo [INFO] Installing Test package
copy %GITHUB_WORKSPACE%\ci\container\package.json .
cmd /c npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] failed to install test packages
    exit /b 1
)
echo [INFO] Installing Snowflake NodeJS Driver
copy %GITHUB_WORKSPACE%\artifacts\* .
for %%f in (snowflake-sdk*.tgz) do cmd /c npm install %%f
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] failed to install the Snowflake NodeJS Driver
    exit /b 1
)
echo [INFO] Starting hang_webserver.py 12345
pushd %GITHUB_WORKSPACE%\ci\container
start /b python hang_webserver.py 12345 > hang_webserver.out 2>&1
popd

echo [INFO] Testing
cmd /c node_modules\.bin\mocha --timeout %TIMEOUT% --recursive --full-trace --color --reporter spec test/**/*.js
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] failed to run mocha
    exit /b 1
)

echo [INFO] Dropping schema %SNOWFLAKE_TEST_SCHEMA%
pushd %GITHUB_WORKSPACE%\ci\container
python drop_schema.py
popd
