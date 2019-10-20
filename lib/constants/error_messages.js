/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

// 400001
exports[400001] = 'An internal error has occurred. Please contact Snowflake support.';
exports[400002] = 'You are using an unsupported version of Node.js. Please use %s or above.';

// 401001
exports[401001] = 'Network error. Could not reach Snowflake.';
exports[401002] = 'Request to Snowflake failed.';
exports[401003] = 'Snowflake responded with non-JSON content.';
exports[401004] = 'Request to Snowflake failed.  Invalid token';

// 402001
exports[402001] = 'Network error. Could not reach S3/Blob.';
exports[402002] = 'Request to S3/Blob failed.';

// 403001
exports[403001] = 'Invalid logLevel. The specified value must be one of these five levels: error, warn, debug, info and trace.';
exports[403002] = 'Invalid insecureConnect option. The specified value must be a boolean.';
exports[403003] = 'Invalid OCSP mode. The specified value must be FAIL_CLOSED, FAIL_OPEN, or INSECURE_MODE.';

// 404001
exports[404001] = 'Connection options must be specified.';
exports[404002] = 'Invalid connection options. The specified value must be an object.';
exports[404003] = 'A user name must be specified.';
exports[404004] = 'Invalid user name. The specified value must be a string.';
exports[404005] = 'A password must be specified.';
exports[404006] = 'Invalid password. The specified value must be a string.';
exports[404007] = 'An account must be specified.';
exports[404008] = 'Invalid account. The specified value must be a string.';
exports[404009] = 'An accessUrl must be specified.';
exports[404010] = 'Invalid accessUrl. The specified value must be a string.';
exports[404011] = 'Invalid warehouse. The specified value must be a string.';
exports[404012] = 'Invalid database. The specified value must be a string.';
exports[404013] = 'Invalid schema. The specified value must be a string.';
exports[404014] = 'Invalid role. The specified value must be a string.';
exports[404015] = 'A proxyHost must be specified';
exports[404016] = 'Invalid proxyHost. The specified value must be a string.';
exports[404017] = 'A proxyPort must be specified.';
exports[404018] = 'Invalid proxyPort. The specified value must be a number.';
exports[404019] = 'Invalid streamResult flag. The specified value must be a boolean.';
exports[404020] = 'Invalid fetchAsString option. The specified value must be an Array.';
exports[404021] = 'Invalid fetchAsString type: %s. The supported types are: String, Boolean, Number, Date, and JSON.';
exports[404022] = 'Invalid region. The specified value must be a string.';
exports[404023] = 'Invalid clientSessionKeepAlive. The specified value must be a boolean.';
exports[404024] = 'Invalid clientSessionKeepAliveHeartbeatFrequency. The specified value must be a number.';
exports[404025] = 'Invalid jsTreatIntegerAsBigInt. The specified value must be a boolean';

// 405001
exports[405001] = 'Invalid callback. The specified value must be a function.';

// 405501
exports[405501] = 'Connection already in progress.';
exports[405502] = 'Already connected.';
exports[405503] = 'Connection already terminated. Cannot connect again.';

// 406001
exports[406001] = 'Invalid callback. The specified value must be a function.';

// 406501
exports[406501] = 'Not connected, so nothing to destroy.';
exports[406502] = 'Already disconnected.';

// 407001
exports[407001] = 'Unable to perform operation because a connection was never established.';
exports[407002] = 'Unable to perform operation using terminated connection.';

// 408001
exports[408001] = 'A serializedConnection must be specified.';
exports[408002] = 'Invalid serializedConnection. The specified value must be a string.';
exports[408003] = 'Invalid serializedConnection. The value must be a string obtained by calling another connection\'s serialize() method.';

// 409001
exports[409001] = 'Execute options must be specified.';
exports[409002] = 'Invalid execute options. The specified value must be an object.';
exports[409003] = 'A sqlText value must be specified.';
exports[409004] = 'Invalid sqlText. The specified value must be a string.';
exports[409005] = 'Invalid internal flag. The specified value must be a boolean.';
exports[409006] = 'Invalid parameters. The specified value must be an object.';
exports[409007] = 'Invalid binds. The specified value must be an array.';
exports[409008] = 'Invalid bind variable: %s. Only stringifiable values are supported.';
exports[409009] = 'Invalid complete callback. The specified value must be a function.';
exports[409010] = 'Invalid streamResult flag. The specified value must be a boolean.';
exports[409011] = 'Invalid fetchAsString value. The specified value must be an Array.';
exports[409012] = 'Invalid fetchAsString type: %s. The supported types are: String, Boolean, Number, Date, and JSON.';

// 410001
exports[410001] = 'Fetch-result options must be specified.';
exports[410002] = 'Invalid options. The specified value must be an object.';
exports[410003] = 'A statement id must be specified.';
exports[410004] = 'Invalid statement id. The specified value must be a string.';
exports[410005] = 'Invalid complete callback. The specified value must be a function.';
exports[410006] = 'Invalid streamResult flag. The specified value must be a boolean.';
exports[410007] = 'Invalid fetchAsString value. The specified value must be an Array.';
exports[410008] = 'Invalid fetchAsString type: %s. The supported types are: String, Boolean, Number, Date, and JSON.';

// 411001
exports[411001] = 'Invalid options. The specified value must be an object.';
exports[411002] = 'Invalid start index. The specified value must be a number.';
exports[411003] = 'Invalid end index. The specified value must be a number.';
exports[411004] = 'Invalid fetchAsString value. The specified value must be an Array.';
exports[411005] = 'Invalid fetchAsString type: %s. The supported types are: String, Boolean, Number, Date, and JSON.';

exports[412001] = 'Certificate is REVOKED.';
exports[412002] = 'Certificate status is UNKNOWN.';
exports[412003] = 'Not recognize signature algorithm.';
exports[412004] = 'Invalid signature.';
exports[412005] = 'No OCSP response data is attached.';
exports[412006] = 'Invalid validity.';
exports[412007] = 'Could not verify the certificate revocation status.';
exports[412008] = 'Not two elements are in the cache.';
exports[412009] = 'Cache entry expired.';
exports[412010] = 'Failed to parse OCSP response.';
exports[412011] = 'Invalid Signing Certificate validity.';
exports[412012] = 'Timeout OCSP responder.';
exports[412013] = 'Timeout OCSP Cache server.';
exports[412014] = 'Failed to obtain OCSP response: %s';

// 450001
exports[450001] = 'Fetch-row options must be specified.';
exports[450002] = 'Invalid options. The specified value must be an object.';
exports[450003] = 'An each() callback must be specified.';
exports[450004] = 'Invalid each() callback. The specified value must be a function.';
exports[450005] = 'An end() callback must be specified.';
exports[450006] = 'Invalid end() callback. The specified value must be a function.';
exports[450007] = 'Operation failed because the statement is still in progress.';
