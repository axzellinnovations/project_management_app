/**
 * Normalizes an external URL to ensure it has a valid protocol (http or https).
 * Trims whitespace and returns null if the string is empty or invalid.
 */
export function normalizeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Add https:// prefix if protocol is missing
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      // Basic sanity check on hostname
      if (url.hostname && url.hostname.includes('.')) {
        return url.href;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates whether a given URL is a valid Figma link (figma.com).
 */
export function isFigmaUrl(value: string | null | undefined): boolean {
  const normalized = normalizeExternalUrl(value);
  if (!normalized) return false;
  try {
    const url = new URL(normalized);
    return url.hostname === 'figma.com' || url.hostname.endsWith('.figma.com');
  } catch {
    return false;
  }
}

/**
 * Safely opens an external URL in a new browser window/tab with noopener and noreferrer.
 * Ensures the URL is properly normalized before opening.
 */
export function openSafeExternalUrl(url: string | null | undefined, target = '_blank'): boolean {
  const normalized = normalizeExternalUrl(url);
  if (!normalized || typeof window === 'undefined') return false;

  try {
    const win = window.open(normalized, target, 'noopener,noreferrer');
    if (win) {
      win.focus();
      return true;
    }
  } catch (err) {
    console.error('Failed to open external URL:', err);
  }
  return false;
}
