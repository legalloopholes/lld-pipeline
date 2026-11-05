#!/usr/bin/env python3
"""Legal Loopholes Daily - render the vertical video from a scene plan.
Usage: render_video.py <voiceover.wav> <captions.srt> <output.mp4> [scene_plan.json | base64-json]
If no plan is given, looks for ~/.n8n-files/scenes/<VIDEO-ID>.json; without a plan it falls back to
Larry on white.
"""
import sys, os, re, json, math, shutil, subprocess, base64
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
ROOT = os.environ.get('LLD_ROOT') or os.path.expanduser('~/.n8n-files')
ASSETS = os.path.join(ROOT, 'assets')
FFMPEG = next((p for p in ['/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg', shutil.which('ffmpeg')] if p and os.path.exists(p)), 'ffmpeg')
FFPROBE = FFMPEG.replace('ffmpeg', 'ffprobe') if os.path.exists(FFMPEG.replace('ffmpeg', 'ffprobe')) else 'ffprobe'
CAPTION_STYLE = ("FontName=Arial Rounded MT Bold,FontSize=16,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,"
                 "BackColour=&H00000000,BorderStyle=1,Outline=4,Shadow=0,Alignment=2,MarginV=90")
FEET_Y = 1180             # ground line for characters (captions sit below)
LARRY_H = 770             # Larry's on-screen height at scale 1
CHAR_H = 720              # other characters' height at scale 1
NAVY, RED = (11, 16, 32), (230, 57, 70)
FONT_FILES = ([os.environ['LLD_FONT']] if os.environ.get('LLD_FONT') else []) + ['/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf', '/Library/Fonts/Arial Rounded Bold.ttf',
              '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
TALK_POSES = {'neutral', 'explaining'}
SR_A = 24000
# Words that get a coloured caption (and can trigger an automatic punch-in). Red = danger/shock, yellow = key idea.
HOT_RED = {'kill', 'killed', 'murder', 'death', 'die', 'dead', 'illegal', 'crime', 'crimes', 'prison', 'jail', 'never',
           'zero', 'impossible', 'nobody', 'banned', 'arrested', 'guilty'}
HOT_YELLOW = {'constitution', 'constitutional', 'constitutionally', 'congress', 'jury', 'jurors', 'law', 'loophole',
              'loopholes', 'amendment', 'federal', 'court', 'judge', 'legal', 'theory', 'technically', 'actually',
              'secret', 'free', 'million', 'billion', 'everyone', 'anyone', 'only'}
ZOOM_WORDS = {'zero', 'impossible', 'never', 'death', 'murder', 'kill', 'nobody', 'illegal', 'crime', 'prison', 'jail',
              'arrested', 'guilty', 'sued', 'lawsuit', 'million', 'millions', 'billion', 'billions', 'banned', 'secret',
              'loophole', 'escape', 'destroyed', 'seized', 'forever', 'worthless', 'nothing', 'free', 'void'}
LEGAL_LINE = 'Educational content • Not legal advice'
# Brand: assets/brand.json  {"handle": "@yourhandle", "handle_sfx": "correct", "handle_hold": 3.0}
try: BRAND = json.load(open(os.path.join(ASSETS, 'brand.json')))
except Exception: BRAND = {}
HANDLE = (BRAND.get('handle') or '').strip()
# 3D mode: the scene (sets, cast, props, camera) comes from the Three.js world in larry-3d/; this script still
# resolves the plan, and adds captions, cards, handle tag, legal line and sound on top. Switch: brand.json "renderer".
RENDER3D = (os.environ.get('LLD_RENDERER') or BRAND.get('renderer', '2d')).lower() == '3d'
R3D_DIR = os.path.expanduser(BRAND.get('renderer_dir') or os.path.join(ROOT, 'larry-3d'))
HANDLE_Y = 1400           # just under the captions: never over Larry (feet at 1180) or the prop band, above app UI

wav, srt, out = sys.argv[1], sys.argv[2], sys.argv[3]
video_id = os.path.basename(wav).replace('-voiceover.wav', '')

# ---------- inputs ----------
def t2s(t):
    h, m, s = t.split(':'); s, ms = s.split(',')
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000
words = []
for block in open(srt, encoding='utf-8').read().strip().split('\n\n'):
    lines = block.strip().split('\n')
    if len(lines) >= 3 and '-->' in lines[1]:
        a, b = [t2s(x.strip()) for x in lines[1].split('-->')]
        words.append((a, b, ' '.join(lines[2:])))
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
wn = [norm(w[2]) for w in words]
dur = float(subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav],
                           capture_output=True, text=True).stdout.strip())

plan = None
arg = sys.argv[4] if len(sys.argv) > 4 else os.path.join(ROOT, 'scenes', f'{video_id}.json')
if arg and os.path.exists(arg):
    plan = json.load(open(arg))
elif arg and not arg.endswith('.json'):
    try: plan = json.loads(base64.b64decode(arg).decode('utf-8'))
    except Exception: plan = None

NUMW = {'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
        'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty',
        'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million', 'billion', 'oh', 'and', 'point', 'percent',
        'first', 'second', 'third', 'fourth', 'fifth', 'tenth', 'st', 'nd', 'rd', 'th', 'twenties', 'thirties', 'forties',
        'fifties', 'sixties', 'seventies', 'eighties', 'nineties', 'hundreds', 'thousands', 'millions'}
def _numless(t): return t in NUMW or bool(re.fullmatch(r'\d+(st|nd|rd|th|s)?', t)) or bool(re.fullmatch(r'(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(one|two|three|four|five|six|seven|eight|nine)', t))
def find(phrase, start_idx=0):
    """time and index of the first word of `phrase` in the narration, searching forward from start_idx.
    Falls back to matching with number words/digits ignored, since the recognizer may write 'twenty fifteen' as '2015'."""
    toks = [norm(t) for t in phrase.split() if norm(t)]
    for rng in (range(start_idx, len(wn) - len(toks) + 1), range(0, len(wn) - len(toks) + 1)):
        for i in rng:
            if wn[i:i + len(toks)] == toks: return words[i][0], i
    core = [t for t in toks if not _numless(t)]
    if core:
        idx = [i for i, t in enumerate(wn) if not _numless(t)]
        red = [wn[i] for i in idx]
        for lo in (start_idx, 0):
            for j in range(len(red) - len(core) + 1):
                if idx[j] < lo: continue
                if red[j:j + len(core)] == core:
                    k = idx[j]                                     # back up over number words that led the phrase
                    while k > lo and _numless(wn[k - 1]) and toks and _numless(toks[0]): k -= 1
                    return words[k][0], k
    return None, None

# ---------- Larry's automatic pose per sentence ----------
sentences, cur = [], []
for w in words:
    cur.append(w)
    if re.search(r'[.?!:]$', w[2]): sentences.append(cur); cur = []
if cur: sentences.append(cur)
RULES = [(r'probably know this exists', 'smug'),
         (r'\bdisclaimer\b|not legal advice|educational purposes|interpreted as such', 'neutral'),
         (r'like and follow', 'confident'), (r'just be aware|before you try', 'smug'),
         (r'for the record|no one has ever|could reject|still be prosecuted', 'concerned'),
         (r'\bzero\b|impossible|weird|unable', 'surprised'), (r'^(however|but)\b', 'pointing'),
         (r'\?$', 'thinking'), (r'congress|amendment|constitution|district|jury|jurors|court|law\b', 'explaining')]
auto_seg = []
for i, s in enumerate(sentences):
    text = ' '.join(w[2] for w in s).lower()
    auto_seg.append([s[0][0], next((p for pat, p in RULES if re.search(pat, text)), ['explaining', 'neutral'][i % 2])])
def auto_pose(t):
    p = 'neutral'
    for a, q in auto_seg:
        if a <= t + 0.05: p = q
    return p
# Mouth follows the actual voice: open on syllables, closed in every pause (even tiny ones between words).
def _mouth_track():
    pcm = subprocess.run([FFMPEG, '-loglevel', 'error', '-i', wav, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'],
                         capture_output=True).stdout
    a = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768; sr = 16000
    n = int(len(a) / sr * FPS) + 2; win = int(0.03 * sr)
    segs = [a[max(0, int(i / FPS * sr) - win // 2):int(i / FPS * sr) + win // 2] for i in range(n)]
    rms = np.array([np.sqrt(np.mean(g ** 2) + 1e-12) if len(g) else 0.0 for g in segs])
    p95 = np.percentile(rms, 95)
    pad = np.pad(rms, 3, mode='edge')
    local = np.lib.stride_tricks.sliding_window_view(pad, 7).max(1)
    quiet = rms <= 0.22 * p95
    o = (~quiet) & (rms > 0.6 * local)
    for _ in range(2):                       # drop 1-frame blips so the mouth never flickers (silence always wins)
        i = 0
        while i < n:
            j = i
            while j < n and o[j] == o[i]: j += 1
            if j - i < 2 and 0 < i and j < n and not quiet[i]: o[i:j] = o[i - 1]
            i = j
    return o & ~quiet
MOUTH = _mouth_track()
def talking(t):
    f = int(round(t * FPS))
    return bool(MOUTH[f]) if f < len(MOUTH) else False

# ---------- sound effects (built-in, royalty-free; drop assets/sfx/<name>.wav to override) ----------
def _lp(x, alpha):
    y = np.empty_like(x); acc = 0.0
    al = np.broadcast_to(alpha, x.shape)
    for i in range(len(x)): acc += al[i] * (x[i] - acc); y[i] = acc
    return y
def _sfx(name):
    sr = SR_A; rng = np.random.default_rng(7)
    T = lambda d: np.arange(int(d * sr)) / sr
    if name == 'pop':
        t = T(0.09); f = 1200 * np.exp(-t * 14) + 380
        x = np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-t * 45)
    elif name == 'whoosh':
        t = T(0.42); n = rng.standard_normal(len(t)); p = t / t[-1]
        x = _lp(n, 0.04 + 0.45 * np.sin(np.pi * p) ** 2) * np.sin(np.pi * p) ** 2
    elif name in ('boom', 'hit'):
        d = 1.0 if name == 'boom' else 0.4; t = T(d)
        f = 55 * np.exp(-t * 1.2) + 36
        ph = 2 * np.pi * np.cumsum(f) / sr
        x = np.tanh(3 * (np.sin(ph) + 0.5 * np.sin(2 * ph))) * np.minimum(1, t / 0.005) * np.exp(-t * (3.2 if name == 'boom' else 8))
        x[:int(0.03 * sr)] += _lp(rng.standard_normal(int(0.03 * sr)), 0.3) * np.exp(-T(0.03) * 120) * 0.8
    elif name == 'ding':
        t = T(1.4); x = sum(a * np.sin(2 * np.pi * 1318 * r * t) * np.exp(-t * dcy)
                            for r, a, dcy in [(1, 1, 3), (2.0, .4, 4), (2.76, .3, 6), (5.4, .15, 9)])
    elif name == 'wind':
        t = T(2.8); n = rng.standard_normal(len(t))
        x = _lp(n, 0.03) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t)) * np.minimum(1, t / 0.4) * np.minimum(1, (t[-1] - t) / 0.6)
    elif name == 'gavel':
        x = np.zeros(int(0.6 * sr))
        for st in (0, 0.22):
            t = T(0.3); k = (np.sin(2 * np.pi * 190 * t) + 0.6 * np.sin(2 * np.pi * 420 * t)) * np.exp(-t * 30)
            k[:int(0.015 * sr)] += _lp(rng.standard_normal(int(0.015 * sr)), 0.25) * 1.5
            i = int(st * sr); x[i:i + len(k)] += k[:len(x) - i]
    elif name == 'boing':
        t = T(0.6); f = 380 * np.exp(-t * 1.5) + 60 * np.sin(2 * np.pi * 11 * t) * np.exp(-t * 3)
        x = np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-t * 4.5)
    elif name == 'step':
        t = T(0.12); x = np.sin(2 * np.pi * 523 * t) * np.exp(-t * 35)
    elif name == 'stinger':
        parts = []
        for f0, d in ((146.8, 0.2), (138.6, 0.2), (110.0, 1.0)):
            t = T(d); x = sum(np.sin(2 * np.pi * f0 * h * t) / h for h in range(1, 8))
            parts.append(x * np.minimum(1, t / 0.01) * np.exp(-t * (6 if d < 0.5 else 1.8)))
            parts.append(np.zeros(int(0.03 * sr)))
        x = np.concatenate(parts)
    else:
        return np.zeros(1)
    return (x / (np.abs(x).max() + 1e-9) * 0.9).astype(np.float32)
FILE_GAIN = {'vine': 0.36, 'boom': 0.7, 'pop': 0.55, 'alert': 0.5, 'huh': 0.7, 'correct': 0.5, 'error': 0.5, 'quack': 0.55,
             'click': 0.7, 'ding': 0.5}
SFX_GAIN = {'pop': 0.42, 'whoosh': 0.42, 'boom': 0.6, 'hit': 0.55, 'ding': 0.45, 'wind': 0.32, 'gavel': 0.6,
            'boing': 0.42, 'step': 0.3, 'stinger': 0.55}
_sfx_cache = {}
try: SFX_SOURCES = {k: v for k, v in json.load(open(os.path.join(ASSETS, 'sfx_sources.json'))).items() if not k.startswith('_')}
except Exception: SFX_SOURCES = {}
SFX_CACHE = os.path.join(ROOT, 'sfx-cache')
def _sourced(name):
    """real (CC0, Freesound) recording for this sound; downloaded once, leading silence trimmed. None if unavailable."""
    src = SFX_SOURCES.get(name)
    if not src: return None
    path = os.path.join(SFX_CACHE, f"{src['id']}.mp3")
    try:
        if not os.path.exists(path) or os.path.getsize(path) < 1000:
            import urllib.request
            os.makedirs(SFX_CACHE, exist_ok=True)
            req = urllib.request.Request(src['url'], headers={'User-Agent': 'LLD-pipeline'})
            with urllib.request.urlopen(req, timeout=60) as r, open(path + '.part', 'wb') as fh: fh.write(r.read())
            os.replace(path + '.part', path)
        d = float(src.get('dur', 1.0))
        af = (f'silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:{d},'
              f'afade=t=out:st={d * 0.65:.3f}:d={d * 0.35:.3f}')
        pcm = subprocess.run([FFMPEG, '-loglevel', 'error', '-i', path, '-af', af, '-f', 's16le', '-ac', '1', '-ar', str(SR_A), '-'],
                             capture_output=True).stdout
        x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
        if len(x) < 100: return None
        return x / (np.abs(x).max() + 1e-9) * 0.9 * float(src.get('gain', 0.4)) / SFX_GAIN.get(name, 0.3)
    except Exception as e:
        print(json.dumps({'warning': f'sound effect {name} unavailable: {e}'}), file=sys.stderr)
        return None
FILE_ALIAS = {'vine': 'boom'}            # 'vine' events play your vine-boom file (assets/sfx/boom.wav)
def sfx_audio(name):
    if name in _sfx_cache: return _sfx_cache[name]
    f = os.path.join(ASSETS, 'sfx', f'{FILE_ALIAS.get(name, name)}.wav')    # your own sound files come first
    if not os.path.exists(f):
        x = _sourced(name)                                                   # then the CC0 Freesound recordings
        if x is not None:
            _sfx_cache[name] = x; return x
    if os.path.exists(f):
        pcm = subprocess.run([FFMPEG, '-loglevel', 'error', '-i', f, '-f', 's16le', '-ac', '1', '-ar', str(SR_A), '-'], capture_output=True).stdout
        x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768 * FILE_GAIN.get(name, 0.4) / SFX_GAIN.get(name, 0.3)
    else:
        x = _sfx(name)
    _sfx_cache[name] = x
    return x
SFX_EVENTS = []     # (time, name)

# ---------- assets ----------
def load_font(size):
    for f in FONT_FILES:
        if os.path.exists(f): return ImageFont.truetype(f, size)
    return ImageFont.load_default()
_cache = {}
def sprite(kind, name, target_h=None, target_w=None):
    key = (kind, name, target_h, target_w)
    if key in _cache: return _cache[key]
    folder = {'larry': 'larry', 'char': 'chars', 'prop': 'props', 'bg': 'bg'}[kind]
    fname = f'larry-{name}.png' if kind == 'larry' else f'{name}.png'
    f = os.path.join(ASSETS, folder, fname)
    if not os.path.exists(f):
        _cache[key] = None; return None
    im = Image.open(f).convert('RGB' if kind == 'bg' else 'RGBA')
    if kind == 'bg':
        s = max(W / im.width, H / im.height) * 1.06          # a little extra room for the slow zoom
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    elif target_h or target_w:
        s = min((target_h or 1e9) / im.height, (target_w or 1e9) / im.width)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    _cache[key] = im
    return im

_cards = {}
def make_card(text, max_w=900):
    if text in _cards: return _cards[text]
    if len(text) > 18 and ' ' in text and '\n' not in text:      # long hooks wrap onto two balanced lines
        ws_ = text.split(); best = None
        for i in range(1, len(ws_)):
            a_, b_ = ' '.join(ws_[:i]), ' '.join(ws_[i:])
            if best is None or abs(len(a_) - len(b_)) < abs(len(best[0]) - len(best[1])): best = (a_, b_)
        text_draw = best[0] + '\n' + best[1]
    else: text_draw = text
    f = load_font(150 if len(text) <= 2 else (84 if '\n' in text_draw else 74))
    bb = ImageDraw.Draw(Image.new('RGBA', (1, 1))).multiline_textbbox((0, 0), text_draw, font=f, align='center', spacing=14)
    w, h = int(bb[2] - bb[0] + 90), int(bb[3] - bb[1] + 70)
    card = Image.new('RGBA', (w + 16, h + 16), (0, 0, 0, 0)); d = ImageDraw.Draw(card)
    d.rounded_rectangle([8, 14, w + 8, h + 14], 34, fill=(0, 0, 0, 40))
    d.rounded_rectangle([0, 0, w, h], 34, fill=(255, 255, 255, 255))
    d.rectangle([20, h - 18, w - 20, h - 6], fill=RED)
    d.rounded_rectangle([0, 0, w, h], 34, outline=NAVY, width=8)
    d.multiline_text((45 - bb[0], 30 - bb[1]), text_draw, font=f, fill=NAVY, align='center', spacing=14)
    if card.width > max_w: card = card.resize((max_w, round(card.height * max_w / card.width)), Image.LANCZOS)
    _cards[text] = card
    return card

g = np.linspace(0, 1, H)[:, None, None]
white = (np.array([255, 255, 255]) * (1 - g) + np.array([244, 244, 240]) * g).repeat(W, 1)
yy, xx = np.mgrid[0:H, 0:W]
WHITE_BG = Image.fromarray(np.clip(white - np.exp(-(((xx - W / 2) / 230) ** 2 + ((yy - FEET_Y) / 26) ** 2))[..., None] * 38,
                                   0, 255).astype(np.uint8), 'RGB').convert('RGBA')

def pop(age, dur_in=0.18, bounce=0.12):
    if age < 0: return 0.0
    return min(1.0, age / dur_in) * (1 + bounce * math.exp(-age * 10) * math.sin(age * 25)) if age < 0.6 else 1.0

# ---------- timeline ----------
scenes = []
if plan:
    idx = 0
    for sc in plan.get('scenes', []):
        if sc.get('at') in (None, '', 'start'): t0, i0 = 0.0, 0
        else:
            t0, i0 = find(sc['at'], idx)
            if t0 is None:
                print(json.dumps({'warning': f'phrase not found: {sc["at"]}'}), file=sys.stderr); continue
        idx = i0
        items = []
        if not scenes and plan.get('hook'):
            items.append({'card': plan['hook'], 't': 0.0, 'hold': 2.6, 'sfx': 'none', 'hook': True})
        for it in sc.get('props', []) + ([{'card': sc['card'], 'at': sc.get('card_at'), 'y': sc.get('card_y', 0.14)}] if sc.get('card') else []):
            ta = t0
            if it.get('at'):
                ta2, _ = find(it['at'], i0); ta = ta2 if ta2 is not None else t0
            items.append(dict(it, t=ta))
        zooms = []
        for z in sc.get('zooms', []):
            tz, _ = find(z['at'], i0)
            if tz is not None: zooms.append(dict(z, t=tz))
        scenes.append(dict(sc, t=t0, items=items, zooms=zooms))
    scenes.sort(key=lambda s: s['t'])
if not scenes or scenes[0]['t'] > 0:
    scenes.insert(0, {'t': 0.0, 'bg': 'white', 'cast': [{'id': 'larry:auto'}], 'items': []})
# loop ending: the last scene must look exactly like the video's first frame, so the replay is seamless.
# It is the last scene when the plan marks it "loop": true or it reuses the opening background. Anyone who
# enters during the opening (tiptoe / walk-in) is left out, because at frame 0 they are still off-screen.
ENTRANCES = ('tiptoe', 'walk_in', 'enter')
if len(scenes) > 2 and (scenes[-1].get('loop') or (scenes[-1].get('bg', 'white') == scenes[0].get('bg', 'white') != 'white')):
    scenes[-1]['cast'] = [dict(c) for c in scenes[0].get('cast', []) if c.get('anim') not in ENTRANCES]
    for c in scenes[-1]['cast']: c.pop('anim', None)
    scenes[-1]['loop'] = True
for i, sc in enumerate(scenes):
    sc['end'] = scenes[i + 1]['t'] if i + 1 < len(scenes) else dur + 1
    sc.setdefault('zooms', [])

# automatic punch-ins on shock words (at most one every 6 s, never on top of a planned one)
planned_z = [z['t'] for sc in scenes for z in sc['zooms']]
last = -99
for (a, b, wtxt), n_ in zip(words, wn):
    if n_ in ZOOM_WORDS and a - last >= 5 and all(abs(a - p) > 4 for p in planned_z):
        for sc in reversed(scenes):
            if sc['t'] <= a:
                if not plan or plan.get('auto_zoom', True): sc['zooms'].append({'t': a, 'amount': 1.18, 'hold': 0.9, 'auto': True})
                break
        last = a

# sound effects tied to what happens on screen (plan items can force one with "sfx": name, or silence it with "none")
for i, sc in enumerate(scenes):
    if i > 0 and sc.get('sfx', 'whoosh') != 'none': SFX_EVENTS.append((sc['t'], sc.get('sfx', 'whoosh')))
    for it in sc['items']:
        name = it.get('sfx')
        if not name:
            pid = it.get('id', '')
            name = ('wind' if it.get('anim') == 'roll' else 'gavel' if 'gavel' in pid else 'click' if pid.startswith('map') else
                    'pop')
        if name != 'none': SFX_EVENTS.append((it['t'], name))
    for z in sc['zooms']:
        if z.get('sfx', 'vine') != 'none': SFX_EVENTS.append((z['t'], 'vine' if z.get('sfx', 'hit') == 'hit' else z['sfx']))
    for c in sc.get('cast', []):
        if c.get('anim') == 'tiptoe':
            walk = max(0.6, (sc['end'] - sc['t']) * 0.7)
            for k_ in range(int(walk / 0.29)): SFX_EVENTS.append((sc['t'] + k_ * 0.29, 'step'))
            SFX_EVENTS.append((sc['t'] + walk, 'alert'))                     # "!" when he arrives behind his target
        if c['id'] == 'larry:surprised': SFX_EVENTS.append((sc['t'] + 0.05, 'boing'))
        if 'confused' in c['id']: SFX_EVENTS.append((sc['t'] + 0.6, 'huh'))
    for e in sc.get('sfx_at', []):                                       # plan: {"at": phrase, "sfx": "quack"}
        te, _ = find(e['at'], 0)
        if te is not None: SFX_EVENTS.append((te, e['sfx']))
# handle tag + sound when the narration says "follow Legal Loopholes Daily" (last mention = the call to action)
HANDLE_T = None
for ph in ('follow legal loopholes daily', 'legal loopholes daily'):
    toks = [norm(x) for x in ph.split()]
    hits = [i for i in range(len(wn) - len(toks) + 1) if wn[i:i + len(toks)] == toks]
    if hits:
        HANDLE_T = words[hits[-1]][0]; break
if HANDLE_T is not None and BRAND.get('handle_sfx', 'correct') != 'none':
    SFX_EVENTS.append((HANDLE_T, BRAND.get('handle_sfx', 'correct')))
# call to action: Larry says the share line ("Send this to the friend who..."); the like/follow ask sits on a sign
# above his head from that moment until the loop ending, with the @handle tag
SHARE_LINE = BRAND.get('follow_sign', 'LIKE & FOLLOW FOR MORE LOOPHOLES') if (plan or {}).get('share_line') else ''
SHARE_T0 = SHARE_T1 = None
if SHARE_LINE:
    toks = [norm(x) for x in 'send this to'.split()]
    hits = [i for i in range(len(wn) - len(toks) + 1) if wn[i:i + len(toks)] == toks]
    if not hits:
        toks = [norm(x) for x in 'make sure to like'.split()]
        hits = [i for i in range(len(wn) - len(toks) + 1) if wn[i:i + len(toks)] == toks]
    SHARE_T0 = words[hits[-1]][0] if hits else (HANDLE_T - 1.5 if HANDLE_T is not None else None)
    if SHARE_T0 is not None:
        _sh = next((s_ for s_ in sentences if s_[0][0] >= SHARE_T0 - 0.05), None)
        if _sh: SFX_EVENTS.append((_sh[-1][1] + 0.05, 'quack'))          # Mac quack after "...who is this dumb."
    if SHARE_T0 is not None and HANDLE_T is None:
        HANDLE_T = SHARE_T0 + 0.6
        if BRAND.get('handle_sfx', 'correct') != 'none': SFX_EVENTS.append((HANDLE_T, BRAND.get('handle_sfx', 'correct')))
    if SHARE_T0 is not None:
        SHARE_T1 = scenes[-1]['t'] - 0.05 if scenes[-1].get('loop') and scenes[-1]['t'] > SHARE_T0 + 1.5 else SHARE_T0 + 4.5
        SFX_EVENTS.append((SHARE_T0 + 0.2, 'airhorn'))
# narration cues
for s_ in sentences:
    txt = ' '.join(w[2] for w in s_).lower()
    if re.search(r"^(so,? )?the (legal )?theory|the thing is|turns out|the (supreme )?court (said|ruled|agreed|disagreed|reversed|sided)|"
                 r"^(and )?the answer", txt):
        SFX_EVENTS.append((s_[0][0], 'ding'))
    if txt.rstrip().endswith('?') and s_[0][0] > 3:                    # rhetorical question -> "huh?"
        SFX_EVENTS.append((s_[-1][1] + 0.05, 'huh'))
    if re.search(r"here'?s the (catch|kicker|twist|limit|problem)|plot twist|not so fast|there'?s a catch", txt):
        SFX_EVENTS.append((s_[0][0], 'alert'))                          # Metal Gear "!"
    elif re.search(r"^but\b", txt):
        SFX_EVENTS.append((s_[0][0], 'scratch'))
    if re.search(r"\b(threw out|thrown out|unenforceable|void|denied|reversed|invalid)\b", txt):
        SFX_EVENTS.append((s_[-1][1] + 0.05, 'error'))
    if re.search(r'(have|has) not done anything|done nothing|never fixed|still exists', txt):
        SFX_EVENTS.append((s_[-1][0], 'bruh'))
    if re.search(r"\b(lost|rejected|went badly|didn'?t work|failed|said no)\b", txt):
        SFX_EVENTS.append((s_[-1][1] + 0.1, 'trombone'))
MONEY = {'dollars', 'dollar', 'million', 'millions', 'billion', 'billions', 'money', 'cash', 'royalties', 'rent', 'tax', 'taxes', 'paid', 'rich'}
SHOCK = {'kill', 'killed', 'murder', 'death', 'destroyed', 'seized', 'arrested', 'prison', 'jail', 'escape', 'stolen'}
for (a, b, wtxt), n_ in zip(words, wn):
    if n_ in MONEY: SFX_EVENTS.append((b, 'cash'))
    if n_ in SHOCK: SFX_EVENTS.append((b + 0.05, 'gasp'))
# energy: every exclamation gets a quick punch-in and a dutch tilt (no sound of its own)
TILTS = []
_planned = [z['t'] for sc in scenes for z in sc['zooms']]
# the recognizer rarely writes "!", so the exclamations come from the episode script itself
EXCL_T, _pos = [], 0
_scr = re.sub(r'\[[^\]]*\]', ' ', ((plan or {}).get('script') or '').split('[loop]')[0])
for _sent in re.findall(r'[^.?!]+[.?!]+', _scr):
    _w = [x for x in _sent.split() if norm(x)][:4]
    if len(_w) < 1: continue
    _t, _i = find(' '.join(_w), _pos)
    if _t is None or _i < _pos: continue
    _pos = _i + 1
    if _sent.strip().endswith('!'): EXCL_T.append(_t)
for t0_ in EXCL_T:
    if t0_ < 2.5: continue
    if SHARE_T0 is not None and t0_ >= SHARE_T0 - 0.5: continue
    TILTS.append({'t': t0_, 'dir': 1 if len(TILTS) % 2 == 0 else -1})
    if all(abs(t0_ - p) > 1.2 for p in _planned):
        for sc in reversed(scenes):
            if sc['t'] <= t0_ and not sc.get('loop'):
                sc['zooms'].append({'t': t0_, 'amount': 1.1, 'hold': 0.55, 'sfx': 'none', 'auto': True}); _planned.append(t0_); break

# keep it tasteful: per-sound limits and no two sounds piled on top of each other
LIMITS = {'boom': (0, 6), 'alert': (2, 12), 'huh': (3, 10), 'error': (2, 12), 'ding': (2, 15),
          'correct': (2, 15), 'boing': (2, 12), 'stinger': (0, 20), 'hit': (10, 4), 'vine': (8, 5), 'quack': (1, 99), 'scratch': (2, 10), 'bruh': (1, 99),
          'trombone': (1, 99), 'cash': (3, 10), 'gasp': (2, 12), 'airhorn': (1, 99), 'gavel': (2, 10), 'wind': (1, 99)}
PRIORITY = ['correct', 'airhorn', 'boom', 'alert', 'stinger', 'scratch', 'trombone', 'bruh', 'error', 'huh', 'ding', 'gavel',
            'hit', 'vine', 'cash', 'gasp', 'boing', 'wind', 'quack', 'click', 'pop', 'whoosh', 'step']
rank = lambda n: PRIORITY.index(n) if n in PRIORITY else 50
kept, count, times = [], {}, {}
for t_, n_ in sorted(SFX_EVENTS, key=lambda e: (rank(e[1]), e[0])):      # important sounds claim their moment first
    mx, gap_ = LIMITS.get(n_, (99, 0))
    if n_ in ('vine', 'hit', 'boom') and t_ < 3: continue              # no booms over the opening hook
    if count.get(n_, 0) >= mx or any(abs(t_ - x) < gap_ for x in times.get(n_, [])): continue
    if n_ not in ('step', 'whoosh') and any(abs(t_ - x) < 0.35 for x, m in kept if m not in ('step', 'whoosh')): continue
    kept.append((t_, n_)); count[n_] = count.get(n_, 0) + 1; times.setdefault(n_, []).append(t_)
SFX_EVENTS = sorted(kept)
# keep the energy up: if ~9 s pass with no feature sound, the next sentence lands with a meme boom
_feat = sorted(t for t, n in SFX_EVENTS if n not in ('whoosh', 'pop', 'step'))
_last = 0.0
for s_ in sentences:
    t0_ = s_[0][0]
    if any(_last < x <= t0_ for x in _feat): _last = max(x for x in _feat if x <= t0_)
    if t0_ - _last < 9 or (HANDLE_T is not None and t0_ > HANDLE_T - 3): continue
    for te_ in (s_[-1][1] + 0.05, t0_):                              # end of the sentence, else its start
        if te_ - _last >= 6 and all(abs(te_ - x) > 0.35 for x in _feat):
            SFX_EVENTS.append((te_, 'vine')); _feat.append(te_); _last = te_; break
SFX_EVENTS.sort()
# reaction stickers: a big emoji pops beside the caption on the moments that already have a sound
STICKER_FOR = {'gasp': '\U0001F631', 'cash': '\U0001F4B0', 'huh': '\U0001F914', 'alert': '\u2757', 'error': '\u274C',
               'quack': '\U0001F921', 'scratch': '\U0001F62C', 'trombone': '\U0001F62D', 'bruh': '\U0001F480', 'vine': '\U0001F4A5'}
STICKERS = []
for t_, n_ in SFX_EVENTS:
    if n_ in STICKER_FOR and t_ > 2.5 and (not STICKERS or t_ - STICKERS[-1][0] >= 2.5) and len(STICKERS) < 14 \
            and not (BRAND.get('stickers', True) is False):
        STICKERS.append((t_, STICKER_FOR[n_], len(STICKERS) % 2))

def scene_at(t):
    for sc in reversed(scenes):
        if sc['t'] <= t: return sc
    return scenes[0]

# ---------- layout: real proportions, no overlaps ----------
MARGIN, GAP = 50, 36                 # screen-edge margin and minimum space between figures (px)
BAND_TOP, BAND_GAP = 70, 36          # props/cards live above the figures with at least this much space
# On-screen height (px) of each figure at full size. Larry standing = 770. Keeps everyone in proportion.
REGISTRY = {'larry': 770, 'larry:sneaky': 740,
            'char-friend-chimp': 560, 'char-judge': 730, 'char-judge-confused': 850, 'char-politician': 860}
try: REGISTRY.update(json.load(open(os.path.join(ASSETS, 'registry.json'))))
except Exception: pass
LARRY_POSES = ['neutral', 'explaining', 'pointing', 'thinking', 'surprised', 'smug', 'concerned', 'confident']

def fig_key(cid):
    if cid.startswith('larry'):
        pose = cid.split(':', 1)[1] if ':' in cid else 'auto'
        return 'larry:' + pose if 'larry:' + pose in REGISTRY else 'larry'
    return cid

def fig_sprite(cid, pose, k, talk=False):
    h = round(REGISTRY.get(fig_key(cid if not cid.startswith('larry') else 'larry:' + pose), 720) * k)
    if cid.startswith('larry'):
        im = sprite('larry', pose + '-talk', h) if talk else None
        return im or sprite('larry', pose, h) or sprite('larry', 'neutral', h)
    return sprite('char', cid, h)

def layout(sc):
    """Fix each figure's position once per scene: ordered by requested x, spaced so nothing overlaps,
    shrunk together (keeping proportions) if they don't fit across the screen."""
    cast = sorted(sc.get('cast', []), key=lambda c: c.get('x', 0.5))
    def widths(k):
        ws = []
        for c in cast:
            if c['id'].startswith('larry'):
                pose = c['id'].split(':', 1)[1] if ':' in c['id'] else 'auto'
                poses = LARRY_POSES if pose == 'auto' else [pose]
                ws.append(max((fig_sprite(c['id'], p, k).width for p in poses if fig_sprite(c['id'], p, k)), default=0))
            else:
                im = fig_sprite(c['id'], None, k); ws.append(im.width if im else 0)
        return ws
    def tallest(k):
        hs = []
        for c in cast:
            if c['id'].startswith('larry'):
                pose = c['id'].split(':', 1)[1] if ':' in c['id'] else 'auto'
                poses = LARRY_POSES if pose == 'auto' else [pose]
                hs.append(max(fig_sprite(c['id'], p, k).height for p in poses if fig_sprite(c['id'], p, k)))
            else:
                im = fig_sprite(c['id'], None, k); hs.append(im.height if im else 0)
        return max(hs, default=0)
    # a big prop (e.g. a map) asks for room: figures shrink together, never below 60% size
    want_band = max([H * it.get('h', 0) for it in sc.get('items', []) if it.get('anim') != 'roll' and it.get('h', 0) >= 0.24], default=0)
    k = 1.0
    while want_band and k > 0.6 and FEET_Y - tallest(k) - BAND_GAP - BAND_TOP < want_band:
        k *= 0.95
    for _ in range(12):
        ws = widths(k)
        if sum(ws) + GAP * (len(ws) - 1) <= W - 2 * MARGIN: break
        k *= 0.92
    total = sum(ws) + GAP * (len(ws) - 1)
    # honour requested x where possible, but never overlap or leave the screen
    xs, cursor = [], MARGIN
    for c, w in zip(cast, ws):
        want = W * c.get('x', 0.5) - w / 2
        left = max(cursor, want)
        xs.append(left); cursor = left + w + GAP
    overflow = cursor - GAP - (W - MARGIN)
    if overflow > 0: xs = [x - overflow for x in xs]
    if len(cast) == 1 and 'x' not in cast[0]: xs = [(W - ws[0]) / 2]
    # tallest figure decides how much room is left above for props
    tops = []
    for c in cast:
        if c['id'].startswith('larry'):
            pose = c['id'].split(':', 1)[1] if ':' in c['id'] else 'auto'
            poses = LARRY_POSES if pose == 'auto' else [pose]
            tops.append(max(fig_sprite(c['id'], p, k).height for p in poses if fig_sprite(c['id'], p, k)))
        else:
            im = fig_sprite(c['id'], None, k); tops.append(im.height if im else 0)
    sc['_layout'] = {'k': k, 'slots': list(zip(cast, xs, ws)), 'fig_top': FEET_Y - max(tops, default=0)}

def draw_cast(frame, sc, t):
    if '_layout' not in sc:
        if sc.get('loop'):                                   # copy the opening frame's exact positions and sizes
            if '_layout' not in scenes[0]: layout(scenes[0])
            L0 = scenes[0]['_layout']
            sc['_layout'] = dict(L0, slots=[(dict(c, anim=None), x, w) for c, x, w in L0['slots'] if c.get('anim') not in ENTRANCES])
        else:
            layout(sc)
    L = sc['_layout']; age = t - sc['t']
    still = sc['t'] == 0 or sc.get('loop')                   # opening frame and loop ending: cast already in place
    for n, (c, left, w) in enumerate(L['slots']):
        cid = c['id']
        if cid.startswith('larry'):
            pose = cid.split(':', 1)[1] if ':' in cid else 'auto'
            if pose == 'auto': pose = auto_pose(t)
            im = fig_sprite(cid, pose, L['k'], talk=pose in TALK_POSES and talking(t))
        else:
            pose = cid; im = fig_sprite(cid, None, L['k'])
        if im is None: continue
        if c.get('flip'): im = im.transpose(Image.FLIP_LEFT_RIGHT)
        cx = left + w / 2; dy = 0
        if c.get('anim') == 'tiptoe':                       # walks in from off-screen and stops at its slot
            p = min(1.0, age / max(0.6, (sc['end'] - sc['t']) * 0.7))
            start = -w / 2 if c.get('from', 'left') == 'left' else W + w / 2
            cx = start + (cx - start) * p
            dy = -abs(12 * math.sin(t * 7)) if p < 1.0 else 0
        s = 1.0 if (still or c.get('anim') == 'tiptoe') else pop(age - 0.08 * n)
        if s <= 0.02: continue
        if s != 1.0: im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.BILINEAR)
        top = round(FEET_Y - im.height + dy)
        frame.alpha_composite(im, (round(cx - im.width / 2), top))
        if pose == 'surprised' and age < 1.2:
            d = ImageDraw.Draw(frame); r = int(age * 10) % 3
            for side in (-1, 1):
                for ang in (-35, 0, 35):
                    a = math.radians(ang); bx = cx + side * (im.width / 2 + 10)
                    d.line([(bx + side * (6 + 3 * r) * math.cos(a), top + 110 + (6 + 3 * r) * math.sin(a)),
                            (bx + side * (30 + 3 * r) * math.cos(a), top + 110 + (30 + 3 * r) * math.sin(a))],
                           fill=(246, 190, 60, 255), width=11)

def item_image(it, sc):
    """Prop or card scaled to fit the free band above the figures (never touching them)."""
    if '_layout' not in sc: layout(sc)
    band_h = sc['_layout']['fig_top'] - BAND_GAP - BAND_TOP
    if 'card' in it: im = make_card(it['card'])
    else: im = sprite('prop', it['id'], H * it.get('h', 0.2), W * it.get('w', 0.8))
    if im is None: return None
    if it.get('anim') == 'roll': return im
    f = min(1.0, band_h / im.height, (W - 2 * MARGIN) / im.width)
    if f < 1.0: im = im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.LANCZOS)
    return im

FRAME_BOXES = []
def draw_items(frame, sc, t):
    if '_layout' not in sc: layout(sc)
    band = [it for it in sc['items'] if it.get('anim') != 'roll']
    for j, it in enumerate(band):                           # one band item at a time: the next one replaces it
        nxt = band[j + 1]['t'] if j + 1 < len(band) else sc['end']
        it['_end'] = min(nxt, it['t'] + it['hold']) if it.get('hold') else nxt
    for it in sc['items']:
        age = t - it['t']
        if age < 0: continue
        im = item_image(it, sc)
        if im is None: continue
        if it.get('anim') == 'roll':
            # rolls in along the floor and stops in the widest empty gap between figures
            slots = sc['_layout']['slots']; edges = [(MARGIN, MARGIN)] + [(l, l + w) for _, l, w in slots] + [(W - MARGIN, W - MARGIN)]
            gaps = sorted(((edges[i + 1][0] - edges[i][1], (edges[i][1] + edges[i + 1][0]) / 2) for i in range(len(edges) - 1)), reverse=True)
            gw, gx = gaps[0]
            f = min(1.0, (gw - 2 * GAP) / im.width) if gw > 2 * GAP else 0.0
            if f <= 0.05: continue
            if f < 1.0: im = im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.LANCZOS)
            p = min(1.0, age / it.get('roll_time', 2.0))
            start = W + im.width / 2 if gx > W / 2 else -im.width / 2
            x = start + (gx - start) * (1 - (1 - p) ** 2)
            y = FEET_Y - im.height / 2 - (abs(30 * math.sin(p * math.pi * 3)) if p < 1 else 0)
            pim = im.rotate((1 - p) * 540 * (1 if start > gx else -1), resample=Image.BILINEAR, expand=True)
            frame.alpha_composite(pim, (round(x - pim.width / 2), round(y - pim.height / 2)))
            continue
        left = it['_end'] - t
        if left <= 0: continue
        s = pop(age)
        if left < 0.15: s *= max(0.0, left / 0.15)
        if s <= 0.02: continue
        band_h = sc['_layout']['fig_top'] - BAND_GAP - BAND_TOP
        x, y = W * it.get('x', 0.5), BAND_TOP + band_h / 2
        pim = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.BILINEAR) if s != 1.0 else im
        frame.alpha_composite(pim, (round(x - pim.width / 2), round(y - pim.height / 2)))
        bw, bh = im.width, im.height
        FRAME_BOXES.append((x - bw / 2, y - bh / 2, x + bw / 2, y + bh / 2))

def background(sc, t):
    bg = sc.get('bg', 'white')
    im = sprite('bg', bg) if bg != 'white' else None
    if im is None: return WHITE_BG.copy()
    p = min(1.0, (t - sc['t']) / max(1.0, sc['end'] - sc['t']))
    z = 1.0 + 0.045 * p                                    # slow push-in
    cw, ch = im.width / 1.06 / z, im.height / 1.06 / z
    cx, cy = im.width / 2, im.height / 2
    crop = im.crop((round(cx - cw / 2), round(cy - ch / 2), round(cx + cw / 2), round(cy + ch / 2)))
    return crop.resize((W, H), Image.BILINEAR).convert('RGBA')

def zoom_amount(sc, t):
    best = 1.0
    for z in sc['zooms']:
        age = t - z['t']; hold = z.get('hold', 0.9); amt = z.get('amount', 1.18)
        if 0 <= age < hold + 0.25:
            e = min(1.0, age / 0.08) if age < hold else max(0.0, 1 - (age - hold) / 0.25)
            best = max(best, 1 + (amt - 1) * e)
    return best

def apply_zoom(frame, sc, t):
    z = zoom_amount(sc, t)
    if z <= 1.001: return frame
    L = sc.get('_layout'); cx, cy = W / 2, H * 0.4
    if L:
        for c, left, w in L['slots']:
            if c['id'].startswith('larry'):
                cx = left + w / 2; cy = FEET_Y - REGISTRY['larry'] * L['k'] * 0.72; break
    def fit(z):
        cw, ch = W / z, H / z
        x0 = min(max(0, cx - cw / 2), W - cw); y0 = min(max(0, cy - ch / 2), H - ch)
        if FRAME_BOXES:                                    # slide the window to keep props/cards inside it
            bx0 = min(b[0] for b in FRAME_BOXES); by0 = min(b[1] for b in FRAME_BOXES)
            bx1 = max(b[2] for b in FRAME_BOXES); by1 = max(b[3] for b in FRAME_BOXES)
            x0 = min(max(x0, bx1 - cw), bx0); y0 = min(max(y0, by1 - ch), by0)
            x0 = min(max(0, x0), W - cw); y0 = min(max(0, y0), H - ch)
            ok = x0 <= bx0 and x0 + cw >= bx1 and y0 <= by0 and y0 + ch >= by1
        else: ok = True
        return ok, x0, y0, cw, ch
    while z > 1.001:
        ok, x0, y0, cw, ch = fit(z)
        if ok: break
        z -= 0.01
    if z <= 1.001: return frame
    return frame.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch))).resize((W, H), Image.BILINEAR)

