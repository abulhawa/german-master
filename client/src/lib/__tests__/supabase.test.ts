import { afterEach, describe, expect, it, vi } from 'vitest';

import { cleanupSupabaseAuthUrl, getSupabaseAuthRedirectOrigin, getSupabaseAuthRedirectUrl } from '../supabase';

describe('Supabase auth URL helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    window.history.replaceState(null, '', '/');
  });

  it('builds a clean localhost redirect URL while preserving the current route path', () => {
    const redirectUrl = getSupabaseAuthRedirectUrl(
      new URL('http://localhost:5000/wortschatz?code=secret#access_token=secret'),
    );

    expect(redirectUrl).toBe('http://localhost:5000/wortschatz');
  });

  it('uses the current origin for auth redirect origins outside production', () => {
    const redirectOrigin = getSupabaseAuthRedirectOrigin(new URL('http://localhost:5173/wortschatz'));

    expect(redirectOrigin).toBe('http://localhost:5173');
  });

  it('uses the production auth origin for redirects in production', () => {
    vi.stubEnv('PROD', true);

    const redirectOrigin = getSupabaseAuthRedirectOrigin(new URL('http://localhost:3000/wortschatz'));
    const redirectUrl = getSupabaseAuthRedirectUrl(new URL('http://localhost:3000/wortschatz?code=secret'));

    expect(redirectOrigin).toBe('https://germanmaster.qortxai.com');
    expect(redirectUrl).toBe('https://germanmaster.qortxai.com/wortschatz');
  });

  it('removes Supabase token fragments without changing the app route path', () => {
    window.history.replaceState(
      { from: 'test' },
      '',
      '/wortschatz#access_token=secret&refresh_token=secret&provider_token=secret',
    );

    cleanupSupabaseAuthUrl();

    expect(window.location.pathname).toBe('/wortschatz');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(window.history.state).toEqual({ from: 'test' });
  });

  it('removes PKCE callback query parameters and keeps a non-auth hash', () => {
    window.history.replaceState(null, '', '/writing?code=secret&state=provider-state#section');

    cleanupSupabaseAuthUrl();

    expect(window.location.pathname).toBe('/writing');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('#section');
  });
});
