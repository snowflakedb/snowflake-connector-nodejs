/*
 * Copyright (c) 2015-2018 Snowflake Computing Inc. All rights reserved.
 */

var core = require('./core');

module.exports = core(
{
  httpClientClass : require('./http/browser'),
  loggerClass     : require('./logger/browser')
});

// expose the module as a global variable
window.snowflake = module.exports;