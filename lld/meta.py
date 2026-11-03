#!/usr/bin/env python3
"""Legal Loopholes Daily - Facebook Page + Instagram Reels publisher (Meta Graph API).

  meta.py setup                       one time: app secret + a token from Graph API Explorer (typed by you)
  meta.py check                       show the connected Page and Instagram account
  meta.py fb <video.mp4> <caption>    publish a Reel to the Facebook Page
  meta.py ig <video.mp4> <caption>    publish a Reel to Instagram
Keys/tokens: ~/.n8n-files/secrets/meta.json (readable only by you). The Page token does not expire.
"""
import sys, os, json, time, getpass, base64, subprocess, tempfile, shutil, urllib.request, urllib.parse, urllib.error

CFG = os.path.expanduser('~/.n8n-files/secrets/meta.json')
V = 'v23.0'
G = f'https://graph.facebook.com/{V}'
APP_ID = '3001046986910228'


def load(): return json.load(open(CFG)) if os.path.exists(CFG) else {}


def save(c):
    os.makedirs(os.path.dirname(CFG), exist_ok=True)
    with open(CFG, 'w') as f: json.dump(c, f, indent=1)
    os.chmod(CFG, 0o600)


def call(method, url, params=None, data=None, headers=None):
    if params: url += ('&' if '?' in url else '?') + urllib.parse.urlencode(params)
    if isinstance(data, dict): data = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=900) as r: body = r.read()
    except urllib.error.HTTPError as e:
        body = e.read()
    try: return json.loads(body or b'{}')
    except ValueError: return {'raw': body.decode('utf-8', 'replace')[:500]}


def need(r, what):
    if 'error' in r: raise SystemExit(f'{what} ERROR: ' + json.dumps(r['error']))
    return r


def setup():
    c = load()
    c['app_id'] = input(f"App ID [{c.get('app_id', APP_ID)}]: ").strip() or c.get('app_id', APP_ID)
    s = getpass.getpass('App secret (hidden)' + (' [keep current]' if c.get('app_secret') else '') + ': ').strip()
    if s: c['app_secret'] = s
    short = getpass.getpass('User access token from Graph API Explorer (hidden): ').strip()
    r = need(call('GET', f'{G}/oauth/access_token', {'grant_type': 'fb_exchange_token', 'client_id': c['app_id'],
                                                     'client_secret': c['app_secret'], 'fb_exchange_token': short}), 'TOKEN')
    c['user_token'] = r['access_token']
    pages = need(call('GET', f'{G}/me/accounts', {'fields': 'id,name,access_token,instagram_business_account{id,username}',
                                                  'access_token': c['user_token']}), 'PAGES').get('data', [])
    if not pages: raise SystemExit('No Facebook Pages found. Make sure you ticked the Legal Loopholes Daily Page when approving.')
    for i, p in enumerate(pages): print(f"  {i + 1}. {p['name']}  (Instagram: {(p.get('instagram_business_account') or {}).get('username', 'not linked')})")
    pick = pages[0] if len(pages) == 1 else pages[int(input('Which Page number? ').strip()) - 1]
    c.update(page_id=pick['id'], page_name=pick['name'], page_token=pick['access_token'],
             ig_id=(pick.get('instagram_business_account') or {}).get('id'),
             ig_username=(pick.get('instagram_business_account') or {}).get('username'))
    save(c)
    print('Saved.'); check()


def check():
    c = load()
    if not c.get('page_token'): raise SystemExit('Not connected yet. Run: meta.py setup')
    p = call('GET', f"{G}/{c['page_id']}", {'fields': 'name', 'access_token': c['page_token']})
    ig = call('GET', f"{G}/{c['ig_id']}", {'fields': 'username', 'access_token': c['page_token']}) if c.get('ig_id') else {}
    print(json.dumps({'facebook_page': p.get('name', p), 'instagram': ig.get('username', ig or 'not linked')}))


def upload(url, path, token):
    size = os.path.getsize(path)
    with open(path, 'rb') as f: blob = f.read()
    return call('POST', url, data=blob, headers={'Authorization': 'OAuth ' + token, 'offset': '0',
                                                   'file_size': str(size), 'Content-Type': 'application/octet-stream'})


