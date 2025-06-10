import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
  },
};

const msalClient = new ConfidentialClientApplication(msalConfig);

export const scopes = [
  'https://graph.microsoft.com/.default',
  'offline_access',
];

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class MicrosoftAuthError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'MicrosoftAuthError';
  }
}

export async function getAccessToken(code: string): Promise<TokenResponse> {
  try {
    const tokenResponse = await msalClient.acquireTokenByCode({
      code,
      scopes,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
    });

    if (!tokenResponse?.accessToken) {
      throw new MicrosoftAuthError('Failed to get access token');
    }

    const response = tokenResponse as any;

    return {
      accessToken: tokenResponse.accessToken,
      refreshToken: response.refreshToken || '',
      expiresIn: tokenResponse.expiresOn ? Math.floor((tokenResponse.expiresOn.getTime() - Date.now()) / 1000) : 3600,
    };
  } catch (error: any) {
    console.error('Error getting access token:', error);
    
    if (error.errorCode) {
      switch (error.errorCode) {
        case 'invalid_grant':
          throw new MicrosoftAuthError('Invalid authorization code', error.errorCode, 400);
        case 'invalid_client':
          throw new MicrosoftAuthError('Invalid client credentials', error.errorCode, 401);
        case 'invalid_request':
          throw new MicrosoftAuthError('Invalid request', error.errorCode, 400);
        case 'invalid_scope':
          throw new MicrosoftAuthError('Invalid scope', error.errorCode, 400);
        case 'unauthorized_client':
          throw new MicrosoftAuthError('Unauthorized client', error.errorCode, 401);
        case 'unsupported_grant_type':
          throw new MicrosoftAuthError('Unsupported grant type', error.errorCode, 400);
        default:
          throw new MicrosoftAuthError('Authentication failed', error.errorCode, 500);
      }
    }
    
    throw new MicrosoftAuthError('Authentication failed', undefined, 500);
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  try {
    const tokenResponse = await msalClient.acquireTokenByRefreshToken({
      refreshToken,
      scopes,
    });

    if (!tokenResponse?.accessToken) {
      throw new MicrosoftAuthError('Failed to refresh access token');
    }

    const response = tokenResponse as any;

    return {
      accessToken: tokenResponse.accessToken,
      refreshToken: response.refreshToken || '',
      expiresIn: tokenResponse.expiresOn ? Math.floor((tokenResponse.expiresOn.getTime() - Date.now()) / 1000) : 3600,
    };
  } catch (error: any) {
    console.error('Error refreshing access token:', error);
    
    if (error.errorCode) {
      switch (error.errorCode) {
        case 'invalid_grant':
          throw new MicrosoftAuthError('Invalid refresh token', error.errorCode, 400);
        case 'invalid_client':
          throw new MicrosoftAuthError('Invalid client credentials', error.errorCode, 401);
        case 'invalid_request':
          throw new MicrosoftAuthError('Invalid request', error.errorCode, 400);
        case 'invalid_scope':
          throw new MicrosoftAuthError('Invalid scope', error.errorCode, 400);
        case 'unauthorized_client':
          throw new MicrosoftAuthError('Unauthorized client', error.errorCode, 401);
        case 'unsupported_grant_type':
          throw new MicrosoftAuthError('Unsupported grant type', error.errorCode, 400);
        default:
          throw new MicrosoftAuthError('Token refresh failed', error.errorCode, 500);
      }
    }
    
    throw new MicrosoftAuthError('Token refresh failed', undefined, 500);
  }
}

export async function revokeToken(token: string): Promise<void> {
  try {
    const accounts = await msalClient.getTokenCache().getAllAccounts();
    const account = accounts.find(acc => acc.idTokenClaims?.sub === token);
    
    if (account) {
      await msalClient.getTokenCache().removeAccount(account);
    } else {
      throw new MicrosoftAuthError('Token not found', 'token_not_found', 404);
    }
  } catch (error) {
    console.error('Error revoking token:', error);
    throw new MicrosoftAuthError('Failed to revoke token', undefined, 500);
  }
}

export function getGraphClient(accessToken: string) {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

export async function getAuthUrl() {
  return msalClient.getAuthCodeUrl({
    scopes,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
  });
} 