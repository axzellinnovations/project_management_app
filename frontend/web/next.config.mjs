/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  turbopack: {
    root: '/Users/sinthuha/Desktop/project_management_app/frontend/web',
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
    return [
      {
        source: '/api/chat/:path*',
        destination: `${backendUrl}/api/chat/:path*`,
      },
      {
        source: '/api/auth/:path*',
        destination: `${backendUrl}/api/auth/:path*`,
      },
      {
        source: '/api/projects/:path*',
        destination: `${backendUrl}/api/projects/:path*`,
      },
      {
        source: '/api/tasks/:path*',
        destination: `${backendUrl}/api/tasks/:path*`,
      },
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

export default nextConfig;