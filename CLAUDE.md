# Legal Loopholes Daily (LLD) — operator handbook for Claude

You are taking over a running, fully automated short-video channel. Read this whole file before changing anything.
This repository is **public**: never commit secrets, tokens, personal emails or phone numbers.

## What it is
- Short vertical videos (1080×1920) about real, surprising-but-true legal loopholes, hosted by **Loophole Larry**,
  a blocky 3D ring-tailed lemur with a monocle and red tie. Everyone in Larry's world is a primate.
- Handle `@legalloopholesdaily` on YouTube Shorts, Instagram Reels, Facebook Reels, TikTok.
- Posts twice a day, **12:00 and 7:00 pm America/New_York**, from GitHub Actions (`.github/workflows/post.yml`).
- One episode per row of the Google Sheet "Content Pipeline" (ID in `lld/gapi.py`), Video IDs `LLD-001` … `LLD-061`.
  The next row with Status = `SCRIPTED` is posted; the pipeline sets it to `POSTED`.

## The owner's standing rules (follow these; they came from repeated feedback)
- **Everything must be automated** and **zero additional cost**. Prefer free/open-source; no paid APIs.
- **Never enter or handle credentials/passwords.** The owner types secrets himself (`setup.sh` puts them in GitHub Secrets).
- Be concise and factual; say "I don't know" rather than guess. Legal content must be accurate, with the real limits kept
  (compressed to one line, but present). Ideas in the sheet were verified by the owner.
- Look: 3D renders, colored skies/sets, **no white backgrounds**, **no bobbing/floating characters**.
- Hooks: absurd, deadpan, "wtf did I just hear" — **not** cartoonish, childish or goofy.
  Language: extremely simple. **No childish interjections** ("Yikes!", "Ouch!", "Sweet!", "Buzz buzz…") — he hates them.
- **No spoken disclaimer.** The on-screen line "Educational content • Not legal advice" stays for the whole video.
- Ending: Larry **says** an extreme, episode-specific share line ("Send this to a friend who…"), while a sign above him
  reads "LIKE & FOLLOW FOR MORE LOOPHOLES". Then a loop line that flows back into the hook.
- Music: Kevin MacLeod (incompetech, CC BY 4.0) — his popular, darker tracks (Dexter "Blood Theme" feel), never
  elevator music; bed at ~15–20% of Larry's loudness (`level_db` −15). Credit auto-added to captions/description.
- Sound effects: meme style (vine boom, Metal Gear alert, quack, huh, bruh, scratch, cash, gasp, airhorn, trombone).
  **No** loud opening boom, **no** "dun dun dun" stings, no booms on cards.
- Videos are **≥ 60 s** (`min_seconds` in `assets/brand.json`). Owner reconfirmed 2026-11-09 — don't propose shorter.
- LLD-040 (Nebraska safe haven) and LLD-060 (Thirteenth Amendment) keep a **serious tone**; never joke about children,
  slavery or incarceration.

## How a post is made (`run.py`)
1. `python run.py window` — gate: is a posting slot ~2 h away and not yet claimed (`state/last_slot.txt`)?
2. Voice: `lld/make_voice.py` → local Kokoro TTS server `lld/tts_server.py` (voice `am_puck`, `voice_speed` 1.08,
   exclamations get a pitch/volume "pop"). Script comes from `scenes/<ID>.json` → `script`
   (`[disclaimer]` marker after the hook, `[loop]` before the loop line; the share line is `share_line`).
3. Captions: Parakeet via sherpa-onnx (`lld/make_captions.py`), one word at a time.
4. Video: `lld/render_video.py` builds a timeline from the scene plan + captions, `larry-3d/render3d.mjs` renders it
   with Three.js in headless Chromium (Playwright), then overlays captions, hook card, stickers, SFX, legal line.
5. Music bed (`lld/add_music.py`, `assets/music.json`), then loudness normalized to −14 LUFS (`loud()` in run.py).
   TikTok gets the clean (no-music) video; the owner adds a sound in the TikTok app.
6. Meta (`lld/make_meta.py`), then at the slot: YouTube, Facebook, Instagram post automatically; TikTok goes to the
   inbox as a draft (`lld/tiktok.py`) and the owner taps Post. Instagram's "also post to Facebook" is not available
   in the API, so Facebook is posted separately.
- `python run.py test` renders the next episode and pushes the video + `report.json` to the **`test-output`** branch
  (no posting). `python run.py live --now` posts the next episode immediately.
- Secrets (GitHub Secrets): GOOGLE_SHEETS_JSON, YOUTUBE_JSON, META_JSON, GH_MEDIA_JSON, TIKTOK_JSON, STATE_KEY.
  The rotating TikTok token is saved encrypted in `state/tiktok.json.enc`. Repo variable `LIVE=true` enables posting.
