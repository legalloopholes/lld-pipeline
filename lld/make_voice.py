#!/usr/bin/env python3
"""Legal Loopholes Daily - body narration with [pause] markers.
Usage: make_voice.py <output.wav> <script_base64>
  [pause]       -> 0.25 s of silence
  [pause 1.2]   -> 1.2 s of silence
  text [cut] more text -> voices both (for natural intonation), keeps only the part before [cut]
"""
import sys, re, json, base64, subprocess, shutil, os, urllib.request
import numpy as np, soundfile as sf

TTS_URL = 'http://localhost:8300/api/tts'
VOICE = 'larry'          # Chatterbox (lld/tts_chatterbox.py) is the only voice; it ignores this name
SPEED = 0.95
try:   # faster, punchier read (brand.json: voice_speed, min_seconds)
    _brand = json.load(open(os.path.join(os.path.expanduser('~/.n8n-files'), 'assets', 'brand.json')))
except Exception:
    _brand = {}
SPEED = float(_brand.get('voice_speed', 1.08))
MIN_SECONDS = float(_brand.get('min_seconds', 60))
POP = bool(_brand.get('voice_pop', True))     # pitch 'pop' on exclamations; off for Chatterbox (already expressive)
DEFAULT_PAUSE = 0.25
SR = 24000
FFMPEG = next((p for p in ['/opt/homebrew/bin/ffmpeg', shutil.which('ffmpeg')] if p and os.path.exists(p)), 'ffmpeg')

out_wav = sys.argv[1]
text = base64.b64decode(sys.argv[2]).decode('utf-8') if len(sys.argv) > 2 and sys.argv[2] else ''
# The scene plan (scenes/<ID>.json) can carry the script. A full script typed in the sheet always wins;
# an empty/placeholder SCRIPT cell falls back to the plan's script so batches don't depend on long sheet cells.
if len(text.strip()) < 200 and '[loop]' not in text:
    _vid = os.path.basename(out_wav).replace('-body.wav', '').replace('-voiceover.wav', '')
    _plan = os.path.join(os.path.expanduser('~/.n8n-files'), 'scenes', f'{_vid}.json')
    try:
        _s = json.load(open(_plan)).get('script', '')
        if _s: text = _s
    except Exception:
        pass

# ---- Episode structure (automatic) ----
# hook (first sentence, or everything before [disclaimer]) -> short spoken disclaimer -> body
# -> call to action -> loop line that leads back into the hook (voiced together with the hook's first words, then cut)
DISCLAIMER_LINE = 'Quick disclaimer: this is not legal advice.'
CTA = 'Make sure to like and follow Legal Loopholes Daily for more loopholes like this.'
# Larry says the episode's share line instead ("Send this to the friend who..."); like/follow goes on a sign on screen
try:
    _vid2 = os.path.basename(out_wav).replace('-body.wav', '').replace('-voiceover.wav', '')
    _share = (json.load(open(os.path.join(os.path.expanduser('~/.n8n-files'), 'scenes', f'{_vid2}.json'))).get('share_line') or '').strip()
    if _share: CTA = _share.rstrip('.!?') + '.'
except Exception:
    pass
DEFAULT_LOOP = 'But before you try anything, just remember'
loop = DEFAULT_LOOP
m = re.search(r'\[loop\](.*)$', text, flags=re.S | re.I)
if m:
    loop = ' '.join(m.group(1).split()).rstrip('.!?,;: ') or DEFAULT_LOOP
    text = text[:m.start()]
k = text.lower().find('make sure to like and follow')          # drop any old hand-typed ending
if k != -1:
    text = text[:k]
text = re.sub(r'\s*\[cut\].*$', '', text, flags=re.S).strip()
if re.search(r'\[disclaimer\]', text, flags=re.I):
    hook, body = re.split(r'\[disclaimer\]', text, maxsplit=1, flags=re.I)
else:
    m2 = re.search(r'[.?!](\s|$)', text)
    hook, body = (text[:m2.end()], text[m2.end():]) if m2 else (text, '')
hook, body = hook.strip(), body.strip()
hook_start = ' '.join(re.sub(r'\[pause[^\]]*\]', '', hook).split()[:4])
if _brand.get('spoken_disclaimer', False):      # off: the on-screen "Educational content - Not legal advice" line covers it
    text = f'{hook} [pause 0.15] {DISCLAIMER_LINE} [pause 0.15] {body} {CTA} {loop} [cut] {hook_start}'
