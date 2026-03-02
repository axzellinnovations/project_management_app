/** @type {import('next').NextConfig} */
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/chat/:path*',
        destination: 'http://localhost:8080/api/chat/:path*',
      },
      {
        source: '/api/auth/:path*',
        destination: 'http://localhost:8080/api/auth/:path*',
      },
    ];
  },
};
