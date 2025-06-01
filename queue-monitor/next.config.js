/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Disable CSS source maps in production to avoid 404 errors
  productionBrowserSourceMaps: false,
  // Configure webpack to handle CSS source maps properly
  webpack: (config, { dev }) => {
    if (!dev) {
      // Disable source maps for CSS in production
      config.devtool = false
    }
    return config
  }
}

module.exports = nextConfig
