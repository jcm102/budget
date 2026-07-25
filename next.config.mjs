/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Allow the Cloud Workstation URL to perform cross-origin requests
  experimental: {
    allowedDevOrigins: [
      '9000-firebase-studio-1754251559574.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev',
      '*.cloudworkstations.dev'
    ],
    // 2. Prevent Node-only AI libraries from being bundled for the browser
    serverComponentsExternalPackages: [
      'genkit',
      '@genkit-ai/ai',
      '@genkit-ai/core',
      '@genkit-ai/dotprompt',
      'handlebars',
      'require-in-the-middle'
    ],
  },

  // 3. Webpack configuration for Cloud Workstations environment
  webpack: (config, { isServer }) => {
    // Resolve issues with Node-specific modules (fs, path, etc.) when building the client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        module: false,
        path: false,
        os: false,
      };
    }

    // 4. Force the Hot Module Replacement (HMR) to use the workstation's proxy
    config.watchOptions = {
      poll: 1000,   // Check for changes every second
      aggregateTimeout: 300,
    };

    return config;
  },
};

export default nextConfig;