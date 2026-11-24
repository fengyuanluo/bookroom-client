import { afterEach, describe, expect, test, vi } from 'vitest';
import nextConfig from '../../next.config.mjs';

describe('Next.js static export', () => {
  test('every production build is a static export', () => {
    // The web build is served by BookRoom (WEB_DIR) and Tauri embeds the same
    // export, so there is no Next server and therefore no response headers.
    expect(nextConfig.output).toBe('export');
  });
});

describe('Browser-only database WASM', () => {
  // The web build stores its database in turso's WASM build; Tauri uses the
  // native turso crate. Tauri embeds every file in `out/` into the binary, so
  // the WASM chunk must not be emitted there (a 12.7MB file, 3.3MB in the APK).
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const loadConfig = async (platform: string) => {
    vi.stubEnv('NEXT_PUBLIC_APP_PLATFORM', platform);
    vi.resetModules();
    return (await import('../../next.config.mjs')).default;
  };

  test('the Tauri build stubs the package the web database imports', async () => {
    const tauri = await loadConfig('tauri');
    expect(tauri.turbopack?.resolveAlias?.['@readest/turso-database-wasm/webpack']).toBe(
      './src/utils/stub.ts',
    );
  });

  test('the web build keeps it', async () => {
    const web = await loadConfig('web');
    expect(web.turbopack?.resolveAlias?.['@readest/turso-database-wasm/webpack']).toBeUndefined();
  });
});