- The old Mac n8n workflow is retired (unpublished). The Mac copy at `~/.n8n-files/lld-pipeline` is a git clone.

## Deploying changes
- From the Mac clone: `bash ~/.n8n-files/lld-pipeline/update.sh` = commit + pull --rebase + push + start a test run.
- Then review `test-output` (download the mp4, check frames with ffmpeg, check `report.json`).
- Renders for a slot start ~2 h early (≈10:05 and ≈17:05 ET). Push changes before then or they apply to the next slot.

## Episodes: the story format (current)
All episodes LLD-007…061 except 040/060 use the "viral story" structure (`story_format: true` in the JSON):
deadpan paradox hook → a named everyman (Gary, Nigel, Chad…) living it in present tense, acted out by characters →
3–6 escalation beats → a "Wait…?" beat → "You see," pivot where Larry explains with an everyday analogy →
caveats in one line → ironic twist ending → share line → loop line. ~3.55 spoken words/s.

Scene plans are generated from a compact markup in `tools/episodes/`:
- `batch1.py … batch7.py` hold `E = {episode_number: markup}`; `names.py` holds who each character plays per episode.
- `python3 tools/episodes/story.py tools/episodes/batch1.py` validates; add `--write` to rewrite `scenes/LLD-*.json`
  (it keeps the other fields of each JSON: hook card, share_line, music_vibe, caption…).
- Markup: `hook [disclaimer] body [loop] loop line`; put `{set; cast; sign}` before a sentence to start a new shot.
  - sets: studio courtroom office shop street neighborhood harbor capitol campsite prison yellowstone
  - cast: `L:<pose>` Larry (explaining concerned pointing smug surprised thinking sneaky);
    `C:<face>.<gest>` chimp, `J:` gorilla judge, `P:` orangutan. faces: neutral surprised smug worried angry;
    gestures: none explain point think shrug arms_up wave scratch. One of each character per shot, max 3.
  - sign: `"<emoji> TEXT"` ≤ 22 chars, **only when Larry is alone** in the shot.
- Each non-Larry character gets a name tag over its head (`name` in the cast entry, from `names.py`) so viewers know
  who is who. The judge stands at the bench on the right in the courtroom; others are placed left.
- Scene `at` anchors are the first words of the sentence; they can't contain digits, hyphens or number words
  (story.py handles this). The last two scenes are generated: the share scene (`at: "send this to"`) and the loop scene.
- Older/manual scene fields still work (props `doc`, `map-us`, `prop-gavel`…, `card`, `zooms`, `sfx`) — see
  `lld/render_video.py` and `larry-3d/world.js`.
- Quick visual check without a full render: build a small timeline JSON and run
  `PREVIEW_FRAMES=90,210 node larry-3d/render3d.mjs tl.json prev.png` (needs `three` in larry-3d/node_modules).

## Performance so far (Metricool, as of 2026-11-09; small sample)
- Instagram: bimodal — ~1,200–1,500 views for relatable topics (spouse-witness LLD-011, 14-day home rental LLD-009,
  bees-are-fish LLD-004, Yellowstone zone LLD-001), ~100–330 for niche trade/tariff cases (Snuggie, Jaffa Cakes, X-Men).
  3-second hold 62–85%, but average watch only 13–31 s of ~65 s. Shares ≈ 0 (Yellowstone 13).
- TikTok: only 3 posts recorded (Nov 3–4), 76–87 views each, avg watch 9–22 s. Unknown whether later drafts were posted.
- YouTube: Metricool returns no Shorts stats; check YouTube Studio ("Viewed vs swiped away").

## Open items (as of 2026-11-09)
1. **Voice upgrade** — owner believes the voice is the biggest problem; must stay zero-cost. Candidates:
   Chatterbox (MIT, open source, expressive, `exaggeration` dial, `[laugh]`-style tags in Turbo; retired/unmaintained
   since Aug 2026 so pin the version) and Google Cloud TTS Chirp 3 HD (free up to 1M chars/month; needs a billing
   account — add a quota cap). Audition: `bash voices.sh` copies `tools/voices.yml` into `.github/workflows/` on the
   `voice-audition` branch and pushes it (the push starts it; main untouched); samples land on **`voice-samples`**.
   Hugging Face is reachable from GitHub Actions (not from Claude's cloud sandbox).
2. **Length** — decided 2026-11-09: stay ≥ 60 s. Improve retention inside 60 s (pacing, hooks, visuals) instead.
5. **World building** — owner wants new animation styles and more characters than the 4 reusable primates
   (Larry, chimp, gorilla judge, orangutan). Larry stays central.
3. **Queue order** — consider moving relatable money/crime/relationship episodes ahead of niche trade cases.
4. **TikTok** — confirm the owner is posting the inbox drafts consistently.
