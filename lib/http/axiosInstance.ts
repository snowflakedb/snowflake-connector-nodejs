import axiosLib, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as Util from '../util';
import Logger from '../logger';
import * as requestUtil from './request_util';

type SnowflakeAxiosRequestConfig = InternalAxiosRequestConfig & {
  useExperimentalRetryMiddleware?: boolean;
  __snowflakeRetryConfig?: {
    numRetries: number;
    totalElapsedTime: number;
    startingSleepTime: number;
    maxNumRetries: number;
    maxRetryTimeout: number;
  };
};

const axios = axiosLib.create();

/*
 * NOTE:
 * This interceptor enables request retries when useExperimentalRetryMiddleware=true.
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
      totalElapsedTime: 0,
      startingSleepTime: 1,
      maxNumRetries: 7,
      maxRetryTimeout: 300,
    };
    const { numRetries, totalElapsedTime, startingSleepTime, maxNumRetries, maxRetryTimeout } =
      config.__snowflakeRetryConfig;

    // TODO:
    // ensure test coverage for isRetryableNetworkError and isRetryableHttpError
    const isRetryable = err.response
      ? Util.isRetryableHttpError({ statusCode: err.response.status }, false)
      : true; // TODO: ['ERR_CANCELED', 'ECONNABORTED']; this 2 should be ignored

    if (isRetryable && numRetries <= maxNumRetries && totalElapsedTime <= maxRetryTimeout) {
      const newNumRetries = numRetries + 1;
      const jitter = Util.getJitteredSleepTime(
        newNumRetries,
        startingSleepTime,
        totalElapsedTime,
        maxRetryTimeout,
      );
      config.__snowflakeRetryConfig.totalElapsedTime = jitter.totalElapsedTime;
      config.__snowflakeRetryConfig.numRetries = newNumRetries;

      Logger().debug(
        'useExperimentalRetryMiddleware: Retrying request%s - error=%s, attempt=%s, delay=%ss',
        requestUtil.describeRequestFromOptions(config),
        err.message,
        newNumRetries,
        jitter.sleep,
      );
      await Util.sleep(jitter.sleep * 1000);
      return axios.request(config);
    } else {
      return Promise.reject(err);
    }
  },
);

export default axios;
