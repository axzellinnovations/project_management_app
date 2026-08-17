import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isProduction = process.env.NODE_ENV === 'production';
const localBackendOrigin = 'http://localhost:8080';
const localWebSocketOrigin = 'ws://localhost:8080';
const awsRegion = process.env.AWS_REGION || 'eu-north-1';
const productionS3Buckets = [
  process.env.AWS_S3_PROFILE_BUCKET,
  process.env.AWS_S3_DMS_BUCKET,
  process.env.AWS_S3_CHAT_BUCKET,
  process.env.AWS_S3_TASK_BUCKET,
  'planora-prod-profile-photos-657347292859-eu-north-1-an',
  'planora-prod-dms-documents',
  'planora-prod-chat-attachments-657347292859-eu-north-1-an',
  'planora-prod-task-attachments-657347292859-eu-north-1-an',
].filter(Boolean);
const awsS3Sources = [
  'https://s3.amazonaws.com',
  `https://s3.${awsRegion}.amazonaws.com`,
  'https://*.amazonaws.com',
  'https://*.s3.amazonaws.com',
  `https://*.s3.${awsRegion}.amazonaws.com`,
  `https://*.s3-${awsRegion}.amazonaws.com`,
  ...productionS3Buckets.flatMap((bucket) => [
    `https://${bucket}.s3.amazonaws.com`,
    `https://${bucket}.s3.${awsRegion}.amazonaws.com`,
    `https://${bucket}.s3-${awsRegion}.amazonaws.com`,
  ]),
];
const githubAvatarImageSource = 'https://avatars.githubusercontent.com';
const diceBearImageSource = 'https://api.dicebear.com';
const figmaFrameSources = ['https://www.figma.com', 'https://embed.figma.com'];

function originsFromCsv(rawValue) {
  if (!rawValue) return [];

  return rawValue
    .split(',')
    .map((value) => originFromUrl(value.trim()))
    .filter(Boolean);
}

function originFromUrl(rawUrl) {
  if (!rawUrl) return null;

  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

function websocketOriginFromUrl(rawUrl) {
  const origin = originFromUrl(rawUrl);
  if (!origin) return null;

  return origin
    .replace(/^https:/i, 'wss:')
    .replace(/^http:/i, 'ws:');
}

function uniqueSources(sources) {
  return sources.filter(Boolean).filter((source, index, all) => all.indexOf(source) === index);
}

function remotePatternFromOrigin(origin) {
  try {
    const url = new URL(origin);
    return {
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      port: url.port,
      pathname: '/**',
    };
  } catch {
    return null;
  }
}

const allowedImageOrigins = uniqueSources(originsFromCsv(process.env.NEXT_PUBLIC_IMAGE_ALLOWED_ORIGINS));
const allowedImageRemotePatterns = allowedImageOrigins
  .map(remotePatternFromOrigin)
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
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
      proxy('kanbans'),
      proxy('kanban-columns'),
      proxy('labels'),
      proxy('users'),
      proxy('teams'),
      proxy('notifications'),
      proxy('chat'),
      proxy('folders'),
      proxy('dms'),
      proxy('milestones'),
      proxy('user'),
      proxy('pages'),
      proxy('scheduled-reports'),
      proxy('reports'),
      proxy('search'),
      proxy('github'),
      proxy('portfolios'),
      proxy('dashboard'),
    ];
  },
  async headers() {
    const backendHost = process.env.NEXT_PUBLIC_BACKEND_HOST;
    const backendHostOrigin = backendHost ? `https://${backendHost}` : null;
    const publicApiOrigin = originFromUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
    const publicBackendOrigin = originFromUrl(process.env.NEXT_PUBLIC_BACKEND_URL);
    const rewriteBackendOrigin = originFromUrl(process.env.BACKEND_URL);
    const websocketOrigin = websocketOriginFromUrl(
      process.env.NEXT_PUBLIC_WS_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.BACKEND_URL,
    );
    const localSources = isProduction ? [] : [localBackendOrigin];
    const localWebSocketSources = isProduction ? [] : [localWebSocketOrigin];

    const backendSources = uniqueSources([
      backendHostOrigin,
      publicApiOrigin,
      publicBackendOrigin,
      rewriteBackendOrigin,
      ...localSources,
    ]);
    const connectSources = uniqueSources([
      "'self'",
      ...backendSources,
      websocketOrigin,
      ...localWebSocketSources,
      ...awsS3Sources,
    ]);
    const imageSources = uniqueSources([
      "'self'",
      'data:',
      'blob:',
      'https:',
      ...awsS3Sources,
      githubAvatarImageSource,
      diceBearImageSource,
      ...backendSources,
      ...allowedImageOrigins,
    ]);
    // Allow any https origin for connects as well to reduce CSP image/connect blocking in dev
    const connectSourcesWithHttps = uniqueSources(['https:', ...connectSources]);
    const frameSources = uniqueSources([
      "'self'",
      ...awsS3Sources,
      'blob:',
      ...figmaFrameSources,
      ...backendSources,
    ]);

    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src ${imageSources.join(' ')};
      connect-src ${connectSourcesWithHttps.join(' ')};
      font-src 'self' data:;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      frame-src ${frameSources.join(' ')};
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; script-src 'self'; connect-src 'self';",
          },
        ],
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
        hostname: '**.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
      // AWS backend (App Runner / ECS ALB) — set NEXT_PUBLIC_BACKEND_HOST in Netlify env vars
      ...(process.env.NEXT_PUBLIC_BACKEND_HOST
        ? [{ protocol: 'https', hostname: process.env.NEXT_PUBLIC_BACKEND_HOST, port: '', pathname: '/**' }]
        : []),
      ...allowedImageRemotePatterns,
    ],
  },
};

export default nextConfig;
