#!/usr/bin/env python3
"""Legal Loopholes Daily - one-word captions timed to the actual audio.
Usage: make_captions.py <voiceover.wav> <output.srt>
The words shown are the script's own (<ID>-spoken.txt from make_voice.py), timed by the recognizer, so a misheard
word can never reach the screen. Without that file the recognizer's words are used.
"""
import sys, os, re, json, shutil, subprocess, tempfile
import numpy as np, soundfile as sf, sherpa_onnx

MODEL = os.path.expanduser('~/.n8n-files/aligner-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8/')
FFMPEG = next((p for p in ['/opt/homebrew/bin/ffmpeg', shutil.which('ffmpeg')] if p and os.path.exists(p)), 'ffmpeg')

MIN_GAP = 0.10
TARGET_MIN = 0.15
SNAP = 0.30
LEAD = 0.03
HOLD_SIL = 0.30
HOLD = 0.15
LAST_HOLD = 0.60

src, out_srt = sys.argv[1], sys.argv[2]

tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
subprocess.run([FFMPEG, '-loglevel', 'error', '-y', '-i', src, '-ar', '16000', '-ac', '1', tmp], check=True)
audio, sr = sf.read(tmp, dtype='float32')

log = subprocess.run([FFMPEG, '-hide_banner', '-i', tmp, '-af', 'silencedetect=n=-40dB:d=0.12', '-f', 'null', '-'],
                     capture_output=True, text=True).stderr
os.unlink(tmp)
sil, cur = [], None
for k, v in re.findall(r'silence_(start|end): ([0-9.]+)', log):
    if k == 'start': cur = float(v)
    elif cur is not None: sil.append((cur, float(v))); cur = None

rec = sherpa_onnx.OfflineRecognizer.from_transducer(
    encoder=MODEL + 'encoder.int8.onnx', decoder=MODEL + 'decoder.int8.onnx',
    joiner=MODEL + 'joiner.int8.onnx', tokens=MODEL + 'tokens.txt',
    model_type='nemo_transducer', num_threads=4)
fr = int(0.02 * sr)
energy = np.array([np.sqrt(np.mean(audio[i:i + fr] ** 2)) for i in range(0, len(audio) - fr, fr)])
cuts = [0]
while cuts[-1] + 1000 < len(energy):
    lo, hi = cuts[-1] + 850, min(cuts[-1] + 1150, len(energy))
    cuts.append(lo + int(np.argmin(energy[lo:hi])))
cuts.append(len(energy))

words = []
for c0, c1 in zip(cuts, cuts[1:]):
    s = rec.create_stream()
    s.accept_waveform(sr, audio[c0 * fr:c1 * fr])
    rec.decode_stream(s)
    for tok, ts in zip(s.result.tokens, s.result.timestamps):
        t = ts + c0 * 0.02
        if tok.startswith((' ', '\u2581')) or not words:
            words.append([tok.strip(' \u2581'), t])
        else:
            words[-1][0] += tok
words = [w for w in words if w[0]]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import textcheck as TC
spoken_path = re.sub(r'-(voiceover|body)\.wav$', '-spoken.txt', src)
aligned = None
if spoken_path != src and os.path.exists(spoken_path):
    toks = TC.tokens(open(spoken_path).read())
    starts, aligned = TC.align(toks, words, len(audio) / sr)
    heard_text = ' '.join(w for w, _ in words)
    words = [[d, t] for (d, _), t in zip(toks, starts)]

st = [t for _, t in words]
for k, t in enumerate(st):
    for a, b in sil:
        if abs(b - t) <= SNAP and b - LEAD > (st[k - 1] if k else -1):
            st[k] = b - LEAD
for k in range(1, len(st)):
    st[k] = max(st[k], st[k - 1] + MIN_GAP)
for k in range(len(st) - 2):
    need = TARGET_MIN - (st[k + 1] - st[k])
    if need > 0 and (st[k + 2] - st[k + 1]) - need >= 0.2:
        st[k + 1] += need

caps = []
for k, t in enumerate(st):
    nxt = st[k + 1] if k + 1 < len(st) else None
    end = nxt if nxt is not None else t + LAST_HOLD
    for a, b in sil:
        if b - a >= HOLD_SIL and a > t + 0.1 and (nxt is None or a < nxt):
            end = min(end, a + HOLD)
            break
    caps.append((t, end, words[k][0]))

def f(x):
    ms = int(round(x * 1000))
    return '%02d:%02d:%02d,%03d' % (ms // 3600000, ms // 60000 % 60, ms // 1000 % 60, ms % 1000)

with open(out_srt, 'w') as fh:
    fh.write('\n\n'.join(f'{i + 1}\n{f(a)} --> {f(b)}\n{w}' for i, (a, b, w) in enumerate(caps)) + '\n')

overlaps = sum(caps[i][0] < caps[i - 1][1] - 1e-6 for i in range(1, len(caps)))
print(json.dumps({'srt': out_srt, 'words': len(caps), 'overlaps': overlaps, 'script_words': aligned is not None,
                  'timed_by_voice': None if aligned is None else round(aligned, 3),
                  'text': ' '.join(w for _, _, w in caps)}))
