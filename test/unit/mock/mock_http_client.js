/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var Util = require('../../../lib/util');
var Errors = require('../../../lib/errors');
const Logger = require('../../../lib/logger');

/**
 * Creates a new MockHttpClient.
 *
 * @param {Object} clientInfo
 *
 * @constructor
 */
function MockHttpClient(clientInfo)
{
  Errors.assertInternal(Util.exists(clientInfo) && Util.isObject(clientInfo));
  Errors.assertInternal(Util.exists(clientInfo.version) &&
    Util.isString(clientInfo.version));
  Errors.assertInternal(Util.exists(clientInfo.environment) &&
    Util.isObject(clientInfo.environment));

  this._clientInfo = clientInfo;
}

module.exports = MockHttpClient;

/**
 * Issues a request.
 *
 * @param {Object} request the request options.
 */
MockHttpClient.prototype.request = function (request)
{
  // build the request-to-output map if this is the first request
  if (!this._mapRequestToOutput)
  {
    this._mapRequestToOutput =
      buildRequestToOutputMap(buildRequestOutputMappings(this._clientInfo));
  }

  // Closing a connection includes a requestID as a query parameter in the url
  // Example: http://fake504.snowflakecomputing.com/session?delete=true&requestId=a40454c6-c3bb-4824-b0f3-bae041d9d6a2
  if (request.url.includes('session?delete=true'))
  {
    // Remove the requestID query parameter for the mock HTTP client
    request.url = request.url.substring(0, request.url.indexOf('&requestId='));
  }

  // get the output of the specified request from the map
  var requestOutput = this._mapRequestToOutput[serializeRequest(request)];

  Errors.assertInternal(Util.isObject(requestOutput),
    'no response available for: ' + serializeRequest(request));

  var delay = Util.isNumber(requestOutput.delay) ? requestOutput.delay : 0;

  // invoke the callback with the right arguments in a future tick of the event
  // loop; note that we don't use process.nextTick() here because if we did, the
  // callback would be invoked before any IO, which would make the behavior
  // different from if we were actually sending the request over the network
  // (which does require IO)
  setTimeout(function ()
  {
    // get the response from the output and clone it; this is to prevent tests
    // from interfering with each other if they mutate the response
    var response = JSON.parse(JSON.stringify(requestOutput.response));
    var body = requestOutput.body;

    if (!body && response)
    {
      body = response.body;
    }

    request.callback(requestOutput.err, response, body);
  }, delay);
};

/**
 * Builds a map in which the keys are requests (or rather, serialized versions
 * of the requests) and the values are the outputs of the corresponding request
 * objects.
 *
 * @param {Object[]} mappings
 *
 * @returns {Object}
 */
function buildRequestToOutputMap(mappings)
{
  var mapRequestToOutput = {};

  var mapping;
  for (var index = 0, length = mappings.length; index < length; index++)
  {
    mapping = mappings[index];
    const k = serializeRequest(mapping.request);
    if (mapRequestToOutput[k])
    {
      Logger.getInstance().error("The mock already exists: %s", k);
    }
    mapRequestToOutput[k] = mapping.output;
  }

  return mapRequestToOutput;
}

/**
 * Builds a string representation of a request.
 *
 * @param {Object} request
 *
 * @returns {String}
 */
function serializeRequest(request)
{
  // create a sorted clone of the request object and stringify the result;
  // stringifying the request object directly won't work because it will produce
  // different values for { method: 'GET', url: 'foo' } and
  // { url: 'foo', method: 'GET' } even though they are semantically equivalent
  // requests, i.e. they should produce the same output
  return JSON.stringify(createSortedClone(request));
}

/**
 * Clones an object to produce a value that has the same properties as the
 * original object but with the properties inserted in sorted order. Useful
 * to convert semantically equivalent objects like { a: 1, b : 2 } and
 * { b: 2, a: 1 } to the same string representation.
 *
 * @param {*} target
 *
 * @returns {*}
 */
function createSortedClone(target)
{
  var keysSorted;
  var sortedClone;
  var index, length, key;

  if (Util.isObject(target))
  {
    keysSorted = Object.keys(target).sort();
    sortedClone = {};
    for (index = 0, length = keysSorted.length; index < length; index++)
    {
      key = keysSorted[index];
      sortedClone[key] = createSortedClone(target[key]);
    }
  }
  else
  {
    sortedClone = target;
  }

  return sortedClone;
}

/**
 * Returns an array of objects, each of which has a request and output property.
 *
 * @param {Object} clientInfo
 *
 * @returns {Object[]}
 */
