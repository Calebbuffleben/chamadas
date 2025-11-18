export type BackendFetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  auth?: boolean;
  accessToken?: string;
  throwOnError?: boolean;
};


