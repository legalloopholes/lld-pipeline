"""Build story-format episodes from a compact markup.
Usage: python3 tools/episodes/story.py tools/episodes/batch1.py [--write]   (dry run without --write)
Batch file defines E = {n: markup}. Markup: hook [disclaimer] body [loop] loop-line, with scene markers
{bg; cast; sign} placed before the sentence where a new shot starts.
  bg   : studio courtroom office shop street neighborhood harbor capitol campsite prison yellowstone
  cast : comma list. L:<pose> (Larry: explaining concerned pointing smug surprised thinking sneaky)
         C:<face>.<gest> chimp, J:<face>.<gest> gorilla/judge, P:<face>.<gest> orangutan/official
         faces: neutral surprised smug worried angry ; gestures: none explain point think shrug arms_up wave scratch
  sign : "<emoji> TEXT" (Larry alone only, text <= 22 chars)
"""
import json, re, sys, importlib.util
import os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common
from names import N, O
common.DISCLAIMER = ''
SC = os.path.join(HERE, '..', '..', 'scenes')
RATE = 3.55
BG = {'studio': 'white', 'courtroom': 'bg-courtroom', 'office': 'bg-office', 'shop': 'bg-shop', 'street': 'bg-street',
      'neighborhood': 'bg-neighborhood', 'harbor': 'bg-harbor', 'capitol': 'bg-capitol', 'campsite': 'bg-campsite',
      'prison': 'bg-prison', 'yellowstone': 'bg-yellowstone'}
CID = {'C': 'char-friend-chimp', 'J': 'char-judge', 'P': 'char-politician'}
FACES = {'neutral', 'surprised', 'smug', 'worried', 'angry'}
GESTS = {'none', 'explain', 'point', 'think', 'shrug', 'arms_up', 'wave', 'scratch'}
LPOSE = {'explaining', 'concerned', 'pointing', 'smug', 'surprised', 'thinking', 'sneaky', 'auto'}
NUMW = set('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion first second third'.split())
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())


def cast_of(spec, n, si=0):
    toks = [t.strip() for t in spec.split(',') if t.strip()]
    xs = {1: [None], 2: [0.3, 0.7], 3: [0.2, 0.5, 0.8]}[len(toks)] if toks else []
    out = []
    for t, x in zip(toks, xs):
        who, _, pose = t.partition(':')
        if who == 'L':
            pose = pose or 'auto'
            assert pose in LPOSE, (n, pose)
            c = {'id': f'larry:{pose}'}
        else:
            face, _, gest = pose.partition('.')
            face, gest = face or 'neutral', gest or 'none'
            assert who in CID and face in FACES and gest in GESTS, (n, t)
            c = {'id': CID[who], 'face': face, 'gest': gest}
            dc, dp = N.get(n, ('', ''))
            nm = O.get(n, {}).get(si, {}).get(who) or {'C': dc, 'P': dp, 'J': 'JUDGE'}[who]
            if nm: c['name'] = nm
        if x is None and who != 'L': x = 0.5
        if x is not None: c['x'] = x
        out.append(c)
    return out


def anchor(text):
    ws = [w for w in text.split() if norm(w)]
    bad = lambda w: norm(w) in NUMW or re.search(r'\d', w) or '-' in w
    run = []
    for w in ws:
        if bad(w):
            if len(run) >= 2: break
            run = []; continue
        run.append(w)
        if len(run) == 4: break
    a = [re.sub(r"[^\w']", '', w).lower() for w in run]
    assert len(a) >= 2, ('weak anchor', text[:40])
    return ' '.join(a)


def build(n, markup):
    d = json.load(open(f'{SC}/LLD-{n:03d}.json'))
    hook, rest = markup.split('[disclaimer]', 1)
    body, loop = rest.split('[loop]', 1)
    parts = re.split(r'(\{[^}]*\})', body)
    scenes, text, pending = [], [], None
    for p in parts:
        if p.startswith('{'):
            pending = [x.strip() for x in p[1:-1].split(';')]
            continue
        if pending is not None:
            bg, cspec, sign = (pending + ['', '', ''])[:3]
            assert bg in BG, (n, bg)
            cast = cast_of(cspec, n, len(scenes))
            if bg == 'courtroom' and any(c['id'] == 'char-judge' for c in cast):
                xs = iter([0.2, 0.53])                      # the judge stands at the bench on the right
                for c in cast:
                    if c['id'] != 'char-judge': c['x'] = next(xs)
            sc = {'at': anchor(p) if scenes else 'start', 'bg': BG[bg], 'cast': cast}
            if sign:
                icon, _, stext = sign.partition(' ')
                assert len(stext) <= 22, (n, stext)
                assert all(c['id'].startswith('larry') for c in cast), (n, 'sign with other character', sign)
                sc['props'] = [{'id': 'sign', 'icon': icon, 'text': stext}]
            scenes.append(sc); pending = None
        text.append(p)
    body_txt = re.sub(r'\s+', ' ', ''.join(text)).strip()
    first = dict(scenes[0])
    if first['at'] == 'start':                     # the opening shot covers the hook
        pass
    scenes.append({'at': 'send this to', 'bg': 'white', 'cast': [{'id': 'larry:pointing'}]})
    loop_line = loop.strip()
    scenes.append({'at': anchor(loop_line), 'bg': scenes[0]['bg'], 'cast': [dict(c) for c in scenes[0]['cast']], 'loop': True,
                   **({'props': scenes[0]['props']} if scenes[0].get('props') else {})})
    d['script'] = hook.strip() + ' [disclaimer] ' + body_txt + ' [loop] ' + loop_line
    d['scenes'] = scenes
    d['story_format'] = True
    return d


if __name__ == '__main__':
    spec = importlib.util.spec_from_file_location('b', sys.argv[1]); b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
    for n, markup in b.E.items():
        d = build(n, markup)
        common.CTA = (d.get('share_line') or 'x').rstrip('.') + '.'
        w, est, iss = common.validate({'script': d['script'].replace('[disclaimer]', ''), 'scenes': d['scenes'], 'title': 'x'})
        iss = [i for i in iss if not i.startswith(('too short', 'long', 'number word', 'loop bg'))]
        est = w / RATE
        print(n, w, 'words', round(est), 's', len(d['scenes']), 'scenes', iss, 'SHORT' if est < 61 else '')
        if '--write' in sys.argv and not iss and est >= 61:
            json.dump(d, open(f'{SC}/LLD-{n:03d}.json', 'w'), ensure_ascii=False, indent=1)
