import { buildFigmaEmbedUrl, getProjectFigmaPath } from './figma';

describe('figma helpers', () => {
  it('builds the persistent in-app Figma route for a project', () => {
    expect(getProjectFigmaPath(42)).toBe('/project/42/figma');
  });

  it('builds an embed URL without changing the original Figma URL', () => {
    const originalUrl = 'https://www.figma.com/file/abc123/My-Design?node-id=1%3A2';

    const embedUrl = buildFigmaEmbedUrl(originalUrl);

    expect(embedUrl).toBe(
      `https://www.figma.com/embed?embed_host=planora&url=${encodeURIComponent(originalUrl)}`,
    );
  });

  it('returns null when a saved URL cannot be embedded as a Figma document', () => {
    expect(buildFigmaEmbedUrl('https://example.com/design')).toBeNull();
    expect(buildFigmaEmbedUrl('not-a-url')).toBeNull();
  });
});
