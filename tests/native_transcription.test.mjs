import test from 'node:test';
import assert from 'node:assert/strict';

import { 
  parseOffsetToSeconds, 
  parseNativeWordAnnotations 
} from '../src/utils/nativeTranscriptionParser.ts';
import { 
  alignWordsWithSrtReference, 
  parseSrt 
} from '../src/utils/persianNormalizer.ts';
import { runQualityControl } from '../src/utils/qcValidator.ts';
import { generateCaptionStudioJson } from '../src/utils/exportFormats.ts';

test('parseOffsetToSeconds converts duration strings properly to numeric seconds', () => {
  assert.equal(parseOffsetToSeconds('0.450s'), 0.45);
  assert.equal(parseOffsetToSeconds('1.200s'), 1.2);
  assert.equal(parseOffsetToSeconds('15.6789s'), 15.679);
  assert.equal(parseOffsetToSeconds('0s'), 0);
  assert.equal(parseOffsetToSeconds('2.5'), 2.5);
  // Invalid values should return null
  assert.equal(parseOffsetToSeconds(null), null);
  assert.equal(parseOffsetToSeconds(undefined), null);
  assert.equal(parseOffsetToSeconds(''), null);
  assert.equal(parseOffsetToSeconds('invalid'), null);
  assert.equal(parseOffsetToSeconds('-1.5s'), null);
});

test('parseNativeWordAnnotations extracts native word annotations from candidates/parts', () => {
  const mockResponse = {
    candidates: [
      {
        content: {
          parts: [
            {
              audioTranscription: {
                text: 'سلام دوستان',
                words: [
                  { word: 'سلام', startOffset: '0.250s', endOffset: '0.650s' },
                  { word: 'دوستان', startOffset: '0.700s', endOffset: '1.150s' },
                ],
              },
            },
          ],
        },
      },
    ],
  };

  const result = parseNativeWordAnnotations(mockResponse);
  assert.equal(result.success, true);
  assert.equal(result.words.length, 2);
  assert.equal(result.validCount, 2);
  assert.equal(result.invalidCount, 0);

  assert.equal(result.words[0].w, 'سلام');
  assert.equal(result.words[0].s, 0.25);
  assert.equal(result.words[0].e, 0.65);
  assert.equal(result.words[0].isValid, true);
  assert.equal(result.words[0].validationStatus, 'valid');

  assert.equal(result.words[1].w, 'دوستان');
  assert.equal(result.words[1].s, 0.7);
  assert.equal(result.words[1].e, 1.15);
  assert.equal(result.words[1].isValid, true);
});

test('parseNativeWordAnnotations rejects missing or invalid timestamps without fake defaults', () => {
  const mockResponseWithBadTimes = {
    candidates: [
      {
        content: {
          parts: [
            {
              audioTranscription: {
                words: [
                  { word: 'کلمه۱' }, // missing startOffset & endOffset
                  { word: 'کلمه۲', startOffset: '1.500s', endOffset: '1.200s' }, // end < start
                ],
              },
            },
          ],
        },
      },
    ],
  };

  const result = parseNativeWordAnnotations(mockResponseWithBadTimes);
  assert.equal(result.success, false);
  assert.equal(result.validCount, 0);
  assert.equal(result.invalidCount, 2);
  // Verify it never set fake 0 or 0.3s defaults
  assert.notEqual(result.words[0].s, 0);
  assert.notEqual(result.words[0].e, 0.3);
  assert.equal(result.words[0].isValid, false);
  assert.equal(result.words[0].validationStatus, 'missing_start');
  assert.equal(result.words[1].isValid, false);
  assert.equal(result.words[1].validationStatus, 'end_before_start');
});

test('parseNativeWordAnnotations halts with error if no word annotations are present', () => {
  const emptyResponse = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: 'صرفاً متن ساده بدون ساختار کلمات',
            },
          ],
        },
      },
    ],
  };

  const result = parseNativeWordAnnotations(emptyResponse);
  assert.equal(result.success, false);
  assert.ok(result.error && result.error.includes('هیچ برچسب زمانی'));
});

