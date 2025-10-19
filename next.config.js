/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  typescript: {
    // Type checking is handled by separate script
    ignoreBuildErrors: false,
  },
  eslint: {
    // ESLint checking is handled by separate script
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig

