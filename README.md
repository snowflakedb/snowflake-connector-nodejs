********************************************************************************
NodeJS Driver for Snowflake
********************************************************************************
<p>
  <a href="https://github.com/snowflakedb/snowflake-connector-nodejs/actions?query=workflow%3A%22Build+and+Test%22+branch%3Amaster" target="_blank"><img src="https://github.com/snowflakedb/snowflake-connector-nodejs/workflows/Build%20and%20Test/badge.svg?branch=master" alt="master" /></a>
  <a href="https://www.npmjs.com/package/snowflake-sdk" target="_blank"><img src="https://img.shields.io/npm/v/snowflake-sdk.svg" alt="npm" /></a> 
  <a href="http://www.apache.org/licenses/LICENSE-2.0.txt" target="_blank"><img src="http://img.shields.io/:license-Apache%202-brightgreen.svg" alt="apache" /> </a>
</p>

Install
======================================================================

Include ``snowflake-sdk`` in ``dependencies`` section in ``package.json``
<pre><code>
{
  "name": "<your_application_name>",
  "version": "<your_application_version>",
  "dependencies": {
    "...": "...",        
    "snowflake-sdk": "^1.1.0",
    "...": "..."
  }
}
</code></pre>  
And run the <code>npm install</code>

Docs
======================================================================

For detailed documentation and basic usage examples, please see the documentation 
at `NodeJS Driver for Snowflake <https://docs.snowflake.net/manuals/user-guide/nodejs-driver.html>`_

Test
======================================================================

Prepare for Test
----------------------------------------------------------------------

Set the Snowflake connection info in ``parameters.json`` and place it in $HOME:
<pre><code>
{
  "testconnection": {
    "SNOWFLAKE_TEST_USER":      "&lt;your_user&gt;",
    "SNOWFLAKE_TEST_PASSWORD":  "&lt;your_password&gt;",
    "SNOWFLAKE_TEST_ACCOUNT":   "&lt;your_account&gt;",
    "SNOWFLAKE_TEST_WAREHOUSE": "&lt;your_warehouse&gt;",
    "SNOWFLAKE_TEST_DATABASE":  "&lt;your_database&gt;",
    "SNOWFLAKE_TEST_SCHEMA":    "&lt;your_schema&gt;",
    "SNOWFLAKE_TEST_ROLE":      "&lt;your_role&gt;"
  }
}
</code></pre>

Run Tests
----------------------------------------------------------------------
<pre><code>
npm test
</code></pre>

To specify which test to run, change the "test" value on "package.json":
<pre><code>
"scripts": {
  "test": "mocha test/unit/snowflake_test.js"
},
</code></pre>  

To run all unit test:
<pre><code>
"scripts": {
  "test": "mocha test/unit/**/*.js"
},
</code></pre>  

Package
======================================================================

The npm package can be built by the command:
<pre><code>
npm pack
</code></pre>  

Note it is not required to build a package to run tests blow.

Development
======================================================================

Reformat Source code
----------------------------------------------------------------------

Use WebStorm code style file to format the source code.
<pre><code>
format.sh -mask "*.js" -settings $(pwd)/webstorm-codestyle.xml -R $(pwd)/lib/ -R $(pwd)/test -R $(pwd)/system_test
</code></pre>  
