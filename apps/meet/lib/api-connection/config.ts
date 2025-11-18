const BACKEND_URL_ENV = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;

export const BACKEND_BASE_URL = BACKEND_URL_ENV ?? 'http://localhost:3001';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const CURRENT_ORG_COOKIE = 'current_org';

export const COOKIE_PATH = '/';

export const isSecureCookie = (): boolean =>
  process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test';


