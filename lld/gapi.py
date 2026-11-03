"""Legal Loopholes Daily - Google Sheets + YouTube calls for the GitHub Actions pipeline.
Credentials (from the n8n OAuth credentials, copied by setup.sh into GitHub Secrets):
  ~/.n8n-files/secrets/google_sheets.json  {"client_id", "client_secret", "refresh_token"}
  ~/.n8n-files/secrets/youtube.json        {"client_id", "client_secret", "refresh_token"}
"""
import os, json, time, urllib.request, urllib.parse, urllib.error

SECRETS = os.path.expanduser('~/.n8n-files/secrets')
SHEET_ID = '1e3mE3OlH--y6rYi_O_MEfBt8rRu2ywdmnOQRjJkTVCk'
TAB = 'Content Pipeline'
_tokens = {}


def _req(method, url, data=None, headers=None, raw=False, timeout=120):
    if isinstance(data, (dict, list)):
        data = json.dumps(data).encode(); headers = dict(headers or {}, **{'Content-Type': 'application/json'})
    r = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            body = resp.read(); return (resp, body) if raw else json.loads(body or b'{}')
    except urllib.error.HTTPError as e:
        raise SystemExit(f'GOOGLE {method} {url.split("?")[0]} -> {e.code}: ' + e.read().decode('utf-8', 'replace')[:500])


def token(name):
    if name in _tokens and _tokens[name][1] > time.time(): return _tokens[name][0]
    c = json.load(open(os.path.join(SECRETS, name + '.json')))
    body = urllib.parse.urlencode({'client_id': c['client_id'], 'client_secret': c['client_secret'],
                                   'refresh_token': c['refresh_token'], 'grant_type': 'refresh_token'}).encode()
    r = _req('POST', 'https://oauth2.googleapis.com/token', body, {'Content-Type': 'application/x-www-form-urlencoded'})
    _tokens[name] = (r['access_token'], time.time() + int(r.get('expires_in', 3600)) - 120)
    return r['access_token']


def _auth(name): return {'Authorization': 'Bearer ' + token(name)}


# ---------------- Sheets ----------------
def _col(n):
    s = ''
    while n: n, r = divmod(n - 1, 26); s = chr(65 + r) + s
    return s


def rows():
    """[(row_number, {header: value})] for every data row"""
    rng = urllib.parse.quote(f"'{TAB}'!A1:AZ2000")
    v = _req('GET', f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/{rng}', headers=_auth('google_sheets')).get('values', [])
    head = v[0]
    return head, [(i + 2, {h: (r[j] if j < len(r) else '') for j, h in enumerate(head)}) for i, r in enumerate(v[1:])]


def next_scripted():
    head, rs = rows()
    for n, r in rs:
        if r.get('Status', '').strip() == 'SCRIPTED' and r.get('Video ID'): return head, n, r
    return head, None, None


def update(video_id, values):
    """write {header: value} into the row whose Video ID matches (like n8n's 'Update row' node)"""
    head, rs = rows()
    n = next((n for n, r in rs if r.get('Video ID') == video_id), None)
    if n is None: raise SystemExit(f'SHEET: row {video_id} not found')
    data = []
    for k, val in values.items():
        if k not in head: print(f'SHEET: no column {k!r}, skipped', flush=True); continue
        data.append({'range': f"'{TAB}'!{_col(head.index(k) + 1)}{n}", 'values': [[val]]})
    if not data: return
    _req('POST', f'https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values:batchUpdate',
         {'valueInputOption': 'RAW', 'data': data}, _auth('google_sheets'))


# ---------------- YouTube ----------------
def youtube_check():
    r = _req('GET', 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', headers=_auth('youtube'))
    return [i['snippet']['title'] for i in r.get('items', [])]


def youtube_upload(path, title, description):
    """same settings as the n8n node: category 27 (Education), public, not made for kids"""
    meta = {'snippet': {'title': title, 'description': description, 'categoryId': '27'},
            'status': {'privacyStatus': 'public', 'selfDeclaredMadeForKids': False}}
    size = os.path.getsize(path)
    resp, _ = _req('POST', 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
                   json.dumps(meta).encode(), dict(_auth('youtube'), **{
                       'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4',
                       'X-Upload-Content-Length': str(size)}), raw=True)
    loc = resp.headers['Location']
    with open(path, 'rb') as f: blob = f.read()
    _, body = _req('PUT', loc, blob, dict(_auth('youtube'), **{'Content-Type': 'video/mp4', 'Content-Length': str(size)}),
                   raw=True, timeout=1800)
    return json.loads(body)['id']
