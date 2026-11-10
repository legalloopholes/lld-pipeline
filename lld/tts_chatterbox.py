#!/usr/bin/env python3
"""Legal Loopholes Daily - Chatterbox TTS server (Larry's voice since Nov 2026; audition pick #6 "excited").
The only voice server; the endpoint make_voice.py calls:
  POST http://localhost:8300/api/tts  {"text", "speed", "take"}  -> WAV (24 kHz mono); take = another read of the same line
Chatterbox has no speed control, so each sentence is generated once at natural pace (cached) and the requested
speed is applied with ffmpeg atempo (pitch unchanged). Re-runs at a new speed cost no extra generation.
Runs in its own venv: chatterbox-tts==0.1.7 (unmaintained since Aug 2026 - keep this exact version).
"""
import io, json, os, subprocess, threading, zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import numpy as np, torch
from chatterbox.tts import ChatterboxTTS

PORT = int(os.environ.get('PORT', 8300))
EXAGGERATION, CFG = 0.75, 0.35          # audition #6 "excited", picked by the owner by ear (2026-11-09)
torch.set_num_threads(os.cpu_count() or 4)
MODEL = ChatterboxTTS.from_pretrained(device='cpu')
SR = MODEL.sr
_lock, _cache = threading.Lock(), {}


def raw(text, take=0):
    with _lock:
        if (text, take) not in _cache:
            torch.manual_seed(zlib.crc32(text.encode()) + take * 1000003)   # same sentence + take -> same read, run to run
            wav = MODEL.generate(text, exaggeration=EXAGGERATION, cfg_weight=CFG)
            _cache[(text, take)] = (wav.squeeze(0).cpu().numpy() * 32767).clip(-32768, 32767).astype(np.int16)
        return _cache[(text, take)]


def synth(text, speed, take=0):
    pcm = raw(text, take).tobytes()
    af = f'atempo={min(2.0, max(0.5, speed)):.4f}' if abs(speed - 1) > 1e-3 else 'anull'
    return subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', 'pipe:0',
                           '-af', af, '-f', 'wav', 'pipe:1'], input=pcm, capture_output=True, check=True).stdout


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
            self._send(200, synth(req['text'], float(req.get('speed', 1.0)), int(req.get('take', 0))), 'audio/wav')
        except Exception as e:
            self._send(500, json.dumps({'detail': str(e)}).encode(), 'application/json')


if __name__ == '__main__':
    raw('Hello.')                                   # warm up before make_voice.py starts calling
    print(f'chatterbox tts ready on {PORT}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