def fb(path, caption):
    c = load(); tok, pid = c['page_token'], c['page_id']
    s = need(call('POST', f'{G}/{pid}/video_reels', data={'upload_phase': 'start', 'access_token': tok}), 'FB START')
    vid = s['video_id']
    u = upload(s.get('upload_url') or f'https://rupload.facebook.com/video-upload/{V}/{vid}', path, tok)
    if not u.get('success'): raise SystemExit('FB UPLOAD ERROR: ' + json.dumps(u))
    need(call('POST', f'{G}/{pid}/video_reels', data={'upload_phase': 'finish', 'video_id': vid, 'video_state': 'PUBLISHED',
                                                      'description': caption, 'access_token': tok}), 'FB FINISH')
    st = {}
    for _ in range(60):
        time.sleep(5)
        st = call('GET', f'{G}/{vid}', {'fields': 'status,permalink_url', 'access_token': tok})
        vs = (st.get('status') or {}).get('video_status')
        if vs in ('ready', 'error'): break
    c2 = load(); c2.setdefault('fb_videos', {})[os.path.basename(path)] = vid; save(c2)
    out = {'video_id': vid, 'status': (st.get('status') or {}).get('video_status'),
           'url': 'https://www.facebook.com' + st['permalink_url'] if str(st.get('permalink_url', '')).startswith('/') else st.get('permalink_url')}
    print(json.dumps(out))
    if out['status'] == 'error': sys.exit(1)


def ig_once(path, caption):
    c = load(); tok, ig_id = c['page_token'], c.get('ig_id')
    if not ig_id: raise SystemExit('No Instagram account linked to the Page.')
    size = os.path.getsize(path)
    with open(path, 'rb') as f: blob = f.read()
    errors = []
    # variant 1 = exactly as Meta documents it; variant 2 = same with an explicit binary content type
    for ctype in (None, 'application/octet-stream'):
        m = call('POST', f'{G}/{ig_id}/media', params={'upload_type': 'resumable'},
                 data=json.dumps({'media_type': 'REELS', 'caption': caption}).encode(),
                 headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok})
        if 'id' not in m: errors.append({'container': m}); continue
        cid = m['id']
        h = {'Authorization': 'OAuth ' + tok, 'offset': '0', 'file_size': str(size)}
        if ctype: h['Content-Type'] = ctype
        u = call('POST', m.get('uri') or f'https://rupload.facebook.com/ig-api-upload/{V}/{cid}', data=blob, headers=h)
        if not u.get('success'):
            st = call('GET', f'{G}/{cid}', {'fields': 'status_code,status,video_status', 'access_token': tok})
            errors.append({'upload': u, 'container_status': st}); continue
        st = {}
        for _ in range(72):                                   # up to 6 minutes of processing
            time.sleep(5)
            st = call('GET', f'{G}/{cid}', {'fields': 'status_code,status', 'access_token': tok})
            if st.get('status_code') in ('FINISHED', 'ERROR', 'EXPIRED'): break
        if st.get('status_code') != 'FINISHED':
            errors.append({'processing': st}); continue
        pub = need(call('POST', f'{G}/{ig_id}/media_publish', data={'creation_id': cid, 'access_token': tok}), 'IG PUBLISH')
        link = call('GET', f"{G}/{pub['id']}", {'fields': 'permalink', 'access_token': tok})
        print(json.dumps({'media_id': pub['id'], 'status': 'PUBLISHED', 'url': link.get('permalink')}))
        return
    # fallback: Meta's direct upload is failing -> let Instagram fetch the copy already on our Facebook Page
    fb_vid = (c.get('fb_videos') or {}).get(os.path.basename(path))
    if fb_vid:
        src = call('GET', f'{G}/{fb_vid}', {'fields': 'source', 'access_token': tok}).get('source')
        if src:
            m = call('POST', f'{G}/{ig_id}/media', data={'media_type': 'REELS', 'video_url': src, 'caption': caption,
                                                         'share_to_feed': 'true', 'access_token': tok})
            if 'id' in m:
                cid, st = m['id'], {}
                for _ in range(72):
                    time.sleep(5)
                    st = call('GET', f'{G}/{cid}', {'fields': 'status_code,status', 'access_token': tok})
                    if st.get('status_code') in ('FINISHED', 'ERROR', 'EXPIRED'): break
                if st.get('status_code') == 'FINISHED':
                    pub = need(call('POST', f'{G}/{ig_id}/media_publish', data={'creation_id': cid, 'access_token': tok}), 'IG PUBLISH')
                    link = call('GET', f"{G}/{pub['id']}", {'fields': 'permalink', 'access_token': tok})
                    print(json.dumps({'media_id': pub['id'], 'status': 'PUBLISHED', 'url': link.get('permalink'), 'via': 'facebook copy'}))
                    return
                errors.append({'fb_copy_processing': st})
            else: errors.append({'fb_copy_container': m})
        else: errors.append({'fb_copy': 'no source url'})
    raise SystemExit('IG ERROR: ' + json.dumps(errors)[:1500])


