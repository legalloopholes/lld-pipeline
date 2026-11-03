#!/usr/bin/env python3
"""Legal Loopholes Daily - one posting slot, run by GitHub Actions (same steps as the n8n "LLD v2 (scheduled)" workflow).

  run.py live          scheduled run: only acts inside a posting window (12:00 / 7:00 pm New York time),
                       renders the next SCRIPTED row, waits for the posting time, posts, updates the sheet
  run.py live --now    same, but posts right away (manual catch-up run)
  run.py test          renders the next SCRIPTED row and checks every account WITHOUT posting or changing the sheet;
                       the video is pushed to the repo's test-output branch so it can be reviewed
"""
import sys, os, json, time, base64, shutil, subprocess, tempfile, datetime
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'lld'))
import gapi

ROOT = os.path.expanduser('~/.n8n-files')
PY = sys.executable
ET = ZoneInfo('America/New_York')
SLOTS = [(12, 0), (19, 0)]
EARLY, LATE = 130, 150                       # minutes before / after a slot in which a run may act (render takes ~30 min)
RUN_URL = f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}"
STATE = os.path.join(HERE, 'state')


def log(*a): print(*a, flush=True)


def sh(args, check=True):
    log('$', ' '.join(os.path.basename(str(a)) if i == 0 else (str(a) if len(str(a)) < 120 else str(a)[:60] + '…')
                      for i, a in enumerate(args)))
    r = subprocess.run([str(a) for a in args], capture_output=True, text=True)
    if r.stderr.strip(): log(r.stderr.strip()[-3000:])
    if check and r.returncode != 0:
        raise SystemExit(f'step failed (exit {r.returncode}): {os.path.basename(str(args[1] if len(args) > 1 else args[0]))}\n{r.stdout[-2000:]}')
    return r


def last_json(out):
    for line in reversed((out or '').strip().splitlines()):
        try: return json.loads(line)
        except ValueError: pass
    return {}


def git(*a, cwd=HERE): return subprocess.run(['git', '-C', cwd, *a], capture_output=True, text=True)


def commit(paths, msg):
    git('config', 'user.name', 'LLD bot'); git('config', 'user.email', 'bot@legalloopholes.invalid')
    git('add', *paths)
    if not git('diff', '--cached', '--quiet').returncode: return
    git('commit', '-q', '-m', msg)
    for _ in range(3):
        if git('push', '-q').returncode == 0: return
        git('pull', '-q', '--rebase')
    log('WARNING: could not push', paths)


# ---- TikTok tokens rotate, so the newest copy is kept encrypted in the repo (state/tiktok.json.enc) ----
def tiktok_save():
    src = os.path.join(ROOT, 'secrets', 'tiktok.json')
    if not (os.path.exists(src) and os.environ.get('STATE_KEY')): return
    os.makedirs(STATE, exist_ok=True)
    enc = os.path.join(STATE, 'tiktok.json.enc')
    old = None
    if os.path.exists(enc):
        old = subprocess.run(['openssl', 'enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '200000', '-in', enc, '-pass', 'env:STATE_KEY'],
                             capture_output=True).stdout
    if old == open(src, 'rb').read(): return
    subprocess.run(['openssl', 'enc', '-aes-256-cbc', '-pbkdf2', '-iter', '200000', '-salt', '-in', src, '-out', enc,
                    '-pass', 'env:STATE_KEY'], check=True)
    commit([enc], 'Update TikTok token (encrypted)')


def pick_slot(now):
    for d in (0, -1):
        day = (now + datetime.timedelta(days=d)).date()
        for h, m in SLOTS:
            t = datetime.datetime(day.year, day.month, day.day, h, m, tzinfo=ET)
            if t - datetime.timedelta(minutes=EARLY) <= now <= t + datetime.timedelta(minutes=LATE): return t
    return None


def make(vid, script):
    b64 = base64.b64encode(script.encode()).decode()
    p = lambda s: os.path.join(ROOT, f'{vid}-{s}')
    sh([PY, f'{HERE}/lld/make_voice.py', p('body.wav'), b64])
    sh(['ffmpeg', '-loglevel', 'error', '-i', p('body.wav'), '-y', p('voiceover.wav')])
    yield 'audio'
    cap = last_json(sh([PY, f'{HERE}/lld/make_captions.py', p('voiceover.wav'), p('captions.srt')]).stdout)
    log('captions:', {k: cap.get(k) for k in ('words', 'overlaps')})
    yield 'captions'
    t0 = time.time()
    rv = last_json(sh([PY, f'{HERE}/lld/render_video.py', p('voiceover.wav'), p('captions.srt'), p('video.mp4')]).stdout)
    log(f'render: {round(time.time() - t0)} s', json.dumps(rv)[:600])
    yield 'video'


def add_music(vid):
    """YouTube / Facebook / Instagram copy with a soft Kevin MacLeod bed; TikTok keeps the clean video.
    Returns (path, credit) - the clean video and no credit if music is off or fails."""
    clean = os.path.join(ROOT, f'{vid}-video.mp4')
    try: lib = json.load(open(os.path.join(ROOT, 'assets', 'music.json')))
    except Exception: lib = {}
    if not lib.get('enabled'): return clean, ''
    out = os.path.join(ROOT, f'{vid}-video-music.mp4')
    r = sh([PY, f'{HERE}/lld/add_music.py', clean, os.path.join(ROOT, f'{vid}-voiceover.wav'), vid, out], check=False)
    info = last_json(r.stdout)
    if r.returncode != 0 or not info.get('credit'):
        log('WARNING: music step failed; posting without music'); return clean, ''
    log('music:', {k: info.get(k) for k in ('track', 'voice_lufs', 'music_lufs_after', 'level_db')})
    return out, info['credit']


def post_text(vid, script):
    return last_json(sh([PY, f'{HERE}/lld/make_meta.py', vid, base64.b64encode(script.encode()).decode()]).stdout)


def live(force_now):
    now = datetime.datetime.now(ET)
    slot = now if force_now else pick_slot(now)
    if not slot: log(f'{now:%Y-%m-%d %H:%M} New York time is not a posting window. Nothing to do.'); return
    sid = slot.strftime('%Y-%m-%d %H:%M')
    claim = os.path.join(STATE, 'last_slot.txt')
    if not force_now and os.path.exists(claim) and open(claim).read().strip() == sid:
        log(f'Slot {sid} was already handled by an earlier run.'); return
    head, n, row = gapi.next_scripted()
    if not row: log('No SCRIPTED rows left in the sheet. Nothing to post.'); return
    vid, script = row['Video ID'], row['SCRIPT']
    os.makedirs(STATE, exist_ok=True); open(claim, 'w').write(sid + '\n')
    commit([claim], f'Slot {sid}: {vid}')
    log(f'== {vid} for the {sid} slot ==')

    for stage in make(vid, script):
        if stage == 'audio': gapi.update(vid, {'Status': 'AUDIO READY'})
        if stage == 'captions': gapi.update(vid, {'Audio/Caption Status': 'CAPTIONS READY'})
        if stage == 'video': gapi.update(vid, {'Status': 'VIDEO READY', 'Video File': RUN_URL})
    meta = post_text(vid, script)
    gapi.update(vid, {'YouTube Title': meta['title'], 'Caption': meta['tiktok_caption'], 'Hashtags': meta['hashtags']})

    wait = (slot - datetime.datetime.now(ET)).total_seconds()
    if wait > 0: log(f'Video ready. Waiting {round(wait / 60)} min for {slot:%H:%M}.'); time.sleep(wait)
    video = os.path.join(ROOT, f'{vid}-video.mp4')                 # clean: TikTok (you add the sound in the app)
    mvideo, credit = add_music(vid)                                  # with music: YouTube, Facebook, Instagram
    desc = meta['description'] + ('\n\n' + credit if credit else '')
    fb_ig_caption = 'b64:' + base64.b64encode((meta['caption'] + ' ' + meta['hashtags'] + ' #reels'
                                               + ('\n\n' + credit if credit else '')).encode()).decode()
    results = {}

    r = sh([PY, f'{HERE}/lld/tiktok.py', 'draft', video], check=False)
    tiktok_save()
    results['TikTok URL'] = (f"Draft sent {datetime.datetime.now(ET):%Y-%m-%d %H:%M} - paste the Caption column and tap Post"
                             if r.returncode == 0 else 'FAILED - see GitHub run ' + RUN_URL)
    gapi.update(vid, {'TikTok URL': results['TikTok URL']})

    try: results['YouTube URL'] = 'https://youtube.com/shorts/' + gapi.youtube_upload(mvideo, meta['title'], desc)
    except SystemExit as e: log(e); results['YouTube URL'] = 'FAILED - see GitHub run ' + RUN_URL
    gapi.update(vid, {'YouTube URL': results['YouTube URL']})

    for col, cmd in (('Facebook URL', 'fb'), ('Instagram URL', 'ig')):
        r = sh([PY, f'{HERE}/lld/meta.py', cmd, mvideo, fb_ig_caption], check=False)
        out = last_json(r.stdout)
        results[col] = (out.get('url') or 'posted') if r.returncode == 0 else 'FAILED - see GitHub run ' + RUN_URL
        gapi.update(vid, {col: results[col]})

    gapi.update(vid, {'Status': 'POSTED'})
    log(json.dumps({'video_id': vid, **results}, indent=1))
    if all(v.startswith('FAILED') for v in results.values()): raise SystemExit('every platform failed')


def test():
    report, ok = {}, True

    def check(name, fn):
        nonlocal ok
        try: report[name] = fn() or 'ok'
        except (Exception, SystemExit) as e: report[name] = 'FAILED: ' + str(e)[:300]; ok = False
        log(name, '->', report[name])

    head, n, row = gapi.next_scripted()
    if not row: raise SystemExit('no SCRIPTED row to test with')
    vid, script = row['Video ID'], row['SCRIPT']
    report['sheet'] = f'read ok; next SCRIPTED row is {vid} (row {n})'
    t0 = time.time()
    for _ in make(vid, script): pass
    report['render_seconds'] = round(time.time() - t0)
    mvideo, credit = add_music(vid)
    report['music'] = credit.splitlines()[0] if credit else 'off or failed'
    report['post_text'] = post_text(vid, script)
    check('youtube', lambda: 'channel: ' + ', '.join(gapi.youtube_check()))
    check('meta', lambda: last_json(sh([PY, f'{HERE}/lld/meta.py', 'check']).stdout))
    def tk():   # do NOT refresh here: the Mac still uses the same TikTok login until the switch-over
        c = json.load(open(os.path.join(ROOT, 'secrets', 'tiktok.json')))
        assert c.get('refresh_token') and c.get('client_key') and c.get('client_secret'), 'tiktok.json incomplete'
        days = (c.get('refresh_expires_at', 0) - time.time()) / 86400
        assert days > 0, 'TikTok login expired'
        return f'login present, renewal valid {round(days)} more days'
    check('tiktok', tk)
    def gh():
        tok = json.load(open(os.path.join(ROOT, 'secrets', 'github.json')))['token']
        req = __import__('urllib.request').request.Request('https://api.github.com/repos/legalloopholes/lld-media',
                                                           headers={'Authorization': 'Bearer ' + tok})
        with __import__('urllib.request').request.urlopen(req, timeout=30) as r: d = json.load(r)
        assert d.get('permissions', {}).get('push'), 'token cannot push to lld-media'
        return 'lld-media push ok'
    check('instagram_hosting', gh)

    # publish the test video for review on the test-output branch
    d = tempfile.mkdtemp()
    shutil.copy(os.path.join(ROOT, f'{vid}-video.mp4'), d)
    if mvideo != os.path.join(ROOT, f'{vid}-video.mp4'): shutil.copy(mvideo, d)
    json.dump(report, open(os.path.join(d, 'report.json'), 'w'), indent=1)
    hdr = git('config', '--get', 'http.https://github.com/.extraheader').stdout.strip()
    url = git('remote', 'get-url', 'origin').stdout.strip()
    g = lambda *a: subprocess.run(['git', '-C', d, *a], capture_output=True, text=True)
    g('init', '-q', '-b', 'test-output'); g('add', '.')
    g('-c', 'user.name=LLD bot', '-c', 'user.email=bot@legalloopholes.invalid', 'commit', '-q', '-m', f'Test render {vid}')
    p = g('-c', f'http.https://github.com/.extraheader={hdr}', 'push', '-q', '--force', url, 'test-output')
    report['review'] = f'test-output branch: {vid}-video.mp4' if p.returncode == 0 else 'could not push test video'
    log(json.dumps(report, indent=1, ensure_ascii=False))
    if not ok: raise SystemExit('some checks failed (see above)')


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    if mode == 'window':                     # quick check used by the workflow before installing anything
        now = datetime.datetime.now(ET); slot = pick_slot(now)
        claim = os.path.join(STATE, 'last_slot.txt')
        done = slot and os.path.exists(claim) and open(claim).read().strip() == slot.strftime('%Y-%m-%d %H:%M')
        print('yes' if slot and not done else 'no')
    elif mode == 'live': live('--now' in sys.argv)
    elif mode == 'test': test()
    else: print(__doc__)
