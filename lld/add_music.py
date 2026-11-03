#!/usr/bin/env python3
"""Legal Loopholes Daily - add a soft background music bed (for YouTube / Facebook / Instagram).
Usage: add_music.py <video.mp4> <voiceover.wav> <VIDEO-ID> <out.mp4>
The track is picked from assets/music.json by the episode's "music_vibe" (scenes/<ID>.json), rotating within the vibe.
Its loudness is set relative to Larry's voice: level_db (default -15 dB, about 18% of the voice level).
Prints JSON: {track, credit, voice_lufs, music_lufs, level_db}
"""
import sys, os, re, json, shutil, subprocess, urllib.request, urllib.parse

ROOT = os.path.expanduser('~/.n8n-files')
FFMPEG = next((p for p in ['/opt/homebrew/bin/ffmpeg', shutil.which('ffmpeg')] if p and os.path.exists(p)), 'ffmpeg')
FFPROBE = FFMPEG.replace('ffmpeg', 'ffprobe') if os.path.exists(FFMPEG.replace('ffmpeg', 'ffprobe')) else 'ffprobe'
CACHE = os.path.join(ROOT, 'music')

video, voice, vid, out = sys.argv[1:5]
LIB = json.load(open(os.path.join(ROOT, 'assets', 'music.json')))
plan = {}
try: plan = json.load(open(os.path.join(ROOT, 'scenes', f'{vid}.json')))
except Exception: pass


def pick():
    if plan.get('music_track') in LIB['tracks']: return plan['music_track']
    vibe = plan.get('music_vibe') or LIB.get('default_vibe', 'quirky')
    pool = LIB['vibes'].get(vibe) or LIB['vibes'][LIB.get('default_vibe', 'quirky')]
    n = int(re.sub(r'\D', '', vid) or 0)
    return pool[n % len(pool)]


def fetch(title):
    fn = LIB['tracks'][title]
    path = os.path.join(CACHE, fn)
    if not os.path.exists(path) or os.path.getsize(path) < 100000:
        os.makedirs(CACHE, exist_ok=True)
        req = urllib.request.Request(LIB['base_url'] + urllib.parse.quote(fn), headers={'User-Agent': 'LLD-pipeline'})
        with urllib.request.urlopen(req, timeout=120) as r, open(path + '.part', 'wb') as f: shutil.copyfileobj(r, f)
        os.replace(path + '.part', path)
    return path


def lufs(args):
    # measured on a mono fold-down: that is how a phone speaker plays it, and the worst case for the music level
    log = subprocess.run([FFMPEG, '-hide_banner', '-nostats', *args, '-af', 'aformat=channel_layouts=mono,ebur128', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', log)
    return float(m[-1])


def duration(p):
    return float(subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p],
                                capture_output=True, text=True).stdout.strip())


title = pick()
track = fetch(title)
dur = duration(video)
loop = duration(track) < dur + 0.5
lp = ['-stream_loop', '-1'] if loop else []
tmp = out + '.bed.wav'
def make_bed(gain_db):
    fc = (f'[0:a]atrim=0:{dur:.3f},asetpts=N/SR/TB,aresample=48000,aformat=channel_layouts=stereo,'
          f'afade=t=in:d={fi},afade=t=out:st={max(0, dur - fo):.3f}:d={fo},volume={gain_db:.2f}dB[m]')
    subprocess.run([FFMPEG, '-loglevel', 'error', '-y', *lp, '-i', track, '-filter_complex', fc, '-map', '[m]',
                    '-t', f'{dur:.3f}', '-c:a', 'pcm_f32le', tmp], check=True)
    return lufs(['-i', tmp])
fi, fo = float(LIB.get('fade_in', 1.0)), float(LIB.get('fade_out', 2.0))
level = float(LIB.get('level_db', -15))
v_i = lufs(['-i', voice])
m0 = make_bed(0.0)                                   # measure the bed exactly as it will be mixed (trim, fades, stereo)
gain = v_i + level - m0
m_i = make_bed(gain)                                 # verify, and correct once if the measurement moved
if abs(m_i - (v_i + level)) > 0.5:
    gain += (v_i + level) - m_i; m_i = make_bed(gain)
fc = (f'[0:a]aresample=48000,aformat=channel_layouts=stereo[v];[1:a]aformat=channel_layouts=stereo[m];'
      f'[v][m]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.99:attack=2:release=40:level=false[a]')
subprocess.run([FFMPEG, '-loglevel', 'error', '-y', '-i', video, '-i', tmp, '-filter_complex', fc,
                '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out],
               check=True)
os.remove(tmp)
credit = (f'Music: "{title}" Kevin MacLeod (incompetech.com)\n'
          'Licensed under Creative Commons: By Attribution 4.0\nhttps://creativecommons.org/licenses/by/4.0/')
print(json.dumps({'track': title, 'credit': credit, 'voice_lufs': round(v_i, 1), 'music_lufs_after': round(m_i, 1),
                  'level_db': level, 'looped': loop}))
