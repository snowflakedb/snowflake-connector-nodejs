********************************************************************************
Snowflake Connector for NodeJS
********************************************************************************

.. image:: https://travis-ci.org/snowflakedb/snowflake-connector-nodejs.svg?branch=master
    :target: https://travis-ci.org/snowflakedb/snowflake-connector-nodejs

.. image:: https://codecov.io/gh/snowflakedb/snowflake-connector-nodejs.svg
    :target: https://codecov.io/gh/snowflakedb/snowflake-connector-nodejs

.. image:: http://img.shields.io/:license-Apache%202-brightgreen.svg
    :target: http://www.apache.org/licenses/LICENSE-2.0.txt

Install
======================================================================

Include :code:`snowflake-sdk` in :code:`dependencies` section in :code:`package.json`:

.. code-block:: json

    {
      "name": "<your_application_name>",
      "version": "<your_application_version>",
      "dependencies": {
        ...
        "snowflake-sdk": "^1.1.0",
        ...
      }
    }

And run the :code:`npm install`.

Test
======================================================================

Prepare for Test
----------------------------------------------------------------------

Set the Snowflake connection info in ``parameters.json`` and place it in $HOME:

.. code-block:: json

    {
        "testconnection": {
            "SNOWFLAKE_TEST_USER":      "<your_user>",
            "SNOWFLAKE_TEST_PASSWORD":  "<your_password>",
            "SNOWFLAKE_TEST_ACCOUNT":   "<your_account>",
            "SNOWFLAKE_TEST_WAREHOUSE": "<your_warehouse>",
            "SNOWFLAKE_TEST_DATABASE":  "<your_database>",
            "SNOWFLAKE_TEST_SCHEMA":    "<your_schema>",
            "SNOWFLAKE_TEST_ROLE":      "<your_role>"
        }
    }

Run Tests
----------------------------------------------------------------------
.. code-block:: bash

    npm test

Package
======================================================================

The npm package can be built by the command:

.. code-block:: bash

    npm pack

Note it is not required to build a package to run tests blow.
