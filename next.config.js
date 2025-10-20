/**
 * Next.js configuration for RIV MVP
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  /**
   * TypeScript configuration
   * Type checking is handled by separate script for better performance
   */
  typescript: {
    ignoreBuildErrors: false,
  },
  /**
   * ESLint configuration
   * ESLint checking is handled by separate script for better performance
   */
  eslint: {
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig

