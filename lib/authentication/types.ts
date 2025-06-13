export interface AuthRequestBody {
  data: {
    [key: string]: any;
  }
}

export interface AuthClass {
  updateBody(body: AuthRequestBody): void;
  authenticate(): Promise<void>;
  reauthenticate(body: AuthRequestBody): Promise<void>;
}