function buildRequestOutputMappings(clientInfo)
{
  return [
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/session/v1/login-request',
          headers:
            {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
          json:
            {
              data:
                {
                  ACCOUNT_NAME: 'fakeaccount',
                  AUTHENTICATOR: "SNOWFLAKE",
                  LOGIN_NAME: 'fakeusername',
                  PASSWORD: 'fakepassword',
                  CLIENT_APP_ID: 'JavaScript',
                  CLIENT_APP_VERSION: clientInfo.version,
                  CLIENT_ENVIRONMENT: clientInfo.environment,
                  SESSION_PARAMETERS: {}
                }
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "code": null,
                  "data":
                    {
                      "displayUserName": "FAKEUSERNAME",
                      "firstLogin": false,
                      "healthCheckInterval": 45,
                      "masterToken": "MASTER_TOKEN",
                      "masterValidityInSeconds": 14400,
                      "newClientForUpgrade": null,
                      "remMeToken": "REMEM_TOKEN",
                      "remMeValidityInSeconds": 14400,
                      "serverVersion": "Dev",
                      "sessionId": "51539800306",
                      "token": "SESSION_TOKEN",
                      "validityInSeconds": 3600,
                      "parameters": [{
                        "name": "TIMEZONE",
                        "value": "America/Los_Angeles"
                      }, {
                        "name": "TIMESTAMP_OUTPUT_FORMAT",
                        "value": "DY, DD MON YYYY HH24:MI:SS TZHTZM"
                      }, {
                        "name": "TIMESTAMP_NTZ_OUTPUT_FORMAT",
                        "value": ""
                      }, {
                        "name": "TIMESTAMP_LTZ_OUTPUT_FORMAT",
                        "value": ""
                      }, {
                        "name": "TIMESTAMP_TZ_OUTPUT_FORMAT",
                        "value": ""
                      }, {
                        "name": "DATE_OUTPUT_FORMAT",
                        "value": "YYYY-MM-DD"
                      }, {
                        "name": "TIME_OUTPUT_FORMAT",
                        "value": "HH24:MI:SS"
                      }, {
                        "name": "CLIENT_RESULT_PREFETCH_SLOTS",
                        "value": 2
                      }, {
                        "name": "CLIENT_RESULT_PREFETCH_THREADS",
                        "value": 1
                      }, {
                        "name": "CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ",
                        "value": true
                      }, {
                        "name": "CLIENT_USE_V1_QUERY_API",
                        "value": true
                      }, {
                        "name": "CLIENT_DISABLE_INCIDENTS",
                        "value": true
                      }, {
                        "name": "CLIENT_SESSION_KEEP_ALIVE",
                        "value": false
                      }, {
                        "name": "CLIENT_SESSION_KEEP_ALIVE_HEARTBEAT_FREQUENCY",
                        "value": 3600
                      }, {
                        "name": "JS_TREAT_INTEGER_AS_BIGINT",
                        "value": false
                      }]
                    },
                  "message": null,
                  "success": true
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/session?delete=true',
          headers:
            {
              'Accept': 'application/json',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json',
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  code: null,
                  data: null,
                  message: null,
                  success: true
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/session?delete=true',
          headers:
            {
              'Accept': 'application/json',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json',
              "X-Snowflake-Service": "fakeservicename2"
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  code: null,
                  data: null,
                  message: null,
                  success: true
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/v1/query-request?requestId=foobar',
          headers:
            {
              'Accept': 'application/snowflake',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json'
            },
          json:
            {
              disableOfflineChunks: false,
              sqlText: 'select 1 as "c1";',
              queryContextDTO: { entries: [] },
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "data":
                    {
                      "parameters":
                        [
                          {
                            "name": "DATE_OUTPUT_FORMAT",
                            "value": "YYYY-MM-DD"
                          },
                          {
                            "name": "CLIENT_USE_V1_QUERY_API",
                            "value": true
                          },
                          {
                            "name": "TIMESTAMP_LTZ_OUTPUT_FORMAT",
                            "value": ""
                          },
                          {
                            "name": "TIMESTAMP_NTZ_OUTPUT_FORMAT",
                            "value": ""
                          },
                          {
                            "name": "CLIENT_RESULT_PREFETCH_THREADS",
                            "value": 1
                          },
                          {
                            "name": "CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ",
                            "value": true
                          },
                          {
                            "name": "TIMEZONE",
                            "value": "America/Los_Angeles"
                          },
                          {
                            "name": "TIMESTAMP_OUTPUT_FORMAT",
                            "value": "DY, DD MON YYYY HH24:MI:SS TZHTZM"
                          },
                          {
                            "name": "TIMESTAMP_TZ_OUTPUT_FORMAT",
                            "value": ""
                          },
                          {
                            "name": "CLIENT_RESULT_PREFETCH_SLOTS",
                            "value": 2
                          }
                        ],
                      "rowtype":
                        [
                          {
                            "name": "c1",
                            "byteLength": null,
                            "length": null,
                            "type": "fixed",
                            "nullable": false,
                            "precision": 1,
                            "scale": 0
                          }
                        ],
                      "rowset": [["1"]],
                      "total": 1,
                      "returned": 1,
                      "queryId": "df2852ef-e082-4bb3-94a4-e540bf0e70c6",
                      "databaseProvider": null,
                      "finalDatabaseName": null,
                      "finalSchemaName": null,
                      "finalWarehouseName": "NEW_WH",
                      "finalRoleName": "ACCOUNTADMIN",
                      "numberOfBinds": 0,
                      "statementTypeId": 4096,
                      "version": 0
                    },
                  "message": null,
                  "code": null,
                  "success": true
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/v1/query-request?requestId=foobar',
          headers:
            {
              'Accept': 'application/snowflake',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json'
            },
          json:
            {
              disableOfflineChunks: false,
              sqlText: 'select 1 as "c2";'
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "data":
                    {
                      "parameters":
                        [
                          {
                            "name": "DATE_OUTPUT_FORMAT",
                            "value": "YYYY-MM-DD"
                          },
                          {
                            "name": "CLIENT_USE_V1_QUERY_API",
                            "value": true
                          },
                          {
                            "name": "TIMESTAMP_LTZ_OUTPUT_FORMAT",
                            "value": ""
                          },
                          {
                            "name": "TIMESTAMP_NTZ_OUTPUT_FORMAT",
                            "value": ""
                          },
                          {
                            "name": "CLIENT_RESULT_PREFETCH_THREADS",
                            "value": 1
                          },
                          {
                            "name": "CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ",
                            "value": true
                          },
                          {
                            "name": "TIMEZONE",
                            "value": "America/Los_Angeles"
                          },
                          {
                            "name": "TIMESTAMP_OUTPUT_FORMAT",
                            "value": "DY, DD MON YYYY HH24:MI:SS TZHTZM"
                          },
                          {
                            "name": "TIMESTAMP_TZ_OUTPUT_FORMAT",
                            "value": ""
                          },
                          {
                            "name": "CLIENT_RESULT_PREFETCH_SLOTS",
                            "value": 2
                          }
                        ],
                      "rowtype":
                        [
                          {
                            "name": "c2",
                            "byteLength": null,
                            "length": null,
                            "type": "fixed",
                            "nullable": false,
                            "precision": 1,
                            "scale": 0
                          }
                        ],
                      "rowset": [["1"]],
                      "total": 1,
                      "returned": 1,
                      "queryId": "df2852ef-e082-4bb3-94a4-e540bf0e70c6",
                      "databaseProvider": null,
                      "finalDatabaseName": null,
                      "finalSchemaName": null,
                      "finalWarehouseName": "NEW_WH",
                      "finalRoleName": "ACCOUNTADMIN",
                      "numberOfBinds": 0,
                      "statementTypeId": 4096,
                      "version": 0
                    },
                  "message": null,
                  "code": null,
                  "success": true
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/v1/query-request?requestId=foobar',
          headers:
            {
              'Accept': 'application/snowflake',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json'
            },
          json:
            {
              disableOfflineChunks: false,
              sqlText: 'select to_boolean(:1) as "boolean", to_date(:2) as "date", 1.123456789123456789 as "number"',
              bindings:
                {
                  "1": {type: 'TEXT', value: 'false'},
                  "2": {type: 'TEXT', value: '1967-06-23'},
                },
                queryContextDTO: { entries: [] },
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "data": {
                    "parameters": [{
                      "name": "TIMEZONE",
                      "value": "America/Los_Angeles"
                    }, {
                      "name": "TIMESTAMP_OUTPUT_FORMAT",
                      "value": "DY, DD MON YYYY HH24:MI:SS TZHTZM"
                    }, {
                      "name": "TIMESTAMP_NTZ_OUTPUT_FORMAT",
                      "value": ""
                    }, {
                      "name": "TIMESTAMP_LTZ_OUTPUT_FORMAT",
                      "value": ""
                    }, {
                      "name": "TIMESTAMP_TZ_OUTPUT_FORMAT",
                      "value": ""
                    }, {
                      "name": "DATE_OUTPUT_FORMAT",
                      "value": "YYYY-MM-DD"
                    }, {
                      "name": "TIME_OUTPUT_FORMAT",
                      "value": "HH24:MI:SS"
                    }, {
                      "name": "CLIENT_RESULT_PREFETCH_SLOTS",
                      "value": 2
                    }, {
                      "name": "CLIENT_RESULT_PREFETCH_THREADS",
                      "value": 1
                    }, {
                      "name": "CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ",
                      "value": true
                    }, {
                      "name": "CLIENT_USE_V1_QUERY_API",
                      "value": true
                    }, {
                      "name": "JDBC_EXECUTE_RETURN_COUNT_FOR_DML",
                      "value": false
                    }, {
                      "name": "JDBC_SHARING_WITH_CANONICAL",
                      "value": false
                    }, {
                      "name": "ODBC_ENABLE_COMPRESSION",
                      "value": false
                    }, {"name": "CLIENT_DISABLE_INCIDENTS", "value": true}],
                    "rowtype": [{
                      "name": "boolean",
                      "byteLength": null,
                      "nullable": false,
                      "precision": null,
                      "scale": null,
                      "length": null,
                      "type": "boolean"
                    }, {
                      "name": "date",
                      "byteLength": null,
                      "nullable": false,
                      "precision": null,
                      "scale": null,
                      "length": null,
                      "type": "date"
                    }, {
                      "name": "number",
                      "byteLength": null,
                      "nullable": false,
                      "precision": 19,
                      "scale": 18,
                      "length": null,
                      "type": "fixed"
                    }],
                    "rowset": [["0", "-923", "1.123456789123456789"]],
                    "total": 1,
                    "returned": 1,
                    "queryId": "d4dfd395-c2ef-4b2e-afe6-84864d93347b",
                    "databaseProvider": null,
                    "finalDatabaseName": null,
                    "finalSchemaName": null,
                    "finalWarehouseName": "REGRESS",
                    "finalRoleName": "ACCOUNTADMIN",
                    "numberOfBinds": 0,
                    "statementTypeId": 4096,
                    "version": 1
                  },
                  "message": null,
                  "code": null,
                  "success": true
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/v1/query-request?requestId=foobar',
          headers:
            {
              'Accept': 'application/snowflake',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json'
            },
          json:
            {
              disableOfflineChunks: false,
              sqlText: 'select;',
              queryContextDTO: { entries: [] },
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "data":
                    {
                      "internalError": false,
                      "errorCode": "001003",
                      "age": 0,
                      "sqlState": "42000",
                      "queryId": "13f12818-de4c-41d2-bf19-f115ee8a5cc1",
                      "line": -1,
                      "pos": -1,
                      "type": "COMPILATION"
                    },
                  "message": "SQL compilation error:\nsyntax error line 1 at position 6 unexpected ';'.",
                  "code": "001003",
                  "success": false
                }
            }
        }
    },
    {
      request:
        {
          method: 'GET',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/df2852ef-e082-4bb3-94a4-e540bf0e70c6/result?disableOfflineChunks=false',
          headers:
            {
              'Accept': 'application/snowflake',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json'
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "data":
                    {
                      "parameters":
                        [
                          {
                            "name": "DATE_OUTPUT_FORMAT",
                            "value": "YYYY-MM-DD"
                          },
                          {
                            "name": "CLIENT_USE_V1_QUERY_API",
                            "value": true
                          },
                          {
                            "name": "TIMESTAMP_LTZ_OUTPUT_FORMAT",
                            "value": ""
                          },
                          {
                            "name": "TIMESTAMP_NTZ_OUTPUT_FORMAT",
                            "value": ""
                          },
                          {
                            "name": "CLIENT_RESULT_PREFETCH_THREADS",
                            "value": 1
                          },
                          {
                            "name": "CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ",
                            "value": true
                          },
                          {
                            "name": "TIMEZONE",
                            "value": "America/Los_Angeles"
                          },
                          {
                            "name": "TIMESTAMP_OUTPUT_FORMAT",
                            "value": "DY, DD MON YYYY HH24:MI:SS TZHTZM"
                          },
                          {
                            "name": "TIMESTAMP_TZ_OUTPUT_FORMAT",
                            "value": ""
                          },
                          {
                            "name": "CLIENT_RESULT_PREFETCH_SLOTS",
                            "value": 2
                          }
                        ],
                      "rowtype":
                        [
                          {
                            "name": "c1",
                            "byteLength": null,
                            "length": null,
                            "type": "fixed",
                            "nullable": false,
                            "precision": 1,
                            "scale": 0
                          }
                        ],
                      "rowset": [["1"]],
                      "total": 1,
                      "returned": 1,
                      "queryId": "df2852ef-e082-4bb3-94a4-e540bf0e70c6",
                      "databaseProvider": null,
                      "finalDatabaseName": null,
                      "finalSchemaName": null,
                      "finalWarehouseName": "NEW_WH",
                      "finalRoleName": "ACCOUNTADMIN",
                      "numberOfBinds": 0,
                      "statementTypeId": 4096,
                      "version": 0
                    },
                  "message": null,
                  "code": null,
                  "success": true
                }
            }
        }
    },
    {
      request:
        {
          method: 'GET',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/13f12818-de4c-41d2-bf19-f115ee8a5cc1/result?disableOfflineChunks=false',
          headers:
            {
              'Accept': 'application/snowflake',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json'
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "data":
                    {
                      "internalError": false,
                      "errorCode": "001003",
                      "age": 1,
                      "sqlState": "42000",
                      "queryId": "13f12818-de4c-41d2-bf19-f115ee8a5cc1"
                    },
                  "message": "SQL compilation error:\nsyntax error line 1 at position 6 unexpected ';'.",
                  "code": "001003",
                  "success": false
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/v1/abort-request',
          headers:
            {
              'Accept': 'application/json',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json'
            },
          json:
            {
              requestId: 'foobar'
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "code": "",
                  "data":
                    {
                      "age": 0,
                      "errorCode": "000605",
                      "internalError": false,
                      "queryId": null,
                      "sqlState": "01000"
                    },
                  "message": "Identified SQL statement is not currently executing.",
                  "success": false
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/df2852ef-e082-4bb3-94a4-e540bf0e70c6/abort-request',
          headers:
            {
              'Accept': 'application/json',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json'
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 306,
              statusMessage: "306",
              body: ""
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/13f12818-de4c-41d2-bf19-f115ee8a5cc1/abort-request',
          headers:
            {
              'Accept': 'application/json',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json'
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 306,
              statusMessage: "306",
              body: ""
            }
        }
    },
    {
      request:
        {
          method: 'GET',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/foobar/result?disableOfflineChunks=false',
          headers:
            {
              'Accept': 'application/snowflake',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json'
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 400,
              statusMessage: "Bad Request",
              body: "\"foobar\" is not a UUID."
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/foobar/abort-request',
          headers:
            {
              'Accept': 'application/json',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json'
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 400,
              statusMessage: "Bad Request",
              body: "\"foobar\" is not a UUID."
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/v1/query-request?requestId=b97fee20-a805-11e5-a0ab-ddd3321ed586',
          headers:
            {
              'Accept': 'application/snowflake',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json'
            },
          json:
            {
              disableOfflineChunks: false,
              sqlText: 'select count(*) from table(generator(timelimit=>10));',
              queryContextDTO: { entries: [] },
            }
        },
      output:
        {
          delay: 10,
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "code": "000604",
                  "data":
                    {
                      "age": 0,
                      "errorCode": "000604",
                      "internalError": false,
                      "queryId": "dd5d30ef-01bf-4b65-a7f2-f5c61ceaa2ca",
                      "sqlState": "57014"
                    },
                  "message": "SQL execution canceled",
                  "success": false
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/v1/abort-request',
          headers:
            {
              'Accept': 'application/json',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json'
            },
          json:
            {
              requestId: 'b97fee20-a805-11e5-a0ab-ddd3321ed586'
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "code": null,
                  "data": null,
                  "message": null,
                  "success": true
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/v1/query-request?requestId=foobar',
          headers:
            {
              'Accept': 'application/snowflake',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json'
            },
          json:
            {
              disableOfflineChunks: false,
              sqlText: 'select \'too many concurrent queries\';',
              queryContextDTO: { entries: [] },
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "data": null,
                  "message": "Exceeded number of allowed concurrent requests per user. You may try again later. If the problem persists, contact your local administrator.",
                  "code": "000610",
                  "success": false
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/session/v1/login-request',
          headers:
            {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
          json:
            {
              data:
                {
                  ACCOUNT_NAME: 'fakeaccount',
                  AUTHENTICATOR: "SNOWFLAKE",
                  LOGIN_NAME: 'fakeuserservicename',
                  PASSWORD: 'fakepassword',
                  CLIENT_APP_ID: 'JavaScript',
                  CLIENT_APP_VERSION: clientInfo.version,
                  CLIENT_ENVIRONMENT: clientInfo.environment,
                  SESSION_PARAMETERS: {}
                }
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "code": null,
                  "data":
                    {
                      "displayUserName": "FAKEUSERNAME",
                      "firstLogin": false,
                      "healthCheckInterval": 45,
                      "masterToken": "MASTER_TOKEN",
                      "masterValidityInSeconds": 14400,
                      "newClientForUpgrade": null,
                      "remMeToken": "MASTER_TOKEN",
                      "remMeValidityInSeconds": 14400,
                      "serverVersion": "Dev",
                      "sessionId": "51539800306",
                      "token": "SESSION_TOKEN",
                      "validityInSeconds": 3600,
                      "parameters": [{
                        "name": "TIMEZONE",
                        "value": "America/Los_Angeles"
                      }, {
                        "name": "TIMESTAMP_OUTPUT_FORMAT",
                        "value": "DY, DD MON YYYY HH24:MI:SS TZHTZM"
                      }, {
                        "name": "TIMESTAMP_NTZ_OUTPUT_FORMAT",
                        "value": ""
                      }, {
                        "name": "TIMESTAMP_LTZ_OUTPUT_FORMAT",
                        "value": ""
                      }, {
                        "name": "TIMESTAMP_TZ_OUTPUT_FORMAT",
                        "value": ""
                      }, {
                        "name": "DATE_OUTPUT_FORMAT",
                        "value": "YYYY-MM-DD"
                      }, {
                        "name": "TIME_OUTPUT_FORMAT",
                        "value": "HH24:MI:SS"
                      }, {
                        "name": "CLIENT_RESULT_PREFETCH_SLOTS",
                        "value": 2
                      }, {
                        "name": "CLIENT_RESULT_PREFETCH_THREADS",
                        "value": 1
                      }, {
                        "name": "CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ",
                        "value": true
                      }, {
                        "name": "CLIENT_USE_V1_QUERY_API",
                        "value": true
                      }, {
                        "name": "CLIENT_DISABLE_INCIDENTS",
                        "value": true
                      }, {
                        "name": "SERVICE_NAME",
                        "value": "fakeservicename"
                      }, {
                        "name": "CLIENT_SESSION_KEEP_ALIVE",
                        "value": false
                      }, {
                        "name": "CLIENT_SESSION_KEEP_ALIVE_HEARTBEAT_FREQUENCY",
                        "value": 3600
                      }, {
                        "name": "JS_TREAT_INTEGER_AS_BIGINT",
                        "value": false
                      }]
                    },
                  "message": null,
                  "success": true
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/queries/v1/query-request?requestId=foobar',
          headers:
            {
              'Accept': 'application/snowflake',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json',
              'X-Snowflake-Service': 'fakeservicename'
            },
          json:
            {
              disableOfflineChunks: false,
              sqlText: 'select * from faketable',
              queryContextDTO: { entries: [] },
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "data":
                    {
                      "parameters":
                        [
                          {
                            "name": "DATE_OUTPUT_FORMAT",
                            "value": "YYYY-MM-DD"
                          },
                          {
                            "name": "CLIENT_USE_V1_QUERY_API",
                            "value": true
                          },
                          {
                            "name": "TIMESTAMP_LTZ_OUTPUT_FORMAT",
                            "value": ""
                          },
                          {
                            "name": "TIMESTAMP_NTZ_OUTPUT_FORMAT",
                            "value": ""
                          },
                          {
                            "name": "CLIENT_RESULT_PREFETCH_THREADS",
                            "value": 1
                          },
                          {
                            "name": "CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ",
                            "value": true
                          },
                          {
                            "name": "TIMEZONE",
                            "value": "America/Los_Angeles"
                          },
                          {
                            "name": "TIMESTAMP_OUTPUT_FORMAT",
                            "value": "DY, DD MON YYYY HH24:MI:SS TZHTZM"
                          },
                          {
                            "name": "TIMESTAMP_TZ_OUTPUT_FORMAT",
                            "value": ""
                          },
                          {
                            "name": "CLIENT_RESULT_PREFETCH_SLOTS",
                            "value": 2
                          }
                          ,
                          {
                            "name": "SERVICE_NAME",
                            "value": "fakeservicename2"
                          }
                        ],
                      "rowtype":
                        [
                          {
                            "name": "c2",
                            "byteLength": null,
                            "length": null,
                            "type": "fixed",
                            "nullable": false,
                            "precision": 1,
                            "scale": 0
                          }
                        ],
                      "rowset": [["1"]],
                      "total": 1,
                      "returned": 1,
                      "queryId": "df2852ef-e082-4bb3-94a4-e540bf0e70c6",
                      "databaseProvider": null,
                      "finalDatabaseName": null,
                      "finalSchemaName": null,
                      "finalWarehouseName": "NEW_WH",
                      "finalRoleName": "ACCOUNTADMIN",
                      "numberOfBinds": 0,
                      "statementTypeId": 4096,
                      "version": 0
                    },
                  "message": null,
                  "code": null,
                  "success": true
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/session/v1/login-request',
          headers:
            {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
          json:
            {
              data:
                {
                  ACCOUNT_NAME: 'fakeaccount',
                  AUTHENTICATOR: "SNOWFLAKE",
                  LOGIN_NAME: 'fakeusername',
                  PASSWORD: 'fakepassword',
                  CLIENT_APP_ID: 'JavaScript',
                  CLIENT_APP_VERSION: clientInfo.version,
                  CLIENT_ENVIRONMENT: clientInfo.environment,
                  SESSION_PARAMETERS: {
                    CLIENT_SESSION_KEEP_ALIVE: true,
                    CLIENT_SESSION_KEEP_ALIVE_HEARTBEAT_FREQUENCY: 1800
                  }
                }
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "code": null,
                  "data":
                    {
                      "displayUserName": "FAKEUSERNAME",
                      "firstLogin": false,
                      "healthCheckInterval": 45,
                      "masterToken": "MASTER_TOKEN",
                      "masterValidityInSeconds": 14400,
                      "newClientForUpgrade": null,
                      "remMeToken": "MASTER_TOKEN",
                      "remMeValidityInSeconds": 14400,
                      "serverVersion": "Dev",
                      "sessionId": "51539800306",
                      "token": "SESSION_TOKEN",
                      "validityInSeconds": 3600,
                      "parameters": [{
                        "name": "TIMEZONE",
                        "value": "America/Los_Angeles"
                      }, {
                        "name": "TIMESTAMP_OUTPUT_FORMAT",
                        "value": "DY, DD MON YYYY HH24:MI:SS TZHTZM"
                      }, {
                        "name": "TIMESTAMP_NTZ_OUTPUT_FORMAT",
                        "value": ""
                      }, {
                        "name": "TIMESTAMP_LTZ_OUTPUT_FORMAT",
                        "value": ""
                      }, {
                        "name": "TIMESTAMP_TZ_OUTPUT_FORMAT",
                        "value": ""
                      }, {
                        "name": "DATE_OUTPUT_FORMAT",
                        "value": "YYYY-MM-DD"
                      }, {
                        "name": "TIME_OUTPUT_FORMAT",
                        "value": "HH24:MI:SS"
                      }, {
                        "name": "CLIENT_RESULT_PREFETCH_SLOTS",
                        "value": 2
                      }, {
                        "name": "CLIENT_RESULT_PREFETCH_THREADS",
                        "value": 1
                      }, {
                        "name": "CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ",
                        "value": true
                      }, {
                        "name": "CLIENT_USE_V1_QUERY_API",
                        "value": true
                      }, {
                        "name": "CLIENT_DISABLE_INCIDENTS",
                        "value": true
                      }, {
                        "name": "CLIENT_SESSION_KEEP_ALIVE",
                        "value": true
                      }, {
                        "name": "CLIENT_SESSION_KEEP_ALIVE_HEARTBEAT_FREQUENCY",
                        "value": 1800
                      }, {
                        "name": "JS_TREAT_INTEGER_AS_BIGINT",
                        "value": false
                      }]
                    },
                  "message": null,
                  "success": true
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/session/v1/login-request',
          headers:
            {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
          json:
            {
              data:
                {
                  ACCOUNT_NAME: 'fakeaccount',
                  AUTHENTICATOR: "SNOWFLAKE",
                  LOGIN_NAME: 'fakeusername',
                  PASSWORD: 'fakepassword',
                  CLIENT_APP_ID: 'JavaScript',
                  CLIENT_APP_VERSION: clientInfo.version,
                  CLIENT_ENVIRONMENT: clientInfo.environment,
                  SESSION_PARAMETERS: {
                    JS_TREAT_INTEGER_AS_BIGINT: true,
                  }
                }
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "code": null,
                  "data":
                    {
                      "displayUserName": "FAKEUSERNAME",
                      "firstLogin": false,
                      "healthCheckInterval": 45,
                      "masterToken": "MASTER_TOKEN",
                      "masterValidityInSeconds": 14400,
                      "newClientForUpgrade": null,
                      "remMeToken": "MASTER_TOKEN",
                      "remMeValidityInSeconds": 14400,
                      "serverVersion": "Dev",
                      "sessionId": "51539800306",
                      "token": "SESSION_TOKEN",
                      "validityInSeconds": 3600,
                      "parameters": [{
                        "name": "TIMEZONE",
                        "value": "America/Los_Angeles"
                      }, {
                        "name": "TIMESTAMP_OUTPUT_FORMAT",
                        "value": "DY, DD MON YYYY HH24:MI:SS TZHTZM"
                      }, {
                        "name": "TIMESTAMP_NTZ_OUTPUT_FORMAT",
                        "value": ""
                      }, {
                        "name": "TIMESTAMP_LTZ_OUTPUT_FORMAT",
                        "value": ""
                      }, {
                        "name": "TIMESTAMP_TZ_OUTPUT_FORMAT",
                        "value": ""
                      }, {
                        "name": "DATE_OUTPUT_FORMAT",
                        "value": "YYYY-MM-DD"
                      }, {
                        "name": "TIME_OUTPUT_FORMAT",
                        "value": "HH24:MI:SS"
                      }, {
                        "name": "CLIENT_RESULT_PREFETCH_SLOTS",
                        "value": 2
                      }, {
                        "name": "CLIENT_RESULT_PREFETCH_THREADS",
                        "value": 1
                      }, {
                        "name": "CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ",
                        "value": true
                      }, {
                        "name": "CLIENT_USE_V1_QUERY_API",
                        "value": true
                      }, {
                        "name": "CLIENT_DISABLE_INCIDENTS",
                        "value": true
                      }, {
                        "name": "CLIENT_SESSION_KEEP_ALIVE",
                        "value": false
                      }, {
                        "name": "CLIENT_SESSION_KEEP_ALIVE_HEARTBEAT_FREQUENCY",
                        "value": 3600
                      }, {
                        "name": "JS_TREAT_INTEGER_AS_BIGINT",
                        "value": true
                      }]
                    },
                  "message": null,
                  "success": true
                }
            }
        }
    },
    {
      // Session Gone test mock
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/session/v1/login-request',
          headers:
            {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
          json:
            {
              data:
                {
                  ACCOUNT_NAME: 'fakeaccount',
                  AUTHENTICATOR: "SNOWFLAKE",
                  LOGIN_NAME: 'fakesessiongone',
                  PASSWORD: 'fakepassword',
                  CLIENT_APP_ID: 'JavaScript',
                  CLIENT_APP_VERSION: clientInfo.version,
                  CLIENT_ENVIRONMENT: clientInfo.environment,
                  SESSION_PARAMETERS: {}
                }
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "code": null,
                  "data":
                    {
                      "displayUserName": "FAKEUSERNAME",
                      "firstLogin": false,
                      "healthCheckInterval": 45,
                      "masterToken": "SESSION_GONE_MASTER_TOKEN",
                      "masterValidityInSeconds": 14400,
                      "newClientForUpgrade": null,
                      "remMeToken": "SESSION_GONE_REMME_TOKEN",
                      "remMeValidityInSeconds": 14400,
                      "serverVersion": "Dev",
                      "sessionId": "51539800306",
                      "token": "SESSION_GONE_TOKEN",
                      "validityInSeconds": 3600,
                      "parameters": []
                    },
                  "message": null,
                  "success": true
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fakeaccount.snowflakecomputing.com/session?delete=true',
          headers:
            {
              'Accept': 'application/json',
              'Authorization': 'Snowflake Token="SESSION_GONE_TOKEN"',
              'Content-Type': 'application/json',
              "X-Snowflake-Service": "fakeservicename2"
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  code: "390111",
                  data: null,
                  message: "ERROR!",
                  success: false
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fake504.snowflakecomputing.com/session/v1/login-request',
          headers:
            {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
          json:
            {
              data:
                {
                  ACCOUNT_NAME: 'fake504',
                  AUTHENTICATOR: "SNOWFLAKE",
                  LOGIN_NAME: 'fake504user',
                  PASSWORD: 'fakepassword',
                  CLIENT_APP_ID: 'JavaScript',
                  CLIENT_APP_VERSION: clientInfo.version,
                  CLIENT_ENVIRONMENT: clientInfo.environment,
                  SESSION_PARAMETERS: {}
                }
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 504,
              statusMessage: "ERROR",
              body: {}
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fake504.snowflakecomputing.com/session/v1/login-request?clientStartTime=FIXEDTIMESTAMP&retryCount=1',
          headers:
            {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
          json:
            {
              data:
                {
                  ACCOUNT_NAME: 'fake504',
                  AUTHENTICATOR: "SNOWFLAKE",
                  LOGIN_NAME: 'fake504user',
                  PASSWORD: 'fakepassword',
                  CLIENT_APP_ID: 'JavaScript',
                  CLIENT_APP_VERSION: clientInfo.version,
                  CLIENT_ENVIRONMENT: clientInfo.environment,
                  SESSION_PARAMETERS: {}
                }
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 504,
              statusMessage: "ERROR",
              body: {}
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fake504.snowflakecomputing.com/session/v1/login-request?clientStartTime=FIXEDTIMESTAMP&retryCount=2',
          headers:
            {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
          json:
            {
              data:
                {
                  ACCOUNT_NAME: 'fake504',
                  AUTHENTICATOR: "SNOWFLAKE",
                  LOGIN_NAME: 'fake504user',
                  PASSWORD: 'fakepassword',
                  CLIENT_APP_ID: 'JavaScript',
                  CLIENT_APP_VERSION: clientInfo.version,
                  CLIENT_ENVIRONMENT: clientInfo.environment,
                  SESSION_PARAMETERS: {}
                }
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  "code": null,
                  "data":
                    {
                      "displayUserName": "FAKE504USER",
                      "firstLogin": false,
                      "healthCheckInterval": 45,
                      "masterToken": "MASTER_TOKEN",
                      "masterValidityInSeconds": 14400,
                      "newClientForUpgrade": null,
                      "remMeToken": "SESSION_REMME_TOKEN",
                      "remMeValidityInSeconds": 14400,
                      "serverVersion": "Dev",
                      "sessionId": "51539800306",
                      "token": "SESSION_TOKEN",
                      "validityInSeconds": 3600,
                      "parameters": []
                    },
                  "message": null,
                  "success": true
                }
            }
        }
    },
    {
      request:
        {
          method: 'POST',
          url: 'http://fake504.snowflakecomputing.com/session?delete=true',
          headers:
            {
              'Accept': 'application/json',
              'Authorization': 'Snowflake Token="SESSION_TOKEN"',
              'Content-Type': 'application/json',
              "X-Snowflake-Service": "fakeservicename2"
            }
        },
      output:
        {
          err: null,
          response:
            {
              statusCode: 200,
              statusMessage: "OK",
              body:
                {
                  code: null,
                  data: null,
                  message: null,
                  success: true
                }
            }
        }
    }
  ];
}