else:
    text = f'{hook} {body} {CTA} {loop} [cut] {hook_start}'

parts = re.split(r'\[pause(?:\s+([0-9]*\.?[0-9]+))?\]', text, flags=re.I)
# parts = [text, secs, text, secs, text, ...]
pieces = []
for i in range(0, len(parts), 2):
    chunk = ' '.join(parts[i].split())
    pause = float(parts[i + 1]) if i + 1 < len(parts) and parts[i + 1] else DEFAULT_PAUSE
    has_pause = i + 1 < len(parts)
    pieces.append((chunk, pause if has_pause else 0.0))

def tts(chunk, speed=None, take=0):
    body = json.dumps({'text': chunk, 'voice': VOICE, 'speed': speed or SPEED, 'take': take}).encode('utf-8')
    req = urllib.request.Request(TTS_URL, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = r.read()
    pcm = subprocess.run([FFMPEG, '-loglevel', 'error', '-i', 'pipe:0', '-f', 's16le', '-ar', str(SR), '-ac', '1', 'pipe:1'],
                         input=data, capture_output=True, check=True).stdout
    a = np.frombuffer(pcm, dtype=np.int16)
    loud = np.where(np.abs(a) > 300)[0]
    if len(loud) == 0: return a
    pad = int(0.03 * SR)
    return a[max(0, loud[0] - pad):loud[-1] + pad]

MODEL = os.path.expanduser('~/.n8n-files/aligner-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8/')
_rec = None
def norm(w): return re.sub(r'[^a-z0-9]', '', w.lower())

def cut_before(a, keep_text, tail_text):
    """Voice keep+tail together, then cut the audio right before the tail's first word."""
    global _rec
    import sherpa_onnx
    if _rec is None:
        _rec = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=MODEL + 'encoder.int8.onnx', decoder=MODEL + 'decoder.int8.onnx',
            joiner=MODEL + 'joiner.int8.onnx', tokens=MODEL + 'tokens.txt',
            model_type='nemo_transducer', num_threads=4)
    x = a.astype(np.float32) / 32768.0
    x16 = np.interp(np.arange(0, len(x), SR / 16000), np.arange(len(x)), x).astype(np.float32)
    s = _rec.create_stream(); s.accept_waveform(16000, x16); _rec.decode_stream(s)
    words = []
    for tok, ts in zip(s.result.tokens, s.result.timestamps):
        if tok.startswith((' ', '\u2581')) or not words: words.append([tok.strip(' \u2581'), ts])
        else: words[-1][0] += tok
    words = [w for w in words if norm(w[0])]
    n = len([w for w in keep_text.split() if norm(w)])
    first = norm(tail_text.split()[0])
    idx = None
    for d in [0, 1, -1, 2, -2, 3, -3]:
        j = n + d
        if 0 <= j < len(words) and norm(words[j][0]) == first: idx = j; break
    if idx is None:
        raise SystemExit(f'CUT FAILED: could not find "{tail_text.split()[0]}" in: ' + ' '.join(w for w, _ in words))
    t = words[idx][1]
    fr = int(0.01 * SR)
    lo, hi = int(max(0, t - 0.20) * SR), int((t + 0.05) * SR)
    env = [np.abs(a[i:i + fr].astype(np.float32)).mean() for i in range(lo, max(lo + fr, hi - fr), fr)]
    cut = lo + int(np.argmin(env)) * fr + fr // 2
    out = a[:cut].astype(np.float32)
    f = min(int(0.025 * SR), len(out))
    out[len(out) - f:] *= np.linspace(1, 0, f)
    return out.astype(np.int16)

# ---- natural reading: clean the text, voice sentence by sentence with punctuation-aware gaps ----
KEEP_CAPS = {'US', 'USA', 'FBI', 'CIA', 'DNA', 'IRS', 'DMV', 'NASA', 'ID', 'TV', 'OK'}
ABBR = ['U.S.', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'vs.', 'St.', 'Jr.', 'Sr.', 'e.g.', 'i.e.', 'etc.']


def clean(t, terminal=True):
    t = re.sub(r'\b([A-Z]{2,})\b', lambda m: m.group(1) if m.group(1) in KEEP_CAPS else m.group(1).lower(), t)
    t = re.sub(r'\.\.\.+\s*$', '.', t.strip())                 # trailing "..." ends the sentence
    t = re.sub(r'\.\.\.+\s+(?=[A-Z])', '. ', t)                # "..." before a capital ends the sentence
    t = re.sub(r'\s*\.\.\.+\s*,?\s*', ', ', t)              # other "..." -> a natural comma pause
    t = re.sub(r'([?.!])\s*,\s*', r'\1 ', t)
    t = re.sub(r',\s*([?.!])', r'\1', t); t = re.sub(r'(,\s*){2,}', ', ', t)
    t = re.sub(r'\s+', ' ', t).strip(' ,')
    if terminal and t and not re.search(r'[.?!]["\u201d\u2019\')]*$', t): t += '.'
    return t


