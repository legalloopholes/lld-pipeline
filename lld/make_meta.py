#!/usr/bin/env python3
"""Legal Loopholes Daily - post text (title, caption, hashtags) for one episode.
Usage: make_meta.py <VIDEO-ID> [script_base64]
Uses "youtube_title", "caption" and "hashtags" from scenes/<VIDEO-ID>.json when present (written with the monthly
batch); anything missing is built from the plan's hook/highlight words and the script's first sentence.
Prints JSON: {title, caption, hashtags, description, tiktok_caption}
"""
import sys, os, re, json, base64

ROOT = os.path.expanduser('~/.n8n-files')
vid = sys.argv[1]
script = ''
if len(sys.argv) > 2:
    try: script = base64.b64decode(sys.argv[2]).decode('utf-8')
    except Exception: script = ''
plan = {}
p = os.path.join(ROOT, 'scenes', f'{vid}.json')
if os.path.exists(p):
    try: plan = json.load(open(p))
    except Exception: plan = {}

BASE_TAGS = ['#legalloopholes', '#law', '#lawtok', '#legalfacts']
try: BRAND = json.load(open(os.path.join(ROOT, 'assets', 'brand.json')))
except Exception: BRAND = {}
TIKTOK_ALWAYS = BRAND.get('tiktok_hashtags', ['#fyp', '#foryou', '#viral', '#learnontiktok'])
YOUTUBE_ALWAYS = BRAND.get('youtube_hashtags', ['#shorts', '#viral'])


def add(base, more):
    have = {t.lower() for t in base.split()}
    return ' '.join(base.split() + [t for t in more if t.lower() not in have])
SMALL = {'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'to', 'for', 'at', 'by', 'with', 'vs'}


def clean(t):
    t = re.sub(r'\[(pause[^\]]*|cut|disclaimer)\]', ' ', t, flags=re.I)
    t = re.split(r'\[loop\]', t, flags=re.I)[0]
    return ' '.join(t.split())


def title_case(s):
    w = s.lower().split()
    out = []
    for i, x in enumerate(w):
        if x in ('u.s.', 'us') and i: out.append('U.S.')
        elif i and x in SMALL: out.append(x)
        else: out.append(x[:1].upper() + x[1:])
    return ' '.join(out)


body = clean(script)
m = re.search(r'^(.+?[.?!])(\s|$)', body)
hook_line = m.group(1).strip() if m else body[:150]

title = (plan.get('youtube_title') or '').strip()
if not title:
    base = plan.get('hook') or hook_line or vid
    title = title_case(base.rstrip('.!?')) if base.isupper() else base.rstrip('.')
title = title[:95]

caption = (plan.get('caption') or '').strip() or (hook_line + ' Here\'s the loophole.' if hook_line else title)

tags = plan.get('hashtags')
if isinstance(tags, str): tags = tags.split()
if not tags:
    extra = ['#' + re.sub(r'[^a-z0-9]', '', h.lower()) for h in plan.get('highlight', [])]
    tags = BASE_TAGS + [t for t in extra if len(t) > 2]
tags = [t if t.startswith('#') else '#' + t for t in tags]
seen, uniq = set(), []
for t in tags:
    if t.lower() not in seen: seen.add(t.lower()); uniq.append(t)
tags = uniq[:8]
hashtags = ' '.join(tags)

description = '\n\n'.join([caption, add(hashtags, YOUTUBE_ALWAYS), 'Not legal advice. For education and entertainment only.',
                           'Follow @legalloopholesdaily for more.'])
tiktok_caption = (caption + ' ' + add(hashtags, TIKTOK_ALWAYS))[:2200]
print(json.dumps({'title': title, 'caption': caption, 'hashtags': hashtags,
                  'description': description, 'tiktok_caption': tiktok_caption}))
