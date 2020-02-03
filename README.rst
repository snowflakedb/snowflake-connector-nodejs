********************************************************************************
NodeJS Driver for Snowflake
********************************************************************************

.. image:: https://github.com/snowflakedb/snowflake-connector-nodejs/workflows/Build%20and%20Test/badge.svg?branch=master
       :target: https://github.com/snowflakedb/snowflake-connector-nodejs/actions?query=workflow%3A%22Build+and+Test%22+branch%3Amaster

.. image:: https://img.shields.io/npm/v/snowflake-sdk.svg
       :target: https://www.npmjs.com/package/snowflake-sdk

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
        "...": "...",
        "snowflake-sdk": "^1.1.0",
        "...": "..."
      }
    }

And run the :code:`npm install`.

Docs
======================================================================

For detailed documentation and basic usage examples, please see the documentation 
at `NodeJS Driver for Snowflake <https://docs.snowflake.net/manuals/user-guide/nodejs-driver.html>`_

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

Development
======================================================================

Reformat Source code
----------------------------------------------------------------------

Use WebStorm code style file to format the source code.

.. code-block:: bash

    format.sh -mask "*.js" -settings $(pwd)/webstorm-codestyle.xml -R $(pwd)/lib/ -R $(pwd)/test -R $(pwd)/system_test
