/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Turn off strict mode to avoid double renders in development

  // WebRTC and mediasoup require access to browser APIs
  // that Next.js might restrict in some environments
  webpack: (config, { isServer, dev }) => {
    // This is only needed for client-side code
    if (!isServer) {
      // Allow WebRTC and mediasoup libraries to use browser globals
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },

  // We need to enable CORS for WebRTC connections
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
