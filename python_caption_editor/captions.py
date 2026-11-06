"""SRT import, reference alignment and Caption Studio export (no model calls)."""
import difflib
import json
import math
import re
import unicodedata

STAMP = re.compile(r'^(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})$')


def seconds(value):
    m = STAMP.fullmatch(value.strip())
    if not m or int(m[2]) >= 60 or int(m[3]) >= 60:
        raise ValueError(f'زمان SRT نامعتبر است: {value}')
    return int(m[1]) * 3600 + int(m[2]) * 60 + int(m[3]) + int(m[4]) / 1000


def parse_srt(text, word_mode=False):
    text = text.lstrip('\ufeff').replace('\r\n', '\n').replace('\r', '\n').strip()
    if not text:
        raise ValueError('فایل SRT خالی است.')
    result = []
    for i, block in enumerate(re.split(r'\n\s*\n', text), 1):
        lines = block.strip().split('\n')
        t = 0 if '-->' in lines[0] else 1
        if len(lines) <= t + 1 or '-->' not in lines[t]:
            raise ValueError(f'بلوک {i} ساختار SRT معتبر ندارد.')
        pair = lines[t].split('-->')
        if len(pair) != 2:
            raise ValueError(f'زمان بلوک {i} نامعتبر است.')
        s, e = seconds(pair[0]), seconds(pair[1])
        value = ' '.join(re.sub(r'<[^>]*>', '', x).strip() for x in lines[t+1:]).strip()
        if not value or e <= s:
            raise ValueError(f'متن یا زمان بلوک {i} نامعتبر است.')
        if word_mode and len(value.split()) != 1:
            raise ValueError(f'بلوک {i} فایل کلمه‌ای باید دقیقاً یک کلمه داشته باشد؛ زمان کلمات را حدس نمی‌زنیم.')
        if result and s < result[-1]['s']:
            raise ValueError(f'ترتیب زمانی بلوک {i} نامعتبر است.')
        result.append({'s': s, 'e': e, 'text': value})
    return result


def normalized(value):
    value = unicodedata.normalize('NFKC', value).translate(str.maketrans('يىك', 'ییک'))
    return ''.join(c for c in value if not unicodedata.category(c).startswith(('P', 'M')) and c not in '\u200c\u200d').lower()


def import_subtitles(word_srt, sentence_srt=''):
    raw = parse_srt(word_srt, True)
    words = [{'id': i, 'text': v['text'], 'start': v['s'], 'end': v['e'], 'status': 'normal', 'suggestion': ''} for i, v in enumerate(raw)]
    references = parse_srt(sentence_srt) if sentence_srt.strip() else []
    if not references:
        return {'words': words, 'cues': [list(range(i, min(i+7, len(words)))) for i in range(0, len(words), 7)], 'warnings': ['فایل جمله‌ای وارد نشده؛ جمله‌بندی اولیه هر ۷ کلمه است و باید بررسی شود.']}
    ref_tokens, ref_blocks = [], []
    for index, ref in enumerate(references):
        for token in ref['text'].split():
            ref_tokens.append(token)
            ref_blocks.append(index)
    matcher = difflib.SequenceMatcher(None, [normalized(w['text']) for w in words], [normalized(t) for t in ref_tokens], autojunk=False)
    labels = [None] * len(words)
    warnings = []
    for tag, a, b, c, d in matcher.get_opcodes():
        if tag == 'equal':
            for offset in range(b-a):
                j = c + offset
                labels[a+offset] = ref_blocks[j]
                words[a+offset]['suggestion'] = ref_tokens[j]
        elif tag == 'replace':
            # Only pair replacements when lengths match. Never fabricate word timestamps.
            if b-a == d-c:
                for offset in range(b-a):
                    j = c+offset
                    labels[a+offset] = ref_blocks[j]
                    words[a+offset]['status'] = 'different'
                    words[a+offset]['suggestion'] = ref_tokens[j]
                warnings.append(f'اختلاف متن: {b-a} کلمه با متن جمله‌ای تفاوت دارد؛ پیشنهادها را بررسی کنید.')
            else:
                for k in range(a,b): words[k]['status'] = 'extra'
                warnings.append(f'اختلاف تعداد: {b-a} کلمه در فایل کلمه‌ای و {d-c} کلمه در متن جمله‌ای؛ تطبیق دستی لازم است.')
        elif tag == 'delete':
            for k in range(a,b): words[k]['status'] = 'extra'
            warnings.append(f'{b-a} کلمه در فایل کلمه‌ای هست که در متن جمله‌ای پیدا نشد.')
        else:
            warnings.append('کلمات فاقد زمان در فایل کلمه‌ای: ' + ' '.join(ref_tokens[c:d]) + ' — زمان آن‌ها را باید دستی اضافه کنید.')
    cues = []
    previous = object()
    for i, label in enumerate(labels):
        # Unmatched runs stay separate; they are not silently added to a neighbouring sentence.
        key = ('unmatched',) if label is None else ('ref', label)
        if key != previous:
            cues.append([])
        cues[-1].append(i)
        previous = key
    warnings.append('هم‌ترازی بر اساس متن انجام شده و مرزهای فایل جمله‌ای پیشنهادی‌اند؛ با صدا بررسی کنید.')
    return {'words': words, 'cues': cues, 'warnings': warnings}


