export function getProjectFigmaPath(projectId: string | number): string {
  return `/project/${encodeURIComponent(String(projectId))}/figma`;
}

export function buildFigmaEmbedUrl(figmaUrl: string | null | undefined): string | null {
  if (!figmaUrl) return null;

  try {
    const url = new URL(figmaUrl);
    const host = url.hostname.toLowerCase();
    const isFigmaHost = host === 'figma.com' || host.endsWith('.figma.com');

    if (!isFigmaHost || !['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    return `https://www.figma.com/embed?embed_host=planora&url=${encodeURIComponent(url.href)}`;
  } catch {
    return null;
  }
}
