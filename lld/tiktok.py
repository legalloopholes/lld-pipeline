#!/usr/bin/env python3
"""Legal Loopholes Daily - TikTok publisher (Content Posting API, Direct Post, FILE_UPLOAD).

  tiktok.py setup                      one time: store app keys (typed by you), log in, save tokens
  tiktok.py post <video.mp4> <caption> publish a video; prints JSON with publish_id and final status
  tiktok.py draft <video.mp4>         send a video to the TikTok app's inbox as a draft (you tap Post in the app)
  tiktok.py check                      refresh the token and show which account is connected

Keys and tokens live in ~/.n8n-files/secrets/tiktok.json (readable only by you).
"privacy" in that file is SELF_ONLY until TikTok approves the app; then set it to PUBLIC_TO_EVERYONE.
"""
import sys, os, json, time, secrets, getpass, subprocess, urllib.request, urllib.parse, urllib.error

CFG = os.path.expanduser('~/.n8n-files/secrets/tiktok.json')
REDIRECT = 'https://legalloopholes.github.io/lld-site/callback/'
SCOPES = 'user.info.basic,video.upload,video.publish'
API = 'https://open.tiktokapis.com/v2'


def load():
    return json.load(open(CFG)) if os.path.exists(CFG) else {}


def save(c):
    os.makedirs(os.path.dirname(CFG), exist_ok=True)
    with open(CFG, 'w') as f: json.dump(c, f, indent=1)
    os.chmod(CFG, 0o600)


def http(method, url, data=None, headers=None, form=False):
    h = dict(headers or {})
    if data is not None and not isinstance(data, bytes):
        if form:
            data = urllib.parse.urlencode(data).encode(); h['Content-Type'] = 'application/x-www-form-urlencoded'
        else:
            data = json.dumps(data).encode(); h['Content-Type'] = 'application/json; charset=UTF-8'
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            body = r.read()
    except urllib.error.HTTPError as e:
        body = e.read()
    try: return json.loads(body or b'{}')
    except ValueError: return {'raw': body.decode('utf-8', 'replace')[:500]}


def token_call(c, extra):
    r = http('POST', f'{API}/oauth/token/', dict(client_key=c['client_key'], client_secret=c['client_secret'], **extra),
             headers={'Cache-Control': 'no-cache'}, form=True)
    r = r.get('data', r) if 'access_token' not in r else r
    if 'access_token' not in r:
        raise SystemExit('TOKEN ERROR: ' + json.dumps(r))
    c.update(access_token=r['access_token'], refresh_token=r['refresh_token'], open_id=r.get('open_id'),
             scope=r.get('scope'), expires_at=time.time() + int(r.get('expires_in', 86400)) - 300,
             refresh_expires_at=time.time() + int(r.get('refresh_expires_in', 31536000)))
    save(c)
    return c


def fresh(c):
    if not c.get('refresh_token'):
        raise SystemExit('Not connected yet. Run: tiktok.py setup')
    if time.time() > c.get('expires_at', 0):
        c = token_call(c, {'grant_type': 'refresh_token', 'refresh_token': c['refresh_token']})
    return c


def auth(c):
    return {'Authorization': 'Bearer ' + c['access_token']}


def setup():
    c = load()
    print('Paste the values from TikTok for Developers -> your app -> Sandbox (or Production) -> Credentials.')
    k = input(f"Client key{' [keep current]' if c.get('client_key') else ''}: ").strip()
    if k: c['client_key'] = k
    s = getpass.getpass(f"Client secret (hidden as you type){' [keep current]' if c.get('client_secret') else ''}: ").strip()
    if s: c['client_secret'] = s
    c.setdefault('privacy', 'SELF_ONLY')
    save(c)
    state = secrets.token_urlsafe(16)
    url = 'https://www.tiktok.com/v2/auth/authorize/?' + urllib.parse.urlencode(dict(
        client_key=c['client_key'], scope=SCOPES, response_type='code', redirect_uri=REDIRECT, state=state))
    print('\nOpening TikTok in your browser. Log in as legalloopholesdaily and click Authorize.')
    print('If nothing opens, paste this link into your browser:\n' + url + '\n')
    subprocess.run(['open', url])
    code = input('Paste the code shown on the "Authorization code" page: ').strip()
    c = token_call(c, {'grant_type': 'authorization_code', 'code': code, 'redirect_uri': REDIRECT})
    print('Connected. Scopes:', c.get('scope'))
    check()


def check():
    c = fresh(load())
    r = http('GET', f'{API}/user/info/?fields=open_id,display_name', headers=auth(c))
    print(json.dumps({'account': r.get('data', {}).get('user', r), 'scope': c.get('scope'), 'privacy': c.get('privacy')}))