test('alignWordsWithSrtReference uses SRT for sentence boundaries and assigns srtBlockIndex', () => {
  const transcribedWords = [
    { id: 0, w: 'سلام', s: 0.2, e: 0.6, isValid: true },
    { id: 1, w: 'دوستان', s: 0.65, e: 1.1, isValid: true },
    { id: 2, w: 'امروز', s: 1.5, e: 1.9, isValid: true },
    { id: 3, w: 'خوب', s: 2.0, e: 2.3, isValid: true },
    { id: 4, w: 'است', s: 2.35, e: 2.7, isValid: true },
  ];

  const srtItems = [
    { index: 1, startTime: 0.1, endTime: 1.2, text: 'سلام دوستان' },
    { index: 2, startTime: 1.4, endTime: 2.8, text: 'امروز خوب است' },
  ];

  const alignment = alignWordsWithSrtReference(transcribedWords, srtItems);
  assert.equal(alignment.proposedCues.length, 2);

  // Cue 1 should have words 0 and 1
  assert.deepEqual(alignment.proposedCues[0].wordIds, [0, 1]);
  assert.equal(alignment.proposedCues[0].s, 0.2);
  assert.equal(alignment.proposedCues[0].e, 1.1);

  // Cue 2 should have words 2, 3, 4
  assert.deepEqual(alignment.proposedCues[1].wordIds, [2, 3, 4]);
  assert.equal(alignment.proposedCues[1].s, 1.5);
  assert.equal(alignment.proposedCues[1].e, 2.7);

  // Transcribed words should have srtBlockIndex attached
  assert.equal(alignment.updatedWords[0].srtBlockIndex, 1);
  assert.equal(alignment.updatedWords[1].srtBlockIndex, 1);
  assert.equal(alignment.updatedWords[2].srtBlockIndex, 2);
  assert.equal(alignment.updatedWords[3].srtBlockIndex, 2);
  assert.equal(alignment.updatedWords[4].srtBlockIndex, 2);
});

test('runQualityControl detects duplicate word assignments and unassigned words', () => {
  const words = [
    { id: 0, w: 'الف', s: 0.1, e: 0.4 },
    { id: 1, w: 'ب', s: 0.5, e: 0.8 },
    { id: 2, w: 'ج', s: 0.9, e: 1.2 },
  ];

  // Case 1: duplicate word ID 1 in both cues
  const cuesWithDuplicate = [
    { id: 'cue-0', cueIndex: 0, s: 0.1, e: 0.8, wordIds: [0, 1], lines: [[0, 1]] },
    { id: 'cue-1', cueIndex: 1, s: 0.5, e: 1.2, wordIds: [1, 2], lines: [[0, 1]] },
  ];

  const issues1 = runQualityControl(words, cuesWithDuplicate);
  assert.ok(issues1.some(i => i.id === 'duplicate-words-in-cues'));

  // Case 2: word 2 dropped entirely
  const cuesWithMissing = [
    { id: 'cue-0', cueIndex: 0, s: 0.1, e: 0.8, wordIds: [0, 1], lines: [[0, 1]] },
  ];

  const issues2 = runQualityControl(words, cuesWithMissing);
  assert.ok(issues2.some(i => i.id === 'unassigned-words'));
});

test('generateCaptionStudioJson strictly conforms to After Effects Caption Studio schema', () => {
  const words = [
    { id: 0, w: 'کپشن', s: 0.5, e: 0.9 },
    { id: 1, w: 'استودیو', s: 1.0, e: 1.6 },
  ];
  const cues = [
    { id: 'cue-0', cueIndex: 0, s: 0.5, e: 1.6, wordIds: [0, 1], lines: [[0, 1]] },
  ];

  const output = generateCaptionStudioJson(words, cues, true);
  assert.equal(output.length, 1);
  assert.equal(typeof output[0].s, 'number');
  assert.equal(typeof output[0].e, 'number');
  assert.equal(Array.isArray(output[0].words), true);
  assert.equal(Array.isArray(output[0].lines), true);
  assert.deepEqual(output[0].lines, [[0, 1]]);

  assert.equal(output[0].words[0].w, 'کپشن');
  assert.equal(output[0].words[0].s, 0.5);
  assert.equal(output[0].words[0].e, 0.9);
  assert.equal(output[0].words[1].w, 'استودیو');
  assert.equal(output[0].words[1].s, 1.0);
  assert.equal(output[0].words[1].e, 1.6);
});
