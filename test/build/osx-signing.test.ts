import { describe, it, expect } from 'vitest';
import { osxSignOptions, osxNotarizeOptions } from '../../src/build/osx-signing';

describe('osxSignOptions', () => {
  it('is undefined without a certificate', () => {
    expect(osxSignOptions({})).toBeUndefined();
  });
  it('enables signing when a certificate is present', () => {
    expect(osxSignOptions({ APPLE_CERTIFICATE: 'base64==' })).toEqual({});
  });
});

describe('osxNotarizeOptions', () => {
  it('is undefined when any credential is missing', () => {
    expect(osxNotarizeOptions({})).toBeUndefined();
    expect(osxNotarizeOptions({ APPLE_ID: 'a', APPLE_APP_SPECIFIC_PASSWORD: 'b' })).toBeUndefined();
  });
  it('maps all three credentials when present', () => {
    expect(
      osxNotarizeOptions({
        APPLE_ID: 'me@example.com',
        APPLE_APP_SPECIFIC_PASSWORD: 'abcd-efgh',
        APPLE_TEAM_ID: 'TEAM123',
      }),
    ).toEqual({ appleId: 'me@example.com', appleIdPassword: 'abcd-efgh', teamId: 'TEAM123' });
  });
});
