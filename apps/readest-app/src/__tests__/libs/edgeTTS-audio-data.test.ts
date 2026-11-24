import { describe, expect, test } from 'vitest';
import { type EdgeTTSPayload, hashTTSPayload } from '@/libs/edgeTTS';

const makePayload = (text: string): EdgeTTSPayload => ({
  lang: 'en',
  text,
  voice: 'en-US-AriaNeural',
  rate: 1.0,
  pitch: 1.0,
});

describe('hashTTSPayload', () => {
  test('is stable for equal payload content', () => {
    expect(hashTTSPayload(makePayload('abc'))).toBe(hashTTSPayload(makePayload('abc')));
  });

  test('differs when payload fields differ', () => {
    expect(hashTTSPayload(makePayload('abc'))).not.toBe(hashTTSPayload(makePayload('abd')));
    expect(hashTTSPayload({ ...makePayload('abc'), pitch: 1.2 })).not.toBe(
      hashTTSPayload(makePayload('abc')),
    );
  });
});