def sentences(t):
    for i, a in enumerate(ABBR): t = t.replace(a, f'\x00{i}\x00')
    parts = [p.strip() for p in re.findall(r'[^.?!]+(?:[.?!]+["\u201d\u2019\')]*|$)', t) if p.strip()]
    def back(p):
        for i, a in enumerate(ABBR): p = p.replace(f'\x00{i}\x00', a)
        return p
    return [back(p) for p in parts]


def gap_after(s):                                # a breath between sentences (owner: not rushed, not slow)
    if s.endswith('?'): return 0.32
    if s.endswith('!'): return 0.22
    return 0.18 if len(s.split()) <= 4 else 0.26


def speed_for(s, first):
    if first: return round(SPEED + 0.05, 2)                 # hook lands a touch quicker
    if s.rstrip('"\u201d\u2019\')').endswith('!'): return round(SPEED + 0.07, 2)
    if s.rstrip('"\u201d\u2019\')').endswith('?'): return round(SPEED + 0.03, 2)
    if len(s.split()) <= 4: return round(SPEED - 0.03, 2)   # short punchlines a touch slower
    return SPEED


def pop(a):
    """exclamations pop: about a semitone and a half higher and louder, same length"""
    x = subprocess.run([FFMPEG, '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', 'pipe:0',
                        '-af', f'asetrate={int(SR * 1.1)},aresample={SR},atempo={1 / 1.1:.5f},volume=1.3',
                        '-f', 's16le', '-ar', str(SR), '-ac', '1', 'pipe:1'],
                       input=a.astype(np.int16).tobytes(), capture_output=True, check=True).stdout
    y = np.frombuffer(x, np.int16).astype(np.float32)
    pk = np.abs(y).max() if len(y) else 0
    if pk > 32000: y *= 32000 / pk
    return y.astype(np.int16)


def is_excl(s): return s.rstrip('"\u201d\u2019\')').endswith('!')


# ---- voice check: every line is listened to (Parakeet) and re-taken if a word is wrong, missing or extra ----
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import textcheck as TC
MAX_TAKES = int(_brand.get('voice_takes', 5))
TAKES, CHECK = {}, []

