// Env-gated macOS signing/notarization config for electron-forge.
// Returns `undefined` when credentials are absent so local builds stay unsigned
// and never fail.

export function osxSignOptions(
  env: NodeJS.ProcessEnv,
): Record<string, never> | undefined {
  // Empty object enables @electron/osx-sign with the Developer ID identity that
  // CI imports into the keychain. Absent cert → skip signing.
  return env.APPLE_CERTIFICATE ? {} : undefined;
}

export function osxNotarizeOptions(
  env: NodeJS.ProcessEnv,
): { appleId: string; appleIdPassword: string; teamId: string } | undefined {
  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) return undefined;
  return {
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  };
}
