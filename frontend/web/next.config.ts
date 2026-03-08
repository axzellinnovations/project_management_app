import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8080',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'planaro-profile-photos.s3.eu-north-1.amazonaws.com', 
        port: '',
        pathname: '/**', 
      },
    ],
  },
};

export default nextConfig;