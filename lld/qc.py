#!/usr/bin/env python3
"""Legal Loopholes Daily - quality gate run on every finished video before it can be posted.
Usage: qc.py <VIDEO-ID> <final video (with music)>     (files are looked up next to it: -voiceover.wav, -spoken.txt,
                                                         -captions.srt, -voicecheck.json)
Prints JSON {ok, fails, warnings, metrics}; exit code 1 when a check fails.

Checks
- voice:    the whole voice-over is transcribed again and compared with what Larry was meant to say.
- captions: the caption words are exactly the script's words, in order, inside the audio, never overlapping.
- pacing:   overall speaking rate and the length of every pause; video at least min_seconds long.
- sound:    no moment in the final mix jumps clearly above Larry's speaking level (stray loud effects), no clipping.
- share:    the "Send this to..." line is said and on screen as written.
"""
import sys, os, re, json, subprocess, shutil
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import textcheck as TC

vid, video = sys.argv[1], sys.argv[2]
d = os.path.dirname(os.path.abspath(video))
P = lambda s: os.path.join(d, f'{vid}-{s}')
FFMPEG = next((p for p in ['/opt/homebrew/bin/ffmpeg', shutil.which('ffmpeg')] if p and os.path.exists(p)), 'ffmpeg')
try: BRAND = json.load(open(os.path.join(os.path.expanduser('~/.n8n-files'), 'assets', 'brand.json')))
except Exception: BRAND = {}
QC = {'min_voice_score': 0.96, 'min_line_score': 0.85, 'wps': [3.0, 3.9], 'max_pause': 1.3, 'loud_db': 4.5, 'other_db': -1.5, **BRAND.get('qc', {})}
fails, warns, m = [], [], {}


def pcm(path, sr=16000):
    raw = subprocess.run([FFMPEG, '-loglevel', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(sr), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


spoken = open(P('spoken.txt')).read().strip() if os.path.exists(P('spoken.txt')) else None
voice = pcm(P('voiceover.wav'))
dur = len(voice) / 16000
m['seconds'] = round(dur, 2)
if dur < float(BRAND.get('min_seconds', 60)): fails.append(f'voice-over is {dur:.1f} s, under {BRAND.get("min_seconds", 60)} s')

# ---- voice ----
if spoken is None: fails.append('no -spoken.txt: cannot check the voice against the script')
else:
    heard = TC.heard(voice, 16000)
    sc, diffs = TC.score(spoken, heard)
    m['voice_score'] = round(sc, 3); m['voice_differences'] = diffs[:20]
    if sc < QC['min_voice_score']: fails.append(f'voice does not match the script well enough ({sc:.3f}): {diffs[:8]}')
    elif diffs: warns.append(f'small differences heard (often the recognizer, not the voice): {diffs[:8]}')
    try:
        vc = json.load(open(P('voicecheck.json')))
        m['retakes'] = vc.get('retakes'); m['speed'] = vc.get('speed')
        worst = [c for c in vc.get('lines', []) if c['score'] < QC['min_line_score']]
        if worst: fails.append('lines still wrong after every take: ' + '; '.join(f"\"{c['line']}\" {c['diffs']}" for c in worst[:5]))
    except Exception: warns.append('no voicecheck.json')

# ---- pacing ----
if spoken:
    words = len(TC.keys_of(spoken)); wps = words / dur
    m['words_per_second'] = round(wps, 2)
    lo, hi = QC['wps']
    if not lo <= wps <= hi: fails.append(f'pace {wps:.2f} words/s is outside {lo}-{hi} ({"too fast" if wps > hi else "too slow"})')
fr = 160; env = np.abs(voice[:len(voice) // fr * fr]).reshape(-1, fr).mean(1)
quiet = env < 0.004; run = longest = 0; at = 0
for i, q in enumerate(quiet):
    run = run + 1 if q else 0
    if run > longest: longest, at = run, i
m['longest_pause'] = round(longest * 0.01, 2)
if longest * 0.01 > QC['max_pause']: fails.append(f'dead air of {longest * 0.01:.1f} s around {at * 0.01 - longest * 0.01:.1f} s')

# ---- captions ----
caps = []
if os.path.exists(P('captions.srt')):
    for b in open(P('captions.srt')).read().strip().split('\n\n'):
        L = b.split('\n')
        if len(L) >= 3:
            t = [sum(float(x) * k for x, k in zip(re.split('[:,]', s.strip())[:3], (3600, 60, 1))) + int(re.split('[:,]', s.strip())[3]) / 1000 for s in L[1].split('-->')]
            caps.append((t[0], t[1], ' '.join(L[2:])))
m['caption_words'] = len(caps)
if not caps: fails.append('no captions')
else:
    if spoken:
        want = [w for w, _ in TC.tokens(spoken)]
        got = [c[2] for c in caps]
        if got != want:
            import difflib
            dd = [(' '.join(want[a1:a2]), ' '.join(got[b1:b2])) for op, a1, a2, b1, b2 in difflib.SequenceMatcher(None, want, got, autojunk=False).get_opcodes() if op != 'equal']
            fails.append(f'captions differ from the script: {dd[:6]}')
    back = [i for i in range(1, len(caps)) if caps[i][0] < caps[i - 1][0]]
    over = [i for i in range(1, len(caps)) if caps[i][0] < caps[i - 1][1] - 0.02]
    if back: fails.append(f'captions go backwards at {[round(caps[i][0], 2) for i in back[:5]]}')
    if over: warns.append(f'{len(over)} caption overlaps')
    if caps[-1][1] > dur + 1.0: fails.append('captions run past the end of the voice-over')
    if spoken and caps:
        # every caption should start close to where the recognizer hears that word (timing sanity)
        st, cov = TC.align(TC.tokens(spoken), heard, dur)
        drift = [abs(a - b[0]) for a, b in zip(st, caps)]
        m['caption_timing_max_drift'] = round(max(drift), 2) if drift else 0
        if drift and max(drift) > 0.6: fails.append(f'a caption is {max(drift):.2f} s off its word')

# ---- share line ----
share = None
try: share = (json.load(open(os.path.join(os.path.expanduser('~/.n8n-files'), 'scenes', f'{vid}.json'))).get('share_line') or '').strip()
except Exception: pass
if share and spoken:
    ks, kp = TC.keys_of(share), TC.keys_of(spoken)
    if not any(kp[i:i + len(ks)] == ks for i in range(len(kp))): fails.append('share line is not in the voice-over as written')

# ---- picture plan ----
tl_path = P('video.mp4.timeline.json')
if os.path.exists(tl_path):
    tl = json.load(open(tl_path)); m['shots'] = len(tl.get('scenes', []))
    if len(tl.get('scenes', [])) < 4: fails.append(f"only {len(tl.get('scenes', []))} shot(s): the episode's scene plan was not used")
    if share and not tl.get('share'): fails.append('the share scene ("Send this to...") was not placed')
else: warns.append('no timeline file to check the shots')

# ---- sound ----
mix = pcm(video, 16000) if os.path.exists(video) else np.zeros(0, np.float32)
if len(mix) < 16000 * 10: fails.append(f'final video missing or has no sound: {video}')
else:
    w = 800; n = len(mix) // w
    r = np.sqrt((mix[:n * w].reshape(n, w) ** 2).mean(1)) + 1e-9
    vr = np.sqrt((voice[:min(len(voice), n * w)][:len(voice) // w * w].reshape(-1, w) ** 2).mean(1)) if len(voice) >= w else np.zeros(1)
    speech = r[:len(vr)][vr > 0.02] if (vr > 0.02).any() else r
    ref = float(np.percentile(speech, 90))
    loud = [(i * 0.05, 20 * np.log10(r[i] / ref)) for i in range(n) if 20 * np.log10(r[i] / ref) > QC['loud_db']]
    # everything that is not Larry's voice (effects, music, glitches): mix minus the scaled voice, window by window
    nv = min(n, len(vr)); act = vr[:nv] > 0.03
    k = float(np.median(r[:nv][act] / vr[:nv][act])) if act.any() else 1.0
    other = np.sqrt(np.maximum(0, r[:nv] ** 2 - (k * vr[:nv]) ** 2))
    odb = 20 * np.log10(other / ref + 1e-9)
    m['loudest_other_sound_db'] = round(float(odb.max()), 1)
    hit = [odb[i] > QC['other_db'] + (1.5 if act[i] else 0.0) for i in range(nv)]     # speech makes the estimate noisier
    loud += [(i * 0.05, float(odb[i])) for i in range(nv) if hit[i] and ((i > 0 and hit[i - 1]) or (i + 1 < nv and hit[i + 1]))]
    loud.sort()
    m['loudest_vs_voice_db'] = round(float(20 * np.log10(r.max() / ref)), 1)
    if loud:
        spots = []
        for t, db in loud:
            if not spots or t - spots[-1][0] > 0.5: spots.append([t, db])
            else: spots[-1][1] = max(spots[-1][1], db)
        fails.append('loud sounds (vs. Larry\'s speaking level): ' + ', '.join(f'{t:.1f}s (+{db:.1f} dB)' for t, db in spots[:6]))
    pk = float(np.abs(mix).max()); m['peak'] = round(pk, 3)
    if pk > 0.995: warns.append('audio touches full scale (possible clipping)')

out = {'ok': not fails, 'video_id': vid, 'fails': fails, 'warnings': warns, 'metrics': m}
print(json.dumps(out))
sys.exit(0 if not fails else 1)
