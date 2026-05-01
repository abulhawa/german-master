import { describe, expect, it } from 'vitest';

import { getPrimaryNavigationItems, isNavigationItemActive } from '../navigation';

describe('navigation helpers', () => {
  it('hides Writing by default in primary navigation', () => {
    expect(getPrimaryNavigationItems(null).map((item) => item.href)).toEqual([
      '/',
      '/wortschatz',
      '/progress',
    ]);
  });

  it('shows Writing when the Writing Lab feature is enabled', () => {
    expect(getPrimaryNavigationItems(null, { writingLab: true }).map((item) => item.href)).toEqual([
      '/',
      '/writing',
      '/wortschatz',
      '/progress',
    ]);
  });

  it('treats the dedicated Wortschatz route as an exact navigation match', () => {
    expect(isNavigationItemActive('/wortschatz', { href: '/wortschatz', exact: true })).toBe(true);
    expect(isNavigationItemActive('/wortschatz/drill', { href: '/wortschatz', exact: true })).toBe(
      false,
    );
    expect(isNavigationItemActive('/progress', { href: '/wortschatz', exact: true })).toBe(false);
  });
});
