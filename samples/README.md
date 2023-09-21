********************************************************************************
NodeJS Driver - Samples
********************************************************************************

Install
======================================================================

In directory samples run `npm i`.

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

Run test to compare json parser
----------------------------------------------------------------------

By default, the test creates a table with 300000 rows of sample variant data (json format)
and measures the time and number of blocks while retrieving the results using two different 
methods to extract data.
1. Streaming results:  `stream.on('readable', ...)`
2. Events results:  `stream.on('data', ...)`
```
npm run jsonParserComparison
```
Test can be started with parameters:
 - number of rows in table, default=300000
 - number of selected rows, default=300000
 - only for choosen parser if got as last parameter: Function, vm, better-eval, JSON, default all

Example:
```
npm run jsonParserComparison 300000 300000 Function
```

 or 
 ```
npm run jsonParserComparison 300000 300000 JSON
```