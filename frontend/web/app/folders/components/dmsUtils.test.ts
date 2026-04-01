import { formatBytes, toDateLabel } from './dmsUtils';

describe('dmsUtils', () => {
  it('formats bytes for zero and megabytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });

  it('returns a readable date label', () => {
    const label = toDateLabel('2026-01-10T12:30:00.000Z');
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });
});
