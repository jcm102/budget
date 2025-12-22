/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack(config) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

module.exports = nextConfig;
