import axiosLib, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as Util from '../util';
import Logger from '../logger';
import * as requestUtil from './request_util';

export interface SnowflakeRetryConfig {
  maxRetries: number;
  sleepBase: number;
  sleepCap: number;
  includeRetryReason: boolean;
}

declare module 'axios' {
  interface AxiosRequestConfig {
    useSnowflakeRetryMiddleware?: boolean;
    snowflakeRetryConfig?: Partial<SnowflakeRetryConfig>;
  }
}

export type SnowflakeInternalAxiosRequestConfig = InternalAxiosRequestConfig & {
  __snowflakeRetryConfig?: SnowflakeRetryConfig;
  __snowflakeRetryState?: {
    startTime: number;
    numRetries: number;
    currentSleepTime: number;
  };
};

const DEFAULT_SNOWFLAKE_RETRY_CONFIG: SnowflakeRetryConfig = {
  maxRetries: 7,
  sleepBase: 1,
  sleepCap: 16,
  includeRetryReason: false,
};

const axios = axiosLib.create();

axios.interceptors.request.use((config: SnowflakeInternalAxiosRequestConfig) => {
  if (!config.useSnowflakeRetryMiddleware) {
    return config;
  }

  config.__snowflakeRetryConfig ??= {
    ...DEFAULT_SNOWFLAKE_RETRY_CONFIG,
    ...config.snowflakeRetryConfig,
  };
  config.__snowflakeRetryState ??= {
    startTime: Date.now(),
    numRetries: 0,
    currentSleepTime: 1,
  };
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  async (err: AxiosError) => {
    const config = err.config ? (err.config as SnowflakeInternalAxiosRequestConfig) : null;
    if (!config?.useSnowflakeRetryMiddleware) {
      return Promise.reject(err);
    }

    const isRetryable = err.response
      ? Util.isRetryableHttpError({ statusCode: err.response.status }, false)
      : err.code !== 'ERR_CANCELED'; // Network errors are retryable, but not client-canceled requests

    if (!isRetryable) {
      return Promise.reject(err);
    }

    const retryConfig = config.__snowflakeRetryConfig!;
    const retryState = config.__snowflakeRetryState!;

    if (retryState.numRetries < retryConfig.maxRetries) {
      const sleepTime = Util.nextSleepTime(
        retryConfig.sleepBase,
        retryConfig.sleepCap,
        retryState.currentSleepTime,
      );
      retryState.currentSleepTime = sleepTime;
      retryState.numRetries++;

      // Apply tracking parameters to the url
      const url = new URL(config.url ?? '', config.baseURL);
      url.searchParams.set('clientStartTime', retryState.startTime.toString());
      url.searchParams.set('retryCount', retryState.numRetries.toString());
      if (retryConfig.includeRetryReason) {
        url.searchParams.set('retryReason', (err.response?.status ?? 0).toString());
      }
      config.url = url.toString();

      Logger().debug(
        'useSnowflakeRetryMiddleware: Retrying request%s - error=%s, attempt=%s, delay=%ss',
        requestUtil.describeRequestFromOptions(config),
        err.message,
        retryState.numRetries,
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
