#!/usr/bin/env python3
"""Legal Loopholes Daily - local Kokoro TTS server for GitHub Actions.
Same model and library as the Mac's kokoro-local container (hexgrad/Kokoro-82M through kokoro.KPipeline),
same endpoint make_voice.py calls:  POST http://localhost:8300/api/tts  {"text", "voice", "speed"}  -> WAV (24 kHz)
"""
import io, json, os, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import numpy as np, soundfile as sf
from kokoro import KPipeline

PORT = int(os.environ.get('PORT', 8300))
_pipes, _lock = {}, threading.Lock()


def pipe(lang):
    with _lock:
        if lang not in _pipes:
            _pipes[lang] = KPipeline(lang_code=lang, repo_id='hexgrad/Kokoro-82M', device='cpu')
        return _pipes[lang]


def synth(text, voice, speed):
    p = pipe(voice[0] if voice else 'a')
    with _lock:
        parts = [r.audio.cpu().numpy() for r in p(text, voice=voice, speed=speed) if r.audio is not None]
    if not parts: raise ValueError('No audio generated')
    buf = io.BytesIO(); sf.write(buf, np.concatenate(parts), 24000, format='WAV')
    return buf.getvalue()


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _send(self, code, body, ctype):
        self.send_response(code); self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        if self.path == '/health': return self._send(200, b'{"status":"healthy"}', 'application/json')
        self._send(404, b'{}', 'application/json')

    def do_POST(self):
        if self.path != '/api/tts': return self._send(404, b'{}', 'application/json')
        try:
            req = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
            wav = synth(req['text'], req.get('voice', 'af_heart'), float(req.get('speed', 1.0)))
            self._send(200, wav, 'audio/wav')
        except Exception as e:
            self._send(500, json.dumps({'detail': str(e)}).encode(), 'application/json')


if __name__ == '__main__':
    synth('Hello.', 'am_puck', 1.0)          # load the model and voice before make_voice.py starts calling
    print(f'kokoro tts ready on {PORT}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
