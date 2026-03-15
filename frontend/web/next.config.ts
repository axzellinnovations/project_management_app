import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
        protocol: 'https',
        hostname: '*.amazonaws.com', 
        port: '',
        pathname: '/**', 
      },
    ],
  },
};

export default nextConfig;