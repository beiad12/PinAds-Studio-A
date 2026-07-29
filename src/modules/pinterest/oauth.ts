/**
 * Pinterest OAuth 2.0 (authorization-code flow) via chrome.identity.launchWebAuthFlow.
 * Pinterest's token exchange requires client_secret, so this is only safe for a
 * locally-loaded, unpublished extension — never ship the client secret in a
 * Chrome Web Store listing.
 */

import type { PinterestAppCredentials, PinterestConnection } from '@/types';
import { nowISO } from '@/lib/id';

const AUTH_SCOPES = ['ads:read', 'ads:write', 'boards:read', 'boards:write', 'pins:read', 'pins:write'];

function getRedirectUri(): string {
  return chrome.identity.getRedirectURL('pinterest');
}

function buildAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL('https://www.pinterest.com/oauth/');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', AUTH_SCOPES.join(','));
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeCodeForToken(
  app: PinterestAppCredentials,
  code: string,
  redirectUri: string
): Promise<PinterestConnection> {
  const basicAuth = btoa(`${app.clientId}:${app.clientSecret}`);
  const response = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pinterest token exchange failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : undefined,
    connectedAt: nowISO(),
  };
}

/** Opens the Pinterest consent screen and resolves with a fresh connection. */
export async function authorize(app: PinterestAppCredentials): Promise<PinterestConnection> {
  const redirectUri = getRedirectUri();
  const state = crypto.randomUUID();
  const authUrl = buildAuthUrl(app.clientId, redirectUri, state);

  const resultUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });

  if (!resultUrl) {
    throw new Error('Pinterest authorization was cancelled.');
  }

  const params = new URL(resultUrl).searchParams;
  const returnedState = params.get('state');
  const code = params.get('code');
  const error = params.get('error');

  if (error) throw new Error(`Pinterest authorization failed: ${error}`);
  if (returnedState !== state) throw new Error('Pinterest authorization state mismatch.');
  if (!code) throw new Error('Pinterest authorization did not return a code.');

  return exchangeCodeForToken(app, code, redirectUri);
}

export async function refreshConnection(
  app: PinterestAppCredentials,
  connection: PinterestConnection
): Promise<PinterestConnection> {
  if (!connection.refreshToken) return connection;

  const basicAuth = btoa(`${app.clientId}:${app.clientSecret}`);
  const response = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pinterest token refresh failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return {
    ...connection,
    accessToken: data.access_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : connection.expiresAt,
  };
}

export function isExpiringSoon(connection: PinterestConnection): boolean {
  if (!connection.expiresAt) return false;
  return new Date(connection.expiresAt).getTime() - Date.now() < 60_000;
}
