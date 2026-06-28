// Env-gated macOS signing/notarization config for electron-forge.
// Returns `undefined` when credentials are absent so local builds stay unsigned
// and never fail.

export interface OsxSignConfig {
  // Keychain holding the Developer ID identity. In CI the cert is imported into a
  // temporary keychain; @electron/osx-sign otherwise only searches the default
  // `login` keychain and silently finds no identity.
  keychain?: string;
  // Per-file signing options. Hardened runtime + entitlements are required for
  // notarization; the entitlements also cover the bundled CLI tools (yt-dlp/ffmpeg).
  optionsForFile: (filePath: string) => {
    hardenedRuntime: boolean;
    entitlements: string;
  };
}

export const ENTITLEMENTS_PATH = 'resources/entitlements.plist';

export function osxSignOptions(
  env: NodeJS.ProcessEnv,
): OsxSignConfig | undefined {
  // Absent cert → skip signing so local/unsecured builds stay unsigned and never fail.
  if (!env.APPLE_CERTIFICATE) return undefined;

  const config: OsxSignConfig = {
    optionsForFile: () => ({
      hardenedRuntime: true,
      entitlements: ENTITLEMENTS_PATH,
    }),
  };

  // CI exports the temporary keychain path so signing finds the imported identity.
  if (env.SIGNING_KEYCHAIN) config.keychain = env.SIGNING_KEYCHAIN;

  return config;
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
