import { normalizeExternalUrl, isFigmaUrl, openSafeExternalUrl } from './url-utils';

describe('url-utils', () => {
  describe('normalizeExternalUrl', () => {
    it('returns null for null, undefined, or empty string', () => {
      expect(normalizeExternalUrl(null)).toBeNull();
      expect(normalizeExternalUrl(undefined)).toBeNull();
      expect(normalizeExternalUrl('')).toBeNull();
      expect(normalizeExternalUrl('   ')).toBeNull();
    });

    it('adds https:// if protocol is missing', () => {
      expect(normalizeExternalUrl('figma.com/file/abc')).toBe('https://figma.com/file/abc');
      expect(normalizeExternalUrl('www.figma.com/design/123/test')).toBe('https://www.figma.com/design/123/test');
    });

    it('preserves existing http or https protocol', () => {
      expect(normalizeExternalUrl('https://figma.com/file/xyz')).toBe('https://figma.com/file/xyz');
      expect(normalizeExternalUrl('http://figma.com/file/xyz')).toBe('http://figma.com/file/xyz');
    });

    it('returns null for invalid URLs without dots in hostname', () => {
      expect(normalizeExternalUrl('invalid_url')).toBeNull();
    });
  });

  describe('isFigmaUrl', () => {
    it('returns true for valid Figma links', () => {
      expect(isFigmaUrl('https://www.figma.com/file/xyz/Design')).toBe(true);
      expect(isFigmaUrl('figma.com/design/123')).toBe(true);
      expect(isFigmaUrl('https://staging.figma.com/file/123')).toBe(true);
    });

    it('returns false for non-Figma links or invalid URLs', () => {
      expect(isFigmaUrl('https://github.com/my-repo')).toBe(false);
      expect(isFigmaUrl('https://google.com')).toBe(false);
      expect(isFigmaUrl('')).toBe(false);
      expect(isFigmaUrl(null)).toBe(false);
    });
  });

  describe('openSafeExternalUrl', () => {
    beforeEach(() => {
      jest.spyOn(window, 'open').mockImplementation(() => ({ focus: jest.fn() } as unknown as Window));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('normalizes and opens valid URL in new window with safe attributes', () => {
      const res = openSafeExternalUrl('figma.com/file/123');
      expect(res).toBe(true);
      expect(window.open).toHaveBeenCalledWith('https://figma.com/file/123', '_blank', 'noopener,noreferrer');
    });

    it('returns false and does not open for empty or invalid URL', () => {
      const res = openSafeExternalUrl('');
      expect(res).toBe(false);
      expect(window.open).not.toHaveBeenCalled();
    });
  });
});