GH = os.path.expanduser('~/.n8n-files/secrets/github.json')
MEDIA_REPO, MEDIA_URL = 'legalloopholes/lld-media', 'https://legalloopholes.github.io/lld-media/'


def github_setup():
    tok = getpass.getpass('GitHub token for lld-media (hidden): ').strip()
    os.makedirs(os.path.dirname(GH), exist_ok=True)
    with open(GH, 'w') as f: json.dump({'token': tok}, f)
    os.chmod(GH, 0o600); print('Saved.')


def host_video(path):
    """publish the video at a public link: lld-media keeps only the current video (one commit, force-pushed)"""
    tok = json.load(open(GH))['token']
    name = os.path.basename(path)
    d = tempfile.mkdtemp()
    try:
        shutil.copy(path, os.path.join(d, name))
        open(os.path.join(d, 'index.html'), 'w').write('Legal Loopholes Daily media\n')
        auth = base64.b64encode(f'x-access-token:{tok}'.encode()).decode()
        git = lambda *a: subprocess.run(['git', '-C', d, *a], check=True, capture_output=True, text=True)
        git('init', '-q', '-b', 'main'); git('add', '.')
        git('-c', 'user.name=LLD bot', '-c', 'user.email=bot@legalloopholes.invalid', 'commit', '-q', '-m', name)
        git('-c', f'http.extraHeader=Authorization: Basic {auth}', 'push', '-q', '--force',
            f'https://github.com/{MEDIA_REPO}.git', 'main')
    except subprocess.CalledProcessError as e:
        raise SystemExit('GITHUB PUSH ERROR: ' + (e.stderr or '')[:400].replace(tok, '***'))
    finally:
        shutil.rmtree(d, ignore_errors=True)
    url, size = MEDIA_URL + name, os.path.getsize(path)
    for _ in range(60):                                       # wait for GitHub Pages to publish it (usually ~1 min)
        time.sleep(10)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=30) as r:
                if r.status == 200 and int(r.headers.get('Content-Length', 0)) == size: return url
        except Exception: pass
    raise SystemExit('GITHUB PAGES TIMEOUT: ' + url)


def ig_url(url, caption):
    """publish a Reel that Instagram fetches from a public link (reliable when direct upload is failing)"""
    c = load(); tok, ig_id = c['page_token'], c['ig_id']
    m = need(call('POST', f'{G}/{ig_id}/media', data={'media_type': 'REELS', 'video_url': url, 'caption': caption,
                                                      'share_to_feed': 'true', 'access_token': tok}), 'IG CONTAINER')
    st = {}
    for _ in range(72):
        time.sleep(5)
        st = call('GET', f"{G}/{m['id']}", {'fields': 'status_code,status', 'access_token': tok})
        if st.get('status_code') in ('FINISHED', 'ERROR', 'EXPIRED'): break
    if st.get('status_code') != 'FINISHED': raise SystemExit('IG PROCESSING ERROR: ' + json.dumps(st))
    pub = need(call('POST', f'{G}/{ig_id}/media_publish', data={'creation_id': m['id'], 'access_token': tok}), 'IG PUBLISH')
    link = call('GET', f"{G}/{pub['id']}", {'fields': 'permalink', 'access_token': tok})
    print(json.dumps({'media_id': pub['id'], 'status': 'PUBLISHED', 'url': link.get('permalink')}))


def ig(path, caption):
    # Meta's Instagram upload fails intermittently; retry a few times before giving up
    last = None
    for wait in (0, 120, 300, 600):
        if wait: print(f'Instagram failed, retrying in {wait // 60} min...', file=sys.stderr); time.sleep(wait)
        try:
            if os.path.exists(GH): return ig_url(host_video(path), caption)
            return ig_once(path, caption)
        except SystemExit as e: last = e
    raise last


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) >= 3 and a[2].startswith('b64:'):          # caption passed safely from n8n
        a = a[:2] + [base64.b64decode(a[2][4:]).decode('utf-8')]
    if a[:1] == ['setup']: setup()
    elif a[:1] == ['check']: check()
    elif a[:1] == ['fb'] and len(a) >= 3: fb(a[1], ' '.join(a[2:]))
    elif a[:1] == ['ig'] and len(a) >= 3: ig(a[1], ' '.join(a[2:]))
    elif a[:1] == ['ig_url'] and len(a) >= 3: ig_url(a[1], ' '.join(a[2:]))
    elif a[:1] == ['github_setup']: github_setup()
    elif a[:1] == ['host'] and len(a) >= 2: print(host_video(a[1]))
    else: print(__doc__)
