# Legal Loopholes Daily – automatic pipeline (GitHub Actions)

Twice a day (12:00 and 7:00 pm New York time) GitHub runs `.github/workflows/post.yml`, which does what the
Mac's n8n workflow "LLD v2 (scheduled)" did:

1. reads the next row with Status = SCRIPTED from the Google Sheet "Content Pipeline"
2. voices the script with Kokoro (am_puck), the same model the Mac uses (`lld/tts_server.py` + `lld/make_voice.py`)
3. times one-word captions to the audio (Parakeet, `lld/make_captions.py`)
4. renders the 3D video (`larry-3d/`, `lld/render_video.py`) from `scenes/<Video ID>.json`
5. writes title / caption / hashtags (`lld/make_meta.py`)
6. at the posting time: TikTok inbox draft, YouTube Short, Facebook Reel, Instagram Reel; updates the sheet

Runs start about 2 hours early because rendering on GitHub's computers takes roughly 30 minutes.

- Logins live in GitHub Secrets (set by `setup.sh`). The rotating TikTok login is stored encrypted in `state/`.
- Scheduled posting only happens while the repository variable `LIVE` is `true` (`cutover.sh` sets it).
- Manual runs: Actions → "Post next episode" → Run workflow → `test` (no posting) or `live` (posts the next episode now).
- Fonts: free OFL stand-ins for Arial Rounded / Arial Black / Georgia (see `fonts/README.md`).

## Music
YouTube, Facebook and Instagram get a soft background track (Kevin MacLeod, incompetech.com, CC BY 4.0) at
`level_db` (−15 dB ≈ 18% of Larry's voice level) — settings and the track list per vibe are in `assets/music.json`;
each episode's vibe is `music_vibe` in `scenes/<ID>.json` (or force a track with `music_track`). TikTok gets the clean
video. The required credit is added to the YouTube description and the Facebook/Instagram caption automatically.
Set `"enabled": false` in `assets/music.json` to turn music off.
