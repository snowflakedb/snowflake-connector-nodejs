import axiosLib, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as Util from '../util';
import Logger from '../logger';
import * as requestUtil from './request_util';

declare module 'axios' {
  interface AxiosRequestConfig {
    useSnowflakeRetryMiddleware?: boolean;
  }
}

export type SnowflakeInternalAxiosRequestConfig = InternalAxiosRequestConfig & {
  __snowflakeRetryConfig?: {
    numRetries: number;
    currentSleepTime: number;
    maxNumRetries: number;
    sleepBase: number;
    sleepCap: number;
  };
};

const axios = axiosLib.create();

axios.interceptors.response.use(
  (response) => response,
  async (err: AxiosError) => {
    const config = err.config ? (err.config as SnowflakeInternalAxiosRequestConfig) : null;
    if (!config || !config.useSnowflakeRetryMiddleware) {
      return Promise.reject(err);
    }

    const isRetryable = err.response
      ? Util.isRetryableHttpError({ statusCode: err.response.status }, false)
      : err.code !== 'ERR_CANCELED'; // Network errors are retryable, but not client-canceled requests

    if (!isRetryable) {
      return Promise.reject(err);
    }

    // NOTE:
    // Hardcoded values for now, later might allow to configure
    config.__snowflakeRetryConfig ??= {
      numRetries: 0,
      currentSleepTime: 1,
      maxNumRetries: 7,
      sleepBase: 1,
      sleepCap: 16,
    };
    const { numRetries, currentSleepTime, maxNumRetries, sleepBase, sleepCap } =
      config.__snowflakeRetryConfig;

    if (numRetries < maxNumRetries) {
      const sleepTime = Util.nextSleepTime(sleepBase, sleepCap, currentSleepTime);
      config.__snowflakeRetryConfig.currentSleepTime = sleepTime;
      config.__snowflakeRetryConfig.numRetries++;

      Logger().debug(
        'useSnowflakeRetryMiddleware: Retrying request%s - error=%s, attempt=%s, delay=%ss',
        requestUtil.describeRequestFromOptions(config),
        err.message,
        config.__snowflakeRetryConfig.numRetries,
        sleepTime,
      );
      await Util.sleep(sleepTime * 1000);
      return axios.request(config);
    } else {
      return Promise.reject(err);
    }
  },
);

export default axios;
