/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/auth/:path*',
        destination: `${apiUrl}/auth/:path*`,
      },
      {
        source: '/health/:path*',
        destination: `${apiUrl}/health/:path*`,
      },
      {
        source: '/admin/:path*',
        destination: `${apiUrl}/admin/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
