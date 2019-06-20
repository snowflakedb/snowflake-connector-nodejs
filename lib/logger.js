/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var BrowserLogger = require('./logger/browser');

var instance;

/**
 * Sets the logger instance. For internal use only.
 *
 * @param {*} newInstance
 */
exports.setInstance = function (newInstance)
{
  instance = newInstance;
};

/**
 * Returns the current logger instance.
 *
 * @returns {Logger}
 */
exports.getInstance = function ()
{
  // use the browser implementation of logger as the default implementation;
  // we do this so that unit tests don't fail when the modules they're testing
  // log messages
  if (!instance)
  {
    instance = new BrowserLogger();
  }

  return instance;
};