def checked(s_, speed):
    """best take of one line: all words right, sane pace, no long dead air inside"""
    if s_ in TAKES: return tts(s_, speed, TAKES[s_])
    best = None
    for take in range(MAX_TAKES):
        a_ = tts(s_, speed, take)
        sc, diffs = TC.score(s_, TC.heard(a_, SR))
        n = len(TC.keys_of(s_)); dur = len(a_) / SR
        rate = n / max(0.2, dur)
        env = np.abs(a_.astype(np.float32)).reshape(-1)[:len(a_) // 240 * 240].reshape(-1, 240).mean(1)
        quiet = env < 120; run = longest = 0
        for q in quiet: run = run + 1 if q else 0; longest = max(longest, run)
        dead = longest * 0.01
        ok = sc >= 0.999 and (n < 5 or 1.6 <= rate / speed <= 5.4) and dead <= 0.9   # rushed/garbled or dragging reads are re-taken
        key = (ok, round(sc, 3), -abs(rate / speed - 4.2))
        print(f'  take {take} {"OK " if ok else "BAD"} score={sc:.3f} rate={rate:.2f} dead={dead:.2f} {diffs[:3]} | {s_[:60]}', file=sys.stderr, flush=True)
        if best is None or key > best[0]: best = (key, take, a_, sc, diffs, rate, dead)
        if ok: break
    _, take, a_, sc, diffs, rate, dead = best
    TAKES[s_] = take
    CHECK.append({'line': s_, 'take': take, 'ok': bool(best[0][0]), 'score': round(sc, 3), 'diffs': diffs, 'rate': round(rate, 2), 'dead_air': round(dead, 2)})
    return a_


def group_short(sents):
    """one- and two-word sentences ("Trees. Bison.") are read together with their neighbours: Chatterbox garbles them alone"""
    out, buf = [], []
    for s_ in sents:
        buf.append(s_)
        if sum(len(x.split()) for x in buf) >= 4 or len(s_.split()) > 2: out.append(' '.join(buf)); buf = []
    if buf:
        if out and len(' '.join(buf).split()) <= 2: out[-1] = out[-1] + ' ' + ' '.join(buf)
        else: out.append(' '.join(buf))
    return out


def checked_loop(s_, tail, speed):
    """the loop line is voiced together with the hook's first words and cut; check what is left the same way"""
    if s_ in TAKES: return cut_before(tts(s_ + ' ' + tail, speed, TAKES[s_]), s_, tail)
    best = None
    for take in range(MAX_TAKES):
        try: a_ = cut_before(tts(s_ + ' ' + tail, speed, take), s_, tail)
        except SystemExit: continue
        sc, diffs = TC.score(s_, TC.heard(a_, SR))
        if best is None or sc > best[0]: best = (sc, take, a_, diffs)
        if sc >= 0.999: break
    if best is None: raise SystemExit('loop line: no usable take')
    TAKES[s_] = best[1]
    CHECK.append({'line': s_, 'take': best[1], 'ok': best[0] >= 0.999, 'score': round(best[0], 3), 'diffs': best[3], 'rate': 0, 'dead_air': 0})
    return best[2]


SPOKEN = []
def synth():
  audio, n_spoken, first = [], 0, True
  SPOKEN.clear()
  for chunk, pause in pieces:
      if chunk:
          tail = None
          if re.search(r'\[cut\]', chunk, flags=re.I):
              chunk, tail = [c.strip() for c in re.split(r'\[cut\]', chunk, maxsplit=1, flags=re.I)]
          sents = sentences(clean(chunk, terminal=tail is None))
          if tail: head_, last_ = group_short(sents[:-1]), sents[-1:]
          else: head_, last_ = group_short(sents), []
          sents = head_ + last_
          for j, s_ in enumerate(sents):
              last = j == len(sents) - 1
              SPOKEN.append(s_)
              if last and tail:                                 # loop line: voiced with the hook's start, then cut
                  audio.append(checked_loop(s_, tail, speed_for(s_, first)))
              else:
                  a_ = checked(s_, speed_for(s_, first))
                  audio.append(pop(a_) if POP and is_excl(s_) else a_)
                  if not last: audio.append(np.zeros(int(gap_after(s_) * SR), dtype=np.int16))
              first = False
              n_spoken += 1
      if pause > 0:
          audio.append(np.zeros(int(pause * SR), dtype=np.int16))
  return audio, n_spoken


audio, n_spoken = synth()
# pacing: aim for a natural ~3.4 spoken words a second overall (pauses included), never under the minimum length
TARGET_WPS = float(_brand.get('words_per_second', 3.4))
_words = len(TC.keys_of(' '.join(SPOKEN)))
_dur = sum(len(x) for x in audio) / SR
_new = min(1.12, max(0.95, round(SPEED * TARGET_WPS / (_words / _dur), 3)))
if _dur * SPEED / _new < MIN_SECONDS + 1.5: _new = max(0.9, round(SPEED * _dur / (MIN_SECONDS + 2.5), 3))
if abs(_new - SPEED) / SPEED > 0.015:                 # takes are kept; only the tempo changes
    SPEED = _new
    audio, n_spoken = synth()
full = np.concatenate(audio) if audio else np.zeros(0, dtype=np.int16)
sf.write(out_wav, full, SR, subtype='PCM_16')
_base = re.sub(r'-(body|voiceover)\.wav$', '', out_wav)
open(_base + '-spoken.txt', 'w').write(' '.join(SPOKEN) + '\n')          # exactly what Larry says: captions use these words
_wps = len(TC.keys_of(' '.join(SPOKEN))) / (len(full) / SR)
json.dump({'speed': SPEED, 'words_per_second': round(_wps, 2), 'seconds': round(len(full) / SR, 2),
           'bad_lines': [c for c in CHECK if not c['ok']], 'retakes': sum(1 for c in CHECK if c['take'] > 0), 'lines': CHECK},
          open(_base + '-voicecheck.json', 'w'), indent=1)
print(json.dumps({'wav': out_wav, 'pieces': n_spoken, 'speed': SPEED, 'wps': round(_wps, 2), 'retakes': sum(1 for c in CHECK if c['take'] > 0),
                  'bad_lines': len([c for c in CHECK if not c['ok']]),
                  'pauses': sum(1 for _, p in pieces if p > 0), 'seconds': round(len(full) / SR, 2)}))
