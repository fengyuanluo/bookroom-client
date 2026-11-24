import { describe, test, expect } from 'vitest';
import { EdgeSpeechTTS, generateSecMsGec, parseAudioMetadataBody } from '@/libs/edgeTTS';

describe('EdgeSpeechTTS.voices', () => {
  test('a multilingual or expressive voice is named without the suffix, which becomes its variant', () => {
    const byId = (id: string) => EdgeSpeechTTS.voices.find((v) => v.id === id)!;
    expect(byId('en-US-AndrewMultilingualNeural')).toEqual({
      id: 'en-US-AndrewMultilingualNeural',
      name: 'Andrew',
      lang: 'en-US',
      variant: 'multilingual',
      gender: 'male',
    });
    expect(byId('en-IN-NeerjaExpressiveNeural')).toMatchObject({
      name: 'Neerja',
      variant: 'expressive',
    });
    expect(byId('en-US-AndrewNeural')).toEqual({
      id: 'en-US-AndrewNeural',
      name: 'Andrew',
      lang: 'en-US',
      gender: 'male',
    });
  });

  test('every voice carries its gender', () => {
    const byId = (id: string) => EdgeSpeechTTS.voices.find((v) => v.id === id)!;
    expect(byId('en-US-AriaNeural').gender).toBe('female');
    expect(byId('zh-CN-YunxiNeural').gender).toBe('male');
    expect(EdgeSpeechTTS.voices.filter((v) => !v.gender).map((v) => v.id)).toEqual([]);
  });
});

describe('parseAudioMetadataBody', () => {
  test('extracts WordBoundary entries from an audio.metadata body', () => {
    const body = JSON.stringify({
      Metadata: [
        {
          Type: 'WordBoundary',
          Data: {
            Offset: 1000000,
            Duration: 4250000,
            text: { Text: 'Dr.', Length: 3, BoundaryType: 'WordBoundary' },
          },
        },
      ],
    });
    expect(parseAudioMetadataBody(body)).toEqual([
      { offset: 1000000, duration: 4250000, text: 'Dr.' },
    ]);
  });

  test('ignores non-WordBoundary metadata entries', () => {
    const body = JSON.stringify({
      Metadata: [
        { Type: 'SessionEnd', Data: { Offset: 99 } },
        {
          Type: 'WordBoundary',
          Data: { Offset: 5000000, Duration: 1000000, text: { Text: 'hello' } },
        },
      ],
    });
    expect(parseAudioMetadataBody(body)).toEqual([
      { offset: 5000000, duration: 1000000, text: 'hello' },
    ]);
  });

  test('returns an empty list for malformed or empty bodies', () => {
    expect(parseAudioMetadataBody('not json')).toEqual([]);
    expect(parseAudioMetadataBody('{}')).toEqual([]);
    expect(
      parseAudioMetadataBody(JSON.stringify({ Metadata: [{ Type: 'WordBoundary' }] })),
    ).toEqual([]);
  });
});

describe('generateSecMsGec', () => {
  test('matches a v2 token captured from Edge (rany2/edge-tts#492)', async () => {
    // 2026-10-13T10:40:00Z, start of a 5-minute window
    expect(await generateSecMsGec(1791888000 * 1000)).toBe(
      '492D7694A183A45E-56E821F95D4579C5B7C7E33DC7303FF379EC36D510213555BBBB9EB17EF15876',
    );
  });
});
