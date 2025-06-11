export interface AuthRequestBody {
  data: {
    [key: string]: any;
  }
}

export interface AuthClass {
  updateBody(body: AuthRequestBody): Promise<void>;
  authenticate(): Promise<void>;
  reauthenticate(): Promise<void>;
}
