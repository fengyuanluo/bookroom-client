import withSerwistInit from '@serwist/next';
import withBundleAnalyzer from '@next/bundle-analyzer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env['NODE_ENV'] === 'development';
const appPlatform = process.env['NEXT_PUBLIC_APP_PLATFORM'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Every production build is a static export: Tauri embeds it, and BookRoom
  // serves the web build itself (WEB_DIR), so there is no Next server at all.
  output: isDev ? undefined : 'export',
  pageExtensions: ['jsx', 'tsx'],
  // Note: This feature is required to use the Next.js Image component in SSG mode.
  // See https://nextjs.org/docs/messages/export-image-api for different workarounds.
  images: {
    unoptimized: true,
  },
  devIndicators: false,
  experimental: {
    // Dev caching is on by default since Next 16.1. We deliberately turn OFF
    // Turbopack's build cache, which Next 16.4 enables by default: a build
    // interrupted mid-compile leaves a partial cache that the next build
    // mishandles, fanning out workers until it exhausts RAM, and a warm cache
    // can abort with a turbo-tasks panic (`get_disjoint_mut` was called with
    // equal keys) when the import graph changes.
    turbopackFileSystemCacheForDev: true,
    turbopackFileSystemCacheForBuild: false,
  },
  // Configure assetPrefix or else the server won't properly resolve your assets.
  assetPrefix: '',
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      nunjucks: 'nunjucks/browser/nunjucks.js',
      // `js-mdict` is consumed as TS source via tsconfig paths from
      // `packages/js-mdict/src/`; its sources `import 'fflate'` directly.
      // Without an alias, webpack walks up from that source location and
      // can't find fflate (only installed in this app's node_modules).
      fflate: path.resolve(__dirname, 'node_modules/fflate'),
      ...(appPlatform !== 'web' ? { '@readest/turso-database-wasm/webpack': false } : {}),
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      nunjucks: 'nunjucks/browser/nunjucks.js',
      // Turbopack rejects absolute paths in resolveAlias ("server relative
      // imports not implemented") — use a project-relative path.
      fflate: './node_modules/fflate',
      // Only the web build stores its database in turso's WASM build; Tauri
      // embeds every file in `out/`, so emitting the unused WASM there would
      // ship it inside the app.
      ...(appPlatform !== 'web'
        ? { '@readest/turso-database-wasm/webpack': './src/utils/stub.ts' }
        : {}),
    },
  },
  transpilePackages: [
    'ai',
    'ai-sdk-ollama',
    '@ai-sdk/react',
    '@assistant-ui/react',
    '@assistant-ui/react-ai-sdk',
    '@assistant-ui/react-markdown',
    'streamdown',
    ...(isDev
      ? []
      : [
          'i18next-browser-languagedetector',
          'react-i18next',
          'i18next',
          '@tauri-apps',
          'highlight.js',
          'foliate-js',
          'marked',
        ]),
  ],
  // Dev server only (an export ignores rewrites): annotation deep links use the
  // pretty path, which the /o page also parses from `location` in production.
  async rewrites() {
    return [
      {
        source: '/o/book/:hash/annotation/:id',
        destination: '/o?book=:hash&note=:id',
      },
    ];
  },
};

const pwaDisabled = isDev || appPlatform !== 'web';

const withPWA = pwaDisabled
  ? (config) => config
  : withSerwistInit({
      swSrc: 'src/sw.ts',
      swDest: 'public/sw.js',
      cacheOnNavigation: true,
      reloadOnOnline: true,
      disable: false,
      register: true,
      scope: '/',
    });

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withPWA(withAnalyzer(nextConfig));
