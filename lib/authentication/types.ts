export interface AuthRequestBody {
  data: {
    [key: string]: any;
  };
}

export interface AuthClass {
  updateBody(body: AuthRequestBody): void;
  authenticate(): Promise<void>;
  /**
   * Retry handler for re-authenticating after login request failure.
   *
   * This method is only recognized and called for specific auth providers
   * (e.g. Okta, Keypair). The connection retry logic contains explicit checks
   * for these providers - implementing this method on other auth providers
   * will have no effect.
   */
  reauthenticate?(body: AuthRequestBody): Promise<void>;
}
