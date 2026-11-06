"""Local browser-based caption editor. No cloud calls and no third-party packages."""
import argparse
import json
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import captions

ROOT = Path(__file__).resolve().parent

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'static'), **kwargs)

    def do_POST(self):
        if self.path not in ('/api/import', '/api/export'):
            self.send_error(404); return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 10_000_000: raise ValueError('اندازه درخواست نامعتبر است.')
            payload = json.loads(self.rfile.read(size).decode('utf-8'))
            if self.path == '/api/import':
                result = captions.import_subtitles(payload['wordSrt'], payload.get('sentenceSrt', ''))
            else:
                data, warnings = captions.export_data(payload['words'], payload['cues'], payload.get('duration'))
                result = {'json': data, 'sentenceSrt': captions.make_srt(data), 'wordSrt': captions.make_srt(data, True), 'warnings': warnings}
            self.respond(200, result)
        except (ValueError, KeyError, TypeError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            self.respond(400, {'error': str(exc) or 'داده ورودی معتبر نیست.'})

    def respond(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode('utf-8')
        self.send_response(status); self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

def main():
    parser = argparse.ArgumentParser(description='Local offline caption editor')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--open-browser', action='store_true', help='Open the editor in the default browser')
    args = parser.parse_args()
    try:
        server = ThreadingHTTPServer((args.host, args.port), Handler)
    except OSError as exc:
        print(f'Cannot start editor on port {args.port}: {exc}', flush=True)
        if getattr(sys, 'frozen', False):
            input('Press Enter to exit...')
        return 1
    browser_host = '127.0.0.1' if args.host in ('0.0.0.0', '::') else args.host
    url = f'http://{browser_host}:{server.server_port}'
    print(f'Caption editor: {url}\nKeep this window open while editing. Press Ctrl+C to stop.', flush=True)
    if args.open_browser or getattr(sys, 'frozen', False):
        if not webbrowser.open(url):
            print('Could not open a browser automatically. Open the address above manually.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0

if __name__ == '__main__':
    sys.exit(main())
