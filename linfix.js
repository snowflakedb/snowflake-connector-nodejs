let retryTimeout = 300;
if (Util.exists(options.retryTimeout)) {
  Errors.checkArgumentValid(Util.isNumber(options.retryTimeout),
    ErrorCodes.ERR_CONN_CREATE_INVALID_MAX_RETRY_TIMEOUT);

  retryTimeout = options.retryTimeout !== 0 ? Math.max(retryTimeout, options.retryTimeout) : 0;
}