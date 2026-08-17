import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import nextConfig from '../next.config.mjs';

const root = process.cwd();
const requiredManifest = {
  id: '/',
  name: 'Planora - Plan, Track, Ship',
  short_name: 'Planora',
  start_url: '/?source=pwa',
  scope: '/',
  display: 'standalone',
};
const requiredIcons = [
  ['public/apple-touch-icon.png', 180, 180],
  ['public/icons/icon-192x192.png', 192, 192],
  ['public/icons/icon-512x512.png', 512, 512],
  ['public/icons/maskable-512x512.png', 512, 512],
];
const requiredMetadataTokens = [
  'application-name',
  'rel":"manifest',
  'apple-mobile-web-app-title',
  'apple-mobile-web-app-status-bar-style',
  'apple-touch-icon',
  'theme-color',
];
const requiredServiceWorkerSnippets = [
  'SKIP_WAITING',
  'navigationPreload',
  'MAX_STATIC_CACHE_ENTRIES',
  'startsWith(\'/api/\')',
];
const requiredRegistrationSnippets = [
  'registration.update()',
  'visibilitychange',
  'focus',
  'PWA_UPDATE_CHECK_INTERVAL_MS',
];
const requiredShortcuts = [
  ['/dashboard?source=pwa-shortcut', 'Dashboard'],
  ['/spaces?source=pwa-shortcut', 'Spaces'],
  ['/inbox?source=pwa-shortcut', 'Inbox'],
  ['/createProject?source=pwa-shortcut', 'Create Project'],
];
const requiredScreenshots = [
  ['/screenshots/planora-dashboard-wide.svg', '1280x720', 'wide'],
  ['/screenshots/planora-dashboard-mobile.svg', '390x844', 'narrow'],
];

function fail(message) {
  throw new Error(message);
}

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Missing ${relativePath}. Run npm run build before npm run pwa:check.`);
  }
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function readText(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Missing ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

async function validateManifest() {
  const manifest = readJson('.next/server/app/manifest.webmanifest.body');

  Object.entries(requiredManifest).forEach(([key, value]) => {
    if (manifest[key] !== value) {
      fail(`Manifest ${key} expected ${value}, received ${manifest[key]}`);
    }
  });

  const iconSources = new Set((manifest.icons || []).map((icon) => icon.src));
  ['/icons/icon-192x192.png', '/icons/icon-512x512.png', '/icons/maskable-512x512.png'].forEach((src) => {
    if (!iconSources.has(src)) {
      fail(`Manifest is missing icon ${src}`);
    }
  });

  requiredShortcuts.forEach(([url, name]) => {
    const shortcut = (manifest.shortcuts || []).find((entry) => entry.url === url);
    if (!shortcut) fail(`Manifest is missing shortcut ${url}`);
    if (shortcut.name !== name) fail(`Shortcut ${url} expected name ${name}, received ${shortcut.name}`);
  });

  requiredScreenshots.forEach(([src, sizes, formFactor]) => {
    const screenshot = (manifest.screenshots || []).find((entry) => entry.src === src);
    if (!screenshot) fail(`Manifest is missing screenshot ${src}`);
    if (screenshot.sizes !== sizes) fail(`Screenshot ${src} expected size ${sizes}, received ${screenshot.sizes}`);
    if (screenshot.form_factor !== formFactor) fail(`Screenshot ${src} expected form_factor ${formFactor}, received ${screenshot.form_factor}`);
  });
}

async function validateIcons() {
  await Promise.all(requiredIcons.map(async ([relativePath, width, height]) => {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      fail(`Missing icon ${relativePath}`);
    }

    const metadata = await sharp(absolutePath).metadata();
    if (metadata.width !== width || metadata.height !== height || metadata.format !== 'png') {
      fail(`${relativePath} expected ${width}x${height} png, received ${metadata.width}x${metadata.height} ${metadata.format}`);
    }
  }));
}

async function validateScreenshots() {
  requiredScreenshots.forEach(([src]) => {
    const relativePath = `public${src}`;
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      fail(`Missing screenshot asset ${relativePath}`);
    }
    const content = fs.readFileSync(absolutePath, 'utf8');
    if (!content.includes('<svg') || !content.includes('role="img"')) {
      fail(`${relativePath} must be an accessible SVG screenshot asset`);
    }
  });
}

function validateServiceWorker() {
  const serviceWorker = readText('public/sw.js');
  requiredServiceWorkerSnippets.forEach((snippet) => {
    if (!serviceWorker.includes(snippet)) {
      fail(`Service worker is missing "${snippet}"`);
    }
  });
}

function validateServiceWorkerRegistration() {
  const registration = readText('components/pwa/PWARegistration.tsx');
  requiredRegistrationSnippets.forEach((snippet) => {
    if (!registration.includes(snippet)) {
      fail(`PWA registration is missing "${snippet}"`);
    }
  });
}

async function validateServiceWorkerHeaders() {
  const headers = await nextConfig.headers();
  const swRule = headers.find((rule) => rule.source === '/sw.js');
  if (!swRule) fail('next.config.mjs is missing a /sw.js headers rule');

  const headerMap = new Map(swRule.headers.map((header) => [header.key.toLowerCase(), header.value]));
  const cacheControl = headerMap.get('cache-control') || '';
  const contentType = headerMap.get('content-type') || '';
  const csp = headerMap.get('content-security-policy') || '';
  const allowed = headerMap.get('service-worker-allowed') || '';

  if (!contentType.includes('application/javascript')) fail('/sw.js Content-Type must be application/javascript');
  if (!cacheControl.includes('no-cache') || !cacheControl.includes('no-store')) fail('/sw.js Cache-Control must include no-cache and no-store');
  if (allowed !== '/') fail('/sw.js Service-Worker-Allowed must be /');
  if (csp !== "default-src 'none'; script-src 'self'; connect-src 'self';") fail('/sw.js CSP is not the expected strict policy');
}

async function validateApplicationCspHeaders() {
  const headers = await nextConfig.headers();
  const appRule = headers.find((rule) => rule.source === '/:path*');
  if (!appRule) fail('next.config.mjs is missing the application headers rule');

  const headerMap = new Map(appRule.headers.map((header) => [header.key.toLowerCase(), header.value]));
  const csp = headerMap.get('content-security-policy') || '';
  const frameSrc = csp.match(/frame-src\s+([^;]+)/)?.[1] || '';

  if (!frameSrc.includes('https://www.figma.com')) fail('Application CSP frame-src must include https://www.figma.com');
  if (!frameSrc.includes('https://embed.figma.com')) fail('Application CSP frame-src must include https://embed.figma.com');
}

function validateMetadata() {
  const rootHead = readText('.next/server/app/index.segments/_head.segment.rsc');
  requiredMetadataTokens.forEach((token) => {
    if (!rootHead.includes(token)) {
      fail(`Built root metadata is missing "${token}"`);
    }
  });
}

async function main() {
  await validateManifest();
  await validateIcons();
  await validateScreenshots();
  validateServiceWorker();
  validateServiceWorkerRegistration();
  await validateServiceWorkerHeaders();
  await validateApplicationCspHeaders();
  validateMetadata();
  console.log('PWA validation passed.');
}

main().catch((error) => {
  console.error(`PWA validation failed: ${error.message}`);
  process.exit(1);
});
