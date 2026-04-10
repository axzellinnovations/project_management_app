import { isSameIdentity, mergeMessage } from './chat-utils';

describe('chat-utils identity matching', () => {
  it('treats two missing identities as equal', () => {
    expect(isSameIdentity(undefined, undefined)).toBe(true);
    expect(isSameIdentity(null, null)).toBe(true);
  });

  it('treats one missing and one populated identity as different', () => {
    expect(isSameIdentity('alice', undefined)).toBe(false);
    expect(isSameIdentity(undefined, 'alice')).toBe(false);
  });
});

describe('chat-utils mergeMessage', () => {
  it('replaces optimistic room message with server echo', () => {
    const optimistic = {
      sender: 'alice',
      content: 'hello room',
      roomId: 11,
      type: 'CHAT' as const,
      formatType: 'PLAIN' as const,
    };

    const incoming = {
      id: 1001,
      sender: 'alice',
      content: 'hello room',
      roomId: 11,
      type: 'CHAT' as const,
      formatType: 'PLAIN' as const,
    };

    const merged = mergeMessage([optimistic], incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(1001);
  });

  it('replaces optimistic team message with server echo', () => {
    const optimistic = {
      sender: 'alice',
      content: 'team update',
      type: 'CHAT' as const,
      formatType: 'PLAIN' as const,
    };

    const incoming = {
      id: 1002,
      sender: 'alice',
      content: 'team update',
      type: 'CHAT' as const,
      formatType: 'PLAIN' as const,
    };

    const merged = mergeMessage([optimistic], incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(1002);
  });
});
