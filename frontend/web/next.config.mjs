import withPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  turbopack: {},
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
    const proxy = (path) => ({
      source: `/api/${path}/:path*`,
      destination: `${backendUrl}/api/${path}/:path*`,
    });
    return [
      proxy('auth'),
      proxy('projects'),
      proxy('tasks'),
      proxy('sprints'),
      proxy('sprintboards'),
      proxy('burndown'),
      proxy('calendar'),
      proxy('kanban'),
      proxy('labels'),
      proxy('users'),
      proxy('teams'),
      proxy('notifications'),
      proxy('chat'),
      proxy('folders'),
      proxy('dms'),
      proxy('search'),
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8080',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'backend',
        port: '8080',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com', 
        port: '',
        pathname: '/**', 
      },
    ],
  },
};

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  scope: '/',
})(nextConfig);