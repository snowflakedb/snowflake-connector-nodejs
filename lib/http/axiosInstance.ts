import axiosLib, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as Util from '../util';
import Logger from '../logger';
import * as requestUtil from './request_util';

type SnowflakeAxiosRequestConfig = InternalAxiosRequestConfig & {
  useExperimentalRetryMiddleware?: boolean;
  __snowflakeRetryConfig?: {
    numRetries: number;
    maxNumRetries: number;
  };
};

const axios = axiosLib.create();

/*
 * NOTE:
 * This interceptor enable request retries when useExperimentalRetryMiddleware=true.
 *
 * It's marked as experimental, because it doesn't handle retry customization ATM and is intended
 * to be used with endpoints that have no other retry handling.
 *
 * Future improvements:
 * - Handle retry customization (similar to axios-retry library)
 * - Support retry telemetry (retryCount and retryReason query params)
 * - Consider replacing code with axios-retry
 * - Support abort signal
 */
axios.interceptors.response.use(
  (response) => response,
  async (err: AxiosError) => {
    const config = err.config ? (err.config as SnowflakeAxiosRequestConfig) : null;
    if (!config || !config.useExperimentalRetryMiddleware) {
      return Promise.reject(err);
    }

    config.__snowflakeRetryConfig ??= {
      numRetries: 0,
      maxNumRetries: 7,
    };

    const retryConfig = config.__snowflakeRetryConfig;
    const isRetryable = err.response
      ? Util.isRetryableHttpError({ statusCode: err.response.status }, false)
      : true; // TODO: ['ERR_CANCELED', 'ECONNABORTED']; this 2 should be ignored

    if (isRetryable && retryConfig.numRetries <= retryConfig.maxNumRetries) {
      retryConfig.numRetries++;
      Logger().debug(
        'Retrying request%s - attempt %s',
        requestUtil.describeRequestFromOptions(config),
        retryConfig.numRetries,
      );
      // TODO: backoff and sleep here
      return axios.request(config);
    } else {
      return Promise.reject(err);
    }
  },
);

export default axios;
