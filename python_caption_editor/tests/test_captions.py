import json
import sys
import unittest
from pathlib import Path
from threading import Thread
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import captions
from app import Handler

WORDS = '''1
00:00:00,200 --> 00:00:00,450
سلام

2
00:00:00,500 --> 00:00:00,900
دوستان

3
00:00:01,100 --> 00:00:01,500
امروز

4
00:00:01,600 --> 00:00:02,000
اینجا
'''
SENTENCES = '''1
00:00:00,200 --> 00:00:00,900
سلام دوستان

2
00:00:01,100 --> 00:00:02,000
امروز اینجا
'''
class Tests(unittest.TestCase):
    def test_import_and_export(self):
        project = captions.import_subtitles(WORDS, SENTENCES)
        self.assertEqual(project['cues'], [[0, 1], [2, 3]])
        result, warnings = captions.export_data(project['words'], project['cues'], 3)
        self.assertEqual(result[0], {'s': .2, 'e': .9, 'words': [{'w': 'سلام', 's': .2, 'e': .45}, {'w': 'دوستان', 's': .5, 'e': .9}], 'lines': [[0, 1]]})
        self.assertEqual(captions.parse_srt(captions.make_srt(result, True), True)[2]['text'], 'امروز')
        self.assertEqual(len(captions.parse_srt(captions.make_srt(result))), 2)
        self.assertFalse(warnings)

    def test_unmatched_words_are_separate(self):
        project = captions.import_subtitles(WORDS, SENTENCES.replace('امروز اینجا', 'امروز'))
        self.assertEqual(project['cues'][-1], [3])
        self.assertEqual(project['words'][3]['status'], 'extra')

    def test_missing_reference_words_are_reported(self):
        project = captions.import_subtitles(WORDS, SENTENCES.replace('سلام دوستان', 'سلام عزیز دوستان'))
        self.assertTrue(any('عزیز' in s for s in project['warnings']))
        self.assertEqual(len(project['words']), 4)

    def test_reject_malformed_word_srt(self):
        for text in [WORDS.replace('سلام', 'سلام شما', 1), WORDS.replace('00:00:00,450', 'bad', 1), WORDS.replace('00:00:00,450', '00:00:00,200', 1)]:
            with self.assertRaises(ValueError): captions.import_subtitles(text)

    def test_invalid_exports(self):
        p = captions.import_subtitles(WORDS)
        for cues in [[[0,1],[1,2,3]], [[0,2,1,3]], [[0,1,2,999]]]:
            with self.assertRaises(ValueError): captions.export_data(p['words'], cues, 3)
        p['words'][0]['end'] = 4
        with self.assertRaises(ValueError): captions.export_data(p['words'], p['cues'], 3)
        p['words'][0]['end'] = .2001
        with self.assertRaises(ValueError): captions.export_data(p['words'], p['cues'], 3)

    def test_http_import_export(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = Thread(target=server.serve_forever, daemon=True); thread.start()
        def post(path, data):
            req = Request(f'http://127.0.0.1:{server.server_port}{path}', data=json.dumps(data).encode(), headers={'Content-Type':'application/json'})
            with urlopen(req) as res: return json.load(res)
        try:
            project = post('/api/import', {'wordSrt': WORDS, 'sentenceSrt': SENTENCES})
            output = post('/api/export', {'words':project['words'], 'cues':project['cues'], 'duration':3})
            self.assertEqual(output['json'][0]['words'][0]['w'], 'سلام')
            with self.assertRaises(HTTPError): post('/api/import', {'wordSrt': 'bad'})
        finally:
            server.shutdown(); server.server_close(); thread.join()

if __name__ == '__main__': unittest.main()
