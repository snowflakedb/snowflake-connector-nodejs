********************************************************************************
NodeJS Driver for Snowflake
********************************************************************************
<p>
  <a href="https://github.com/snowflakedb/snowflake-connector-nodejs/actions?query=workflow%3A%22Build+and+Test%22+branch%3Amaster" target="_blank"><img src="https://github.com/snowflakedb/snowflake-connector-nodejs/workflows/Build%20and%20Test/badge.svg?branch=master" alt="master" /></a>
  <a href="https://www.npmjs.com/package/snowflake-sdk" target="_blank"><img src="https://img.shields.io/npm/v/snowflake-sdk.svg" alt="npm" /></a> 
  <a href="http://www.apache.org/licenses/LICENSE-2.0.txt" target="_blank"><img src="http://img.shields.io/:license-Apache%202-brightgreen.svg" alt="apache" /> </a>
</p>


| :exclamation:        | For production-affecting issues related to the driver, please [create a case with Snowflake Support](https://community.snowflake.com/s/article/How-To-Submit-a-Support-Case-in-Snowflake-Lodge).   |
|---------------|:------------------------|

Install
======================================================================

Include ``snowflake-sdk`` in ``dependencies`` section in ``package.json``
```
{
  "name": "<your_application_name>",
  "version": "<your_application_version>",
  "dependencies": {
    "...": "...",        
    "snowflake-sdk": "^1.6.22",
    "...": "..."
  }
}
```
And run the <code>npm install</code>

Docs
======================================================================

For detailed documentation and basic usage examples, please see the documentation 
at <a href="https://docs.snowflake.net/manuals/user-guide/nodejs-driver.html">NodeJS Driver for Snowflake</a>.

Test
======================================================================

Prepare for tests
----------------------------------------------------------------------

Specify env variables:

```
export SNOWFLAKE_TEST_USER=<your_user>
export SNOWFLAKE_TEST_PASSWORD=<your_password>
export SNOWFLAKE_TEST_ACCOUNT=<your_account>
export SNOWFLAKE_TEST_WAREHOUSE=<your_warehouse>
export SNOWFLAKE_TEST_DATABASE=<your_database>
export SNOWFLAKE_TEST_SCHEMA=<your_schema>
export SNOWFLAKE_TEST_PROTOCOL=<your_snowflake_protocol>
export SNOWFLAKE_TEST_HOST=<your_snowflake_host>
export SNOWFLAKE_TEST_PORT=<your_snowflake_port>
```

Run hang webserver:
```
python3 ci/container/hang_webserver.py 12345 &
```

Run tests
----------------------------------------------------------------------

Run unit tests:
```
npm test
```
or
```
npm test:unit
```

To run single test file use `test:single` script, e.g. run tests in `test/unit/snowflake_test.js` only:

```
npm run test:single -- test/unit/snowflake_test.js
```

Run integration tests:
```
npm test:integration
```

Getting the code coverage
----------------------------------------------------------------------
1. Go to nodejs project directory
```
cd snowflake-connector-nodejs
```

2. Install the node connector
```
npm install .
```

3. Install the nyc module which displays the code coverage
```
npm install nyc
```

4. Edit the package.json file and replace the specified test with the one below:
```
"scripts": {
  "test": "nyc mocha test/**/*.js"
},
```

5. Using git bash, run the "npm test" command and include the connection parameters in the same line:
```
SNOWFLAKE_TEST_USER="user" SNOWFLAKE_TEST_PASSWORD="password" SNOWFLAKE_TEST_ACCOUNT="account" SNOWFLAKE_TEST_WAREHOUSE="warehouse" SNOWFLAKE_TEST_DATABASE="db" SNOWFLAKE_TEST_SCHEMA="schema" npm test
```

6. The code coverage results will be displayed in the console when the test finishes executing
<br>
Note: git bash is the console used for installing the node connector, the nyc module, and running "npm test"

Package
======================================================================

The npm package can be built by the command:
```
npm pack
```

Note it is not required to build a package to run tests blow.

Development
======================================================================

Reformat source code
----------------------------------------------------------------------

Use WebStorm code style file to format the source code.
```
format.sh -mask "*.js" -settings $(pwd)/webstorm-codestyle.xml -R $(pwd)/lib/ -R $(pwd)/test -R $(pwd)/system_test
```
