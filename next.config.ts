import { env } from "@/lib/env";
import type { NextConfig } from "next";

// Ensures that `env` is not an unused variable. Importing `env` during build-time
// ensures that the project never gets deployed unless all environment variables
// have been properly configured.
if (!env.NEXT_RUNTIME) {
  throw new Error("NEXT_RUNTIME is not set");
}

let nextConfig: NextConfig = {
  reactStrictMode: !env.DISABLE_STRICT_MODE,
  /** We already do linting as separate tasks in CI */
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  allowedDevOrigins: ["https://helperai.dev", "https://localhost:3000"],
  // https://github.com/nextauthjs/next-auth/discussions/9385#discussioncomment-8875108
  transpilePackages: ["next-auth"],
  serverExternalPackages: ["natural", "picocolors", "redis", "@redis/client", "@readme/openapi-parser", "dotenv", "argon2", "sharp", "googleapis", "nodemailer", "mailparser", "pg", "drizzle-orm", "node:crypto", "node-gyp-build"],

  // Performance optimizations
  compress: true,
  generateEtags: true,
  httpAgentOptions: {
    keepAlive: true,
  },

  // Bundle optimization
  swcMinify: true,
  modularizeImports: {
    '@/components/ui': {
      transform: '@/components/ui/{{member}}',
    },
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
      skipDefaultConversion: true,
    },
  },

  // Experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    webpackBuildWorker: true,
    parallelServerCompiles: true,
    parallelServerBuildTraces: true,
    serverComponentsExternalPackages: ['node:crypto'],
  },
  outputFileTracingIncludes: {
    "/widget/sdk.js": ["./public/**/*"],
  },
  outputFileTracingExcludes: {
    // canvas is a huge module which can overflow the edge function size limit on Vercel.
    // PDF.js includes it for Node.js support but we don't need it as we only use it in the browser.
    "/conversations": ["node_modules/canvas"],
    "/api/job": ["node_modules/canvas"],
  },
  devIndicators: process.env.IS_TEST_ENV === "1" ? false : undefined,
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "secure.gravatar.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.slack-edge.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  webpack(config, { webpack }) {
    // @ts-expect-error - no types
    const fileLoaderRule = config.module.rules.find((rule) => rule.test?.test?.(".svg"));
    config.module.rules.push(
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] }, // exclude if *.svg?url
        use: ["@svgr/webpack"],
      },
    );
    fileLoaderRule.exclude = /\.svg$/i;

    // Needed to support pdfjs
    config.resolve.alias.canvas = false;

    // Add Node.js polyfills for client-side compatibility
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "http": false,
      "https": false,
      "url": false,
      "zlib": false,
      "stream": false,
      "util": false,
      "buffer": false,
      "assert": false,
      "net": false,
      "tls": false,
      "fs": false,
      "path": false,
      "os": false,
      "crypto": false,
      "node:crypto": false,
      "child_process": false,
      "worker_threads": false,
      "cluster": false,
      "events": false,
      "querystring": false,
      "punycode": false,
      "http2": false,
      "dns": false,
      "module": false,
      "vm": false,
      "constants": false,
    };

    // Add alias for node:crypto to prevent client-side bundling
    config.resolve.alias = {
      ...config.resolve.alias,
      "node:crypto": false,
    };

    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^pg-native$|^cloudflare:sockets$|^argon2$|^node-gyp-build$/,
      }),
      new webpack.NormalModuleReplacementPlugin(
        /^node:crypto$/,
        require.resolve('./lib/node-crypto-mock.js')
      )
    )

    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self';",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Performance and caching headers
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
      {
        source: "/widget/embed",
        headers: [
          {
            key: "X-Frame-Options",
            value: "ALLOW-FROM *",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;",
          },
        ],
      },
    ];
  },
};

export default nextConfig
