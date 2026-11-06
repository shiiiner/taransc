import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizePersian, parseSrt, wordSimilarity } from '../src/utils/persianNormalizer.ts';
import { generateCaptionStudioJson } from '../src/utils/exportFormats.ts';
import { runQualityControl } from '../src/utils/qcValidator.ts';

test('normalizePersian handles Arabic characters and ZWNJ correctly', () => {
  const raw = 'كتاب‌هایِ عربي و فارسي';
  const normalized = normalizePersian(raw, true);
  assert.equal(normalized.includes('ك'), false, 'Arabic Kaf should be normalized to Persian Kaf');
  assert.equal(normalized.includes('ي'), false, 'Arabic Yeh should be normalized to Persian Yeh');
  assert.equal(normalized.includes('\u0640'), false, 'Tatweel should be removed');
});

test('parseSrt parses timestamps and subtitle texts properly', () => {
  const srtSample = `1
00:00:01,500 --> 00:00:04,200
سلام بر شما

2
00:00:04,500 --> 00:00:07,800
روز بخیر
`;
  const parsed = parseSrt(srtSample);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].startTime, 1.5);
  assert.equal(parsed[0].endTime, 4.2);
  assert.equal(parsed[0].text, 'سلام بر شما');
  assert.equal(parsed[1].startTime, 4.5);
  assert.equal(parsed[1].endTime, 7.8);
  assert.equal(parsed[1].text, 'روز بخیر');
});

test('generateCaptionStudioJson produces exact format required for After Effects', () => {
  const words = [
    { id: 0, w: 'نمونه', s: 0.2, e: 0.65 },
    { id: 1, w: 'متن', s: 0.7, e: 1.1 },
  ];
  const cues = [
    {
      id: 'cue-0',
      cueIndex: 0,
      s: 0.2,
      e: 1.1,
      wordIds: [0, 1],
      lines: [[0, 1]],
    },
  ];

  const result = generateCaptionStudioJson(words, cues, true);
  assert.equal(result.length, 1);
  assert.equal(result[0].s, 0.2);
  assert.equal(result[0].e, 1.1);
  assert.deepEqual(result[0].lines, [[0, 1]]);
  assert.equal(result[0].words.length, 2);
  assert.equal(result[0].words[0].w, 'نمونه');
  assert.equal(result[0].words[0].s, 0.2);
  assert.equal(result[0].words[0].e, 0.65);
  assert.equal(result[0].words[1].w, 'متن');
  assert.equal(result[0].words[1].s, 0.7);
  assert.equal(result[0].words[1].e, 1.1);
});

test('runQualityControl detects invalid start/end timestamps and dropped words', () => {
  const words = [
    { id: 0, w: 'کلمه۱', s: 1.0, e: 0.5 }, // invalid: e < s
    { id: 1, w: 'کلمه۲', s: 1.2, e: 1.8 },
    { id: 2, w: 'کلمه۳', s: 2.0, e: 2.5 },
  ];
  const cues = [
    {
      id: 'cue-0',
      cueIndex: 0,
      s: 1.0,
      e: 1.8,
      wordIds: [0, 1], // word 2 is dropped!
      lines: [[0, 1]],
    },
  ];

  const issues = runQualityControl(words, cues);
  const timingError = issues.find(i => i.id === 'invalid-end-0');
  const unassignedError = issues.find(i => i.id === 'unassigned-words');

  assert.ok(timingError, 'Should report error for end time < start time');
  assert.ok(unassignedError, 'Should report error for dropped word');
});
