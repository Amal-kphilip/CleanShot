import path from 'node:path';
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  webpack: (config, { isServer, webpack }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    // StripMeta ExifTool browser shim: zeroperl-ts has a Node.js-only dynamic import in its universal entry point.
    // Replace it only in client bundles; server-side Node builds retain the real builtin.
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:fs\/promises$/,
          path.resolve(process.cwd(), 'src/lib/shims/node-fs-promises-browser.js')
        )
      );
    }
    return config;
  },
};

export default nextConfig;