def post(video, caption):
    c = fresh(load())
    info = http('POST', f'{API}/post/publish/creator_info/query/', {}, headers=auth(c))
    d = info.get('data') or {}
    if info.get('error', {}).get('code') not in (None, 'ok'):
        raise SystemExit('CREATOR INFO ERROR: ' + json.dumps(info))
    opts = d.get('privacy_level_options') or []
    privacy = c.get('privacy', 'SELF_ONLY')
    if opts and privacy not in opts:
        privacy = 'SELF_ONLY' if 'SELF_ONLY' in opts else opts[0]
    size = os.path.getsize(video)
    if size > 64 * 1024 * 1024:
        raise SystemExit('Video is over 64 MB; chunked upload not set up.')
    init = http('POST', f'{API}/post/publish/video/init/', {
        'post_info': {'title': caption[:2200], 'privacy_level': privacy,
                      'disable_duet': bool(d.get('duet_disabled')), 'disable_stitch': bool(d.get('stitch_disabled')),
                      'disable_comment': bool(d.get('comment_disabled')), 'video_cover_timestamp_ms': 1000},
        'source_info': {'source': 'FILE_UPLOAD', 'video_size': size, 'chunk_size': size, 'total_chunk_count': 1}},
        headers=auth(c))
    if init.get('error', {}).get('code') not in (None, 'ok'):
        raise SystemExit('INIT ERROR: ' + json.dumps(init))
    pid, up = init['data']['publish_id'], init['data']['upload_url']
    with open(video, 'rb') as f: blob = f.read()
    req = urllib.request.Request(up, data=blob, method='PUT', headers={
        'Content-Type': 'video/mp4', 'Content-Length': str(size), 'Content-Range': f'bytes 0-{size - 1}/{size}'})
    try:
        with urllib.request.urlopen(req, timeout=900) as r: r.read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f'UPLOAD ERROR {e.code}: ' + e.read().decode('utf-8', 'replace')[:500])
    status = {}
    for _ in range(60):                                   # up to ~5 minutes
        time.sleep(5)
        status = http('POST', f'{API}/post/publish/status/fetch/', {'publish_id': pid}, headers=auth(c))
        st = (status.get('data') or {}).get('status')
        if st in ('PUBLISH_COMPLETE', 'FAILED'): break
    out = {'publish_id': pid, 'privacy': privacy, 'status': (status.get('data') or {}).get('status'),
           'fail_reason': (status.get('data') or {}).get('fail_reason'),
           'post_ids': (status.get('data') or {}).get('publicaly_available_post_id')}
    print(json.dumps(out))
    if out['status'] != 'PUBLISH_COMPLETE':
        sys.exit(1)


def draft(video):
    c = fresh(load())
    size = os.path.getsize(video)
    if size > 64 * 1024 * 1024:
        raise SystemExit('Video is over 64 MB; chunked upload not set up.')
    with open(video, 'rb') as f: blob = f.read()
    out = {}
    for attempt in range(4):                              # TikTok's upload server sometimes answers 500 (2026-11-11): start over
        if attempt: time.sleep(30 * attempt); print(f'retrying TikTok upload ({attempt}): {out}', file=sys.stderr, flush=True)
        init = http('POST', f'{API}/post/publish/inbox/video/init/',
                    {'source_info': {'source': 'FILE_UPLOAD', 'video_size': size, 'chunk_size': size, 'total_chunk_count': 1}},
                    headers=auth(c))
        if init.get('error', {}).get('code') not in (None, 'ok'):
            out = {'error': 'INIT ERROR', 'detail': init}; continue
        pid, up = init['data']['publish_id'], init['data']['upload_url']
        req = urllib.request.Request(up, data=blob, method='PUT', headers={
            'Content-Type': 'video/mp4', 'Content-Length': str(size), 'Content-Range': f'bytes 0-{size - 1}/{size}'})
        try:
            with urllib.request.urlopen(req, timeout=900) as r: r.read()
        except Exception as e:
            out = {'publish_id': pid, 'error': f'UPLOAD ERROR {getattr(e, "code", "")}', 'detail': (e.read().decode('utf-8', 'replace')[:300] if hasattr(e, 'read') else str(e))}
            continue
        status = {}
        for _ in range(60):
            time.sleep(5)
            status = http('POST', f'{API}/post/publish/status/fetch/', {'publish_id': pid}, headers=auth(c))
            st = (status.get('data') or {}).get('status')
            if st in ('SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE', 'FAILED'): break
        out = {'publish_id': pid, 'status': (status.get('data') or {}).get('status'),
               'fail_reason': (status.get('data') or {}).get('fail_reason')}
        if out['status'] in ('SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE'): break
    print(json.dumps(out))
    if out['status'] not in ('SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE'):
        sys.exit(1)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'setup': setup()
    elif cmd == 'check': check()
    elif cmd == 'draft' and len(sys.argv) >= 3: draft(sys.argv[2])
    elif cmd == 'post' and len(sys.argv) >= 4: post(sys.argv[2], ' '.join(sys.argv[3:]))
    else: print(__doc__)
