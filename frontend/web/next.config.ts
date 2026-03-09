import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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