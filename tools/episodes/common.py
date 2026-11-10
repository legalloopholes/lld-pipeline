import re, json, datetime
EPS = []
START = datetime.date(2026, 11, 2)

def L(pose='auto', x=None, anim=None):
    d = {'id': f'larry:{pose}'}
    if x is not None: d['x'] = x
    if anim: d['anim'] = anim
    return d
def chimp(x=.68): return {'id': 'char-friend-chimp', 'x': x}
def judge(x=.7): return {'id': 'char-judge', 'x': x}
def judge_confused(x=.7): return {'id': 'char-judge-confused', 'x': x}
def politician(x=.7): return {'id': 'char-politician', 'x': x}
def sign(icon, text, at=None, **kw):
    d = {'id': 'sign', 'icon': icon, 'text': text}
    if at: d['at'] = at
    d.update(kw); return d
def doc(text, sub='', at=None):
    d = {'id': 'doc', 'text': text, 'sub': sub}
    if at: d['at'] = at
    return d
def prop(pid, at=None, **kw):
    d = {'id': pid}
    if at: d['at'] = at
    d.update(kw); return d
def card(text, at): return (text, at)
def zoom(at, amount=1.18, hold=0.9, sfx=None):
    d = {'at': at, 'amount': amount, 'hold': hold}
    if sfx: d['sfx'] = sfx
    return d
def sc(at, bg, cast=None, props=None, card=None, zooms=None, loop=False, sfx=None):
    d = {'at': at, 'bg': bg}
    if cast is not None: d['cast'] = cast
    if props: d['props'] = props
    if card: d['card'], d['card_at'] = card
    if zooms: d['zooms'] = zooms
    if loop: d['loop'] = True
    if sfx: d['sfx'] = sfx
    return d

DISCLAIMER = 'Quick disclaimer: this is not legal advice.'
CTA = 'Make sure to like and follow Legal Loopholes Daily for more loopholes like this.'
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
def spoken(script):
    """What make_voice.py will actually say: hook, disclaimer, body, CTA, loop line, hook start."""
    t = re.sub(r'\[pause[^\]]*\]', ' ', script)
    body, loop = re.split(r'\[loop\]', t, maxsplit=1) if '[loop]' in t else (t, 'But before you try anything, just remember')
    m = re.search(r'^(.*?[.?!])\s', body.strip() + ' ')
    hook = m.group(1); rest = body.strip()[len(hook):]
    return f'{hook} {DISCLAIMER} {rest} {CTA} {loop.strip()} {" ".join(hook.split()[:3])}', hook

def ep(eid, **k):
    n = int(eid[1:])
    k['eid'] = eid; k['video_id'] = f'LLD-{n:03d}'
    slot = n       # schedule started two slots late (Nov 2 noon and 7 pm missed)
    day = slot // 2; when = '12:00:00' if slot % 2 == 0 else '19:00:00'
    k['publish_at'] = f'{START + datetime.timedelta(days=day)}T{when}-05:00'
    EPS.append(k)

def validate(e):
    issues = []
    text, hook = spoken(e['script'])
    toks = [norm(w) for w in text.split() if norm(w)]
    words = len(toks)
    # ~3.07 spoken words/second measured on LLD-001 (am_puck 0.95, incl. pauses)
    est = words / 3.07
    if est < 63: issues.append(f'too short: {words} words ≈ {est:.0f}s')
    if est > 80: issues.append(f'long: {words} words ≈ {est:.0f}s')
    pos = 0
    def find(phrase, start):
        p = [norm(w) for w in phrase.split() if norm(w)]
        for i in range(start, len(toks) - len(p) + 1):
            if toks[i:i + len(p)] == p: return i
        return None
    for s in e['scenes']:
        phrases = [s['at']] + [p['at'] for p in s.get('props', []) if p.get('at')] + ([s['card_at']] if s.get('card_at') else []) + [z['at'] for z in s.get('zooms', [])]
        for j, ph in enumerate(phrases):
            if ph == 'start': continue
            if re.search(r'\d|-', ph): issues.append(f'risky phrase (digit/hyphen): {ph}')
            if re.search(r'\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|first|second|third|tenth|twentynine)\b', ph): issues.append(f'number word: {ph}')
            i = find(ph, pos if j == 0 else pos)
            if i is None: issues.append(f'phrase not found in order: {ph}')
            elif j == 0: pos = i
    for s in e['scenes']:
        if s.get('props') and any(not c['id'].startswith('larry') for c in s.get('cast', [])) and any(p['id'] in ('sign', 'doc') for p in s['props']):
            issues.append(f"board prop with another character: {s['at']}")
        for p in s.get('props', []):
            if p['id'] == 'sign' and len(p.get('text', '')) > 22: issues.append(f"sign text long: {p['text']}")
    if not e['scenes'][-1].get('loop'): issues.append('last scene not loop')
    if e['scenes'][-1]['bg'] != e['scenes'][0]['bg']: issues.append('loop bg differs from opening')
    if len(e['title']) > 95: issues.append('title long')
    return words, est, issues

def plan(e):
    return {'video_id': e['video_id'], 'episode': e['eid'], 'hook': e['hook_card'], 'highlight': e.get('highlight', []),
            'youtube_title': e['title'], 'caption': e['caption'], 'hashtags': e['hashtags'], 'script': e['script'],
            'publish_at': e['publish_at'], 'sources': e['sources'], 'legal_status': e['status'], 'scenes': e['scenes']}
