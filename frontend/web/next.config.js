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
      {
        source: '/api/projects/:path*',
        destination: 'http://localhost:8080/api/projects/:path*',
      },
      {
        source: '/api/tasks/:path*',
        destination: 'http://localhost:8080/api/tasks/:path*',
      },
      {
        source: '/api/teams/:path*',
        destination: 'http://localhost:8080/api/teams/:path*',
      },
    ];
  },
};