def validate(words, cues, duration=None):
    errors, warnings = [], []
    if not words or not cues: return ['هیچ زیرنویسی وجود ندارد.'], []
    ids = set()
    for i, w in enumerate(words):
        if not isinstance(w, dict) or w.get('id') != i:
            errors.append('شناسه یا ترتیب کلمات نامعتبر است.'); continue
        text = w.get('text', '')
        if not isinstance(text, str) or len(text.split()) != 1:
            errors.append(f'کلمه {i+1}: متن باید دقیقاً یک کلمه غیرخالی باشد.')
        s, e = w.get('start'), w.get('end')
        if isinstance(s, bool) or isinstance(e, bool) or not isinstance(s, (int,float)) or not isinstance(e, (int,float)) or not math.isfinite(s) or not math.isfinite(e) or s < 0 or e <= s or round(s, 3) >= round(e, 3):
            errors.append(f'کلمه {i+1}: زمان شروع و پایان نامعتبر است.'); continue
        if duration and e > duration + 0.001: errors.append(f'کلمه {i+1} از طول رسانه بیرون است.')
        if i and isinstance(words[i-1].get('start'), (int, float)) and s < words[i-1]['start']: errors.append(f'ترتیب زمانی کلمه {i+1} نامعتبر است.')
        if i and isinstance(words[i-1].get('end'), (int, float)) and s < words[i-1]['end']: warnings.append(f'کلمه {i+1} با کلمه قبل هم‌پوشانی دارد.')
    flattened = []
    for cue in cues:
        if not isinstance(cue, list) or not cue or any(not isinstance(n, int) or isinstance(n, bool) or n < 0 or n >= len(words) for n in cue):
            errors.append('یکی از جمله‌ها خالی است یا شناسه نامعتبر دارد.'); continue
        flattened.extend(cue)
    if flattened != list(range(len(words))): errors.append('کلمات باید به ترتیب و هر کدام دقیقاً یک بار در جمله‌ها باشند.')
    return errors, warnings


def export_data(words, cues, duration=None):
    errors, warnings = validate(words, cues, duration)
    if errors: raise ValueError('\n'.join(errors))
    out = []
    for cue in cues:
        items = [{'w': words[i]['text'].strip(), 's': round(words[i]['start'], 3), 'e': round(words[i]['end'], 3)} for i in cue]
        out.append({'s': items[0]['s'], 'e': max(x['e'] for x in items), 'words': items, 'lines': [list(range(len(items)))]})
    return out, warnings


def stamp(t):
    ms = round(t * 1000)
    h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


def make_srt(data, word_mode=False):
    cues = ([{'s': w['s'], 'e': w['e'], 'words': [w]} for c in data for w in c['words']] if word_mode else data)
    return '\n\n'.join(f"{i}\n{stamp(c['s'])} --> {stamp(c['e'])}\n" + ' '.join(w['w'] for w in c['words']) for i, c in enumerate(cues, 1)) + '\n'