_legal = None
def draw_legal(frame, t):
    global _legal
    if t > float(BRAND.get('legal_line_seconds', 9999)): return
    if _legal is None:
        f = load_font(34); d0 = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
        bb = d0.textbbox((0, 0), LEGAL_LINE, font=f, stroke_width=4)
        _legal = Image.new('RGBA', (bb[2] - bb[0] + 10, bb[3] - bb[1] + 10), (0, 0, 0, 0))
        ImageDraw.Draw(_legal).text((5 - bb[0], 5 - bb[1]), LEGAL_LINE, font=f, fill=(255, 255, 255, 235),
                                    stroke_width=4, stroke_fill=(11, 16, 32, 220))
    a = 1.0 if t < 3.0 else 0.8                             # stays up the whole video (the spoken disclaimer is gone)
    im = _legal if a >= 1 else Image.fromarray((np.array(_legal) * np.array([1, 1, 1, a])).astype(np.uint8), 'RGBA')
    frame.alpha_composite(im, ((W - im.width) // 2, 24))

_handle = None
def draw_handle(frame, t):
    global _handle
    if not HANDLE or HANDLE_T is None: return
    hold = float(BRAND.get('handle_hold', 3.0)); age = t - HANDLE_T
    if age < 0 or age > hold + 0.4: return
    if _handle is None:
        f = load_font(46); d0 = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
        bb = d0.textbbox((0, 0), HANDLE, font=f)
        w, h = bb[2] - bb[0] + 64, bb[3] - bb[1] + 34
        _handle = Image.new('RGBA', (w + 8, h + 10), (0, 0, 0, 0)); d = ImageDraw.Draw(_handle)
        d.rounded_rectangle([4, 8, w + 4, h + 8], h // 2, fill=(0, 0, 0, 45))
        d.rounded_rectangle([0, 0, w, h], h // 2, fill=(*NAVY, 235))
        d.text((32 - bb[0], 17 - bb[1]), HANDLE, font=f, fill=(255, 255, 255, 255))
    a = 1.0 if age < hold else max(0.0, (hold + 0.4 - age) / 0.4)
    s_ = max(0.01, pop(age))
    im = _handle
    if s_ != 1: im = im.resize((max(1, round(im.width * s_)), max(1, round(im.height * s_))), Image.BILINEAR)
    if a < 1: im = Image.fromarray((np.array(im) * np.array([1, 1, 1, a])).astype(np.uint8), 'RGBA')
    frame.alpha_composite(im, ((W - im.width) // 2, HANDLE_Y - im.height // 2))

_share = None
def share_active(t): return SHARE_T0 is not None and SHARE_T0 <= t < SHARE_T1
_emoji_font, _emoji_cache = None, {}
def _emoji(ch):
    global _emoji_font
    if ch in _emoji_cache: return _emoji_cache[ch]
    if _emoji_font is None:
        for f, sz in (('/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', 109), ('/System/Library/Fonts/Apple Color Emoji.ttc', 160)):
            try: _emoji_font = ImageFont.truetype(f, sz); break
            except Exception: pass
        if _emoji_font is None: _emoji_font = False
    if not _emoji_font: _emoji_cache[ch] = None; return None
    im = Image.new('RGBA', (220, 220), (0, 0, 0, 0))
    try: ImageDraw.Draw(im).text((110, 110), ch, font=_emoji_font, embedded_color=True, anchor='mm')
    except Exception: _emoji_cache[ch] = None; return None
    bb = im.getbbox()
    im = im.crop(bb) if bb else im
    im = im.resize((170, round(im.height * 170 / max(1, im.width))), Image.LANCZOS)
    _emoji_cache[ch] = im
    return im
def draw_stickers(frame, t):
    for t0_, ch, side in STICKERS:
        a = t - t0_
        if a < 0 or a > 1.0: continue
        im = _emoji(ch)
        if im is None: return
        s_ = (a / 0.12) * 1.25 if a < 0.12 else (1.25 - 0.25 * min(1, (a - 0.12) / 0.1))
        if a > 0.85: s_ *= max(0.0, (1.0 - a) / 0.15)
        if s_ <= 0.03: continue
        rot = 12 * math.sin(a * 9) * (1 if side else -1)
        im2 = im.resize((max(1, round(im.width * s_)), max(1, round(im.height * s_))), Image.BILINEAR).rotate(rot, expand=True, resample=Image.BILINEAR)
        cx = W * (0.84 if side else 0.16)
        frame.alpha_composite(im2, (round(cx - im2.width / 2), round(CAP_Y_STICKER - im2.height / 2)))
CAP_Y_STICKER = 1245

def draw_share(frame, t):
    global _share
    if not share_active(t): return
    if _share is None:
        d0 = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
        for size, maxl in ((58, 2), (52, 2), (52, 3), (46, 3), (40, 4)):   # prefer 2 big lines, else 3 smaller
            f = load_font(size); lines, cur = [], ''
            for w_ in SHARE_LINE.upper().split():
                trial = (cur + ' ' + w_).strip()
                if cur and d0.textbbox((0, 0), trial, font=f)[2] > 900: lines.append(cur); cur = w_
                else: cur = trial
            lines.append(cur)
            if len(lines) <= maxl: break
        txt = '\n'.join(lines)
        bb = d0.multiline_textbbox((0, 0), txt, font=f, align='center', spacing=12)
        w, h = int(bb[2] - bb[0] + 90), int(bb[3] - bb[1] + 70)
        _share = Image.new('RGBA', (w + 16, h + 16), (0, 0, 0, 0)); d = ImageDraw.Draw(_share)
        d.rounded_rectangle([8, 14, w + 8, h + 14], 34, fill=(0, 0, 0, 40))
        d.rounded_rectangle([0, 0, w, h], 34, fill=(*RED, 255))
        d.rounded_rectangle([0, 0, w, h], 34, outline=NAVY, width=8)
        d.multiline_text((45 - bb[0], 30 - bb[1]), txt, font=f, fill=(255, 255, 255), align='center', spacing=12)
        if _share.width > 1000: _share = _share.resize((1000, round(_share.height * 1000 / _share.width)), Image.LANCZOS)
    age, left = t - SHARE_T0 - 0.2, SHARE_T1 - t          # pops in once the camera has started pulling back
    s_ = pop(age)
    if left < 0.15: s_ *= max(0.0, left / 0.15)
    if s_ <= 0.02: return
    im = _share
    if s_ != 1.0: im = im.resize((max(1, round(im.width * s_)), max(1, round(im.height * s_))), Image.BILINEAR)
    frame.alpha_composite(im, (round(W / 2 - im.width / 2), round(250 - im.height / 2)))

# ---------- captions: word pop + coloured keywords ----------
def write_ass(path):
    hl = {norm(x) for x in (plan or {}).get('highlight', [])}
    def ts(x):
        cs = int(round(x * 100)); return f'{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}'
    lines = ['[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 162', 'PlayResY: 288', 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
             '[V4+ Styles]',
             'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
             'Style: Cap,Arial Rounded MT Bold,16,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,4,0,2,5,5,90,1',
             '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
    for (a, b, wtxt), n_ in zip(words, wn):
        col = ''
        if n_ in HOT_RED or re.search(r'\d', wtxt): col = r'\c&H004639E6&'        # brand red
        elif n_ in HOT_YELLOW or n_ in hl: col = r'\c&H0000D7FF&'                 # yellow
        txt = wtxt.replace('{', '(').replace('}', ')')
        lines.append(f'Dialogue: 0,{ts(a)},{ts(b)},Cap,,0,0,0,,{{{col}\\fscx72\\fscy72\\t(0,90,\\fscx110\\fscy110)\\t(90,160,\\fscx100\\fscy100)}}{txt}')
    open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

# ---------- audio: voice + sound effects ----------
def mix_audio(path):
    pcm = subprocess.run([FFMPEG, '-loglevel', 'error', '-i', wav, '-f', 's16le', '-ac', '1', '-ar', str(SR_A), '-'], capture_output=True).stdout
    voice = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
    mix = voice.copy()
    for t0, name in SFX_EVENTS:
        x = sfx_audio(name) * SFX_GAIN.get(name, 0.3); i = int(t0 * SR_A)
        if i >= len(mix): continue
        mix[i:i + len(x)] += x[:len(mix) - i]
    k = 0.72                                                    # soft knee: loud sound-effect peaks get rounded off
    ax = np.abs(mix)                                            # (max ~0.88, leaving headroom for the music bed)
    mix = np.where(ax > k, np.sign(mix) * (k + 0.16 * np.tanh((ax - k) / 0.16)), mix).astype(np.float32)
    import wave
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR_A)
        wf.writeframes((mix * 32767).astype(np.int16).tobytes())

# ---------- 3D mode ----------
BG3D = {'white', 'bg-campsite', 'bg-yellowstone', 'bg-capitol', 'bg-courtroom', 'bg-prison', 'bg-shop', 'bg-office', 'bg-street', 'bg-neighborhood', 'bg-harbor'}
PROP3D = {'map-us', 'map-yellowstone', 'map-zone', 'prop-constitution', 'prop-gavel', 'prop-tumbleweed', 'sign', 'doc'}
CHAR3D = {'char-friend-chimp', 'char-judge', 'char-judge-confused', 'char-politician'}

def render_3d_base(nframes):
    """Write the resolved timeline and let the Three.js world render the picture (no captions, no sound)."""
    def items_3d(sc):
        board = [it for it in sc['items'] if 'id' in it and it.get('anim') != 'roll']
        out_ = []
        for j, it in enumerate(board):
            nxt = board[j + 1]['t'] if j + 1 < len(board) else sc['end']
            end = min(nxt, it['t'] + it['hold']) if it.get('hold') else nxt
            out_.append(dict({k: it[k] for k in ('icon', 'text', 'sub') if k in it}, id=it['id'], t=it['t'], end=end))
        for it in sc['items']:
            if 'id' in it and it.get('anim') == 'roll':
                out_.append({'id': it['id'], 't': it['t'], 'anim': 'roll', 'roll_time': it.get('roll_time', 2.0)})
        return out_
    tl = {'fps': FPS, 'dur': dur, 'frames': nframes,
          'mouth': [int(bool(MOUTH[i])) if i < len(MOUTH) else 0 for i in range(nframes)],
          'poses': auto_seg,
          'scenes': [{'t': sc['t'], 'end': min(sc['end'], dur + 1), 'bg': sc.get('bg', 'white'), 'loop': bool(sc.get('loop')),
                      'cast': [{k: v for k, v in c.items() if k in ('id', 'x', 'anim', 'from')} for c in sc.get('cast', [])],
                      'items': items_3d(sc), 'zooms': [{'t': z['t'], 'amount': z.get('amount', 1.18), 'hold': z.get('hold', 0.9)} for z in sc['zooms']]}
                     for sc in scenes],
          'share': None if SHARE_T0 is None else [SHARE_T0, SHARE_T1],   # camera pulls back to make room for the share card
          'shakes': [t_ for t_, n_ in SFX_EVENTS if n_ in ('vine', 'hit', 'boom', 'scratch', 'airhorn')],
          'tilts': TILTS}
    tl_path, base = os.path.abspath(out + '.timeline.json'), os.path.abspath(out + '.base3d.mp4')
    json.dump(tl, open(tl_path, 'w'))
    if os.environ.get('LLD_TIMELINE_ONLY'): raise SystemExit(0)
    node = next((p for p in ['/opt/homebrew/bin/node', '/usr/local/bin/node', shutil.which('node')] if p and os.path.exists(p)), 'node')
    r = subprocess.run([node, os.path.join(R3D_DIR, 'render3d.mjs'), tl_path, base], cwd=R3D_DIR,
                       env=dict(os.environ, FFMPEG=FFMPEG, PATH=os.environ.get('PATH', '') + ':/opt/homebrew/bin:/usr/local/bin'))
    if r.returncode != 0 or not os.path.exists(base): raise SystemExit('3D render failed')
    return base

CARD_Y, CARD_MAX_H = 255, 300          # cards sit in the sky band, above the cast's heads
def draw_cards_3d(frame, sc, t):
    if share_active(t): return                     # the share card owns the top band during the call to action
    cards = [it for it in sc['items'] if 'card' in it]
    for j, it in enumerate(cards):
        nxt = cards[j + 1]['t'] if j + 1 < len(cards) else sc['end']
        end = min(nxt, it['t'] + it['hold']) if it.get('hold') else nxt
        age, left = t - it['t'], end - t
        if age < 0 or left <= 0: continue
        im = make_card(it['card'])
        f = min(1.0, CARD_MAX_H / im.height)
        if f < 1: im = im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS)
        s_ = pop(age)
        if left < 0.15: s_ *= max(0.0, left / 0.15)
        if s_ <= 0.02: continue
        if s_ != 1.0: im = im.resize((max(1, round(im.width * s_)), max(1, round(im.height * s_))), Image.BILINEAR)
        frame.alpha_composite(im, (round(W / 2 - im.width / 2), round(CARD_Y - im.height / 2)))

# ---------- render ----------
MIN_SECONDS = float(BRAND.get('min_seconds', 0) or 0)
if MIN_SECONDS and dur < MIN_SECONDS:      # never post a short under the platform minimum we target
    print(json.dumps({'error': f'narration {dur:.1f}s is under min_seconds {MIN_SECONDS:.0f}s; not rendered', 'video': out}))
    raise SystemExit(3)
ass_path, mix_path = out + '.captions.ass', out + '.mix.wav'
write_ass(ass_path); mix_audio(mix_path)
vf = f"ass=filename='{ass_path}'"
cmd = [FFMPEG, '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
       '-i', 'pipe:0', '-i', mix_path, '-vf', vf, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
       '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-profile:v', 'high', '-r', str(FPS), '-shortest', '-movflags', '+faststart', out]
nframes = int(math.ceil(dur * FPS))
base3d = None
last3d = Image.new('RGB', (W, H), (0, 0, 0))
if RENDER3D:
    base3d = os.environ.get('LLD_BASE3D') or render_3d_base(nframes)   # LLD_BASE3D: reuse a rendered 3D pass (testing)
    dec = subprocess.Popen([FFMPEG, '-loglevel', 'error', '-i', base3d, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for fi in range(nframes):
    t = fi / FPS
    FRAME_BOXES.clear()
    sc = scene_at(t)
    if RENDER3D:
        raw = dec.stdout.read(W * H * 3)
        frame = (Image.frombytes('RGB', (W, H), raw) if len(raw) == W * H * 3 else last3d).convert('RGBA')
        last3d = frame
        draw_cards_3d(frame, sc, t)
    else:
        frame = background(sc, t)
        draw_cast(frame, sc, t)
        draw_items(frame, sc, t)
        frame = apply_zoom(frame, sc, t)
    draw_legal(frame, t)
    draw_share(frame, t)
    draw_stickers(frame, t)
    draw_handle(frame, t)
    proc.stdin.write(frame.convert('RGB').tobytes())
proc.stdin.close()
if proc.wait() != 0: raise SystemExit('ffmpeg failed')
if RENDER3D:
    dec.stdout.close(); dec.wait()
for p_ in (ass_path, mix_path) + ((base3d, base3d.replace('.base3d.mp4', '.timeline.json')) if base3d and not os.environ.get('LLD_KEEP') else ()):
    try: os.remove(p_)
    except OSError: pass

missing = set()
for sc in (scenes if RENDER3D else []):
    if sc.get('bg', 'white') not in BG3D: missing.add('3d-set/' + sc['bg'])
    for c in sc.get('cast', []):
        if not c['id'].startswith('larry') and c['id'] not in CHAR3D: missing.add('3d-char/' + c['id'])
    for it in sc['items']:
        if 'id' in it and it['id'] not in PROP3D: missing.add('3d-prop/' + it['id'])
for sc in ([] if RENDER3D else scenes):
    if sc.get('bg', 'white') != 'white' and sprite('bg', sc['bg']) is None: missing.add('bg/' + sc['bg'])
    for c in sc.get('cast', []):
        if c['id'].startswith('larry:') and c['id'] != 'larry:auto' and sprite('larry', c['id'][6:]) is None:
            missing.add('larry/larry-' + c['id'][6:])
        if not c['id'].startswith('larry') and sprite('char', c['id']) is None: missing.add('chars/' + c['id'])
    for it in sc['items']:
        if 'id' in it and sprite('prop', it['id'], H * it.get('h', 0.2), W * it.get('w', 0.8)) is None: missing.add('props/' + it['id'])
print(json.dumps({'video': out, 'renderer': '3d' if RENDER3D else '2d', 'seconds': round(dur, 2), 'plan': bool(plan), 'sfx': len(SFX_EVENTS),
                  'zooms': sum(len(s_['zooms']) for s_ in scenes),
                  'scenes': [[round(s['t'], 2), s.get('bg', 'white')] for s in scenes], 'missing_assets': sorted(missing) + ([] if HANDLE else ['brand.json handle']),
                  'handle_at': None if HANDLE_T is None else round(HANDLE_T, 2),
                  'share': None if SHARE_T0 is None else [round(SHARE_T0, 2), round(SHARE_T1, 2), SHARE_LINE]}))
