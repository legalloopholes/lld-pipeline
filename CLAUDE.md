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
- Look (2026-11-10): **Pixel RPG** (`brand.json` `"style": "rpg"`, `larry-3d/pixel/`), chosen by the owner over the
  3D cinematic look. Everything is drawn in code: `kit.js` (cute Larry with monocle, the primate cast, idle actions),
  `sets.js` (11 sets), `life.js` (animals, passers-by, traffic, props). The owner wants **lots of idle life**
  ("the more the merrier"): characters breathe/blink/act (smoke, phone, coffee, gavel...), sets always move.
  Larry must stay **cute** (big glossy eyes, never the old amber/black "terrifying" eyes). No white backgrounds.
  The 3D styles (`cinematic` etc.) still work if `style` is changed back.
- Hooks: absurd, deadpan, "wtf did I just hear" — **not** cartoonish, childish or goofy.
  Language: extremely simple. **No childish interjections** ("Yikes!", "Ouch!", "Sweet!", "Buzz buzz…") — he hates them.
- **No spoken disclaimer.** The on-screen line "Educational content • Not legal advice" stays for the whole video.
- Ending: Larry **says** an extreme, episode-specific share line ("Send this to a friend who…"), while a sign above him
  reads "LIKE & FOLLOW FOR MORE LOOPHOLES". Then a loop line that flows back into the hook.
- Music: Kevin MacLeod (incompetech, CC BY 4.0) — his popular, darker tracks (Dexter "Blood Theme" feel), never
  elevator music; bed at ~32% of Larry's loudness (`level_db` −10; owner found −15 inaudible, 2026-11-09). Credit auto-added to captions/description.
- Sound effects: meme style (vine boom, Metal Gear alert, quack, huh, bruh, scratch, cash, gasp, airhorn, trombone).
  **No** loud opening boom, **no** "dun dun dun" stings, no booms on cards, **no gasps** (owner 2026-11-10: "constant gasps").
- **No camera shakes** and **no emojis anywhere** (no reaction stickers, sign icons, or emojis in titles/captions) — owner 2026-11-10.
  Sign markup still accepts `"<emoji> TEXT"` but the icon is dropped; `make_meta.py` strips emojis from post text.
  The owner's own files (`assets/sfx/*.wav`, git-ignored) reach the cloud as `assets/sfx.tgz.enc`, decrypted with the
  `SFX_KEY` secret; the owner re-runs `bash tools/sfx_pack.sh` after changing them. Without it only Freesound sounds play.
- **Quality gate (owner, 2026-11-10: no errors in voice or captions, no random loud noises, natural pace).**
  `make_voice.py` listens to every line with Parakeet and re-takes it (up to `voice_takes`) until every word is right;
  one/two-word sentences are read together; tempo is set so the whole read is ~`words_per_second` 3.4.
  Captions show the **script's words** (`<ID>-spoken.txt`), timed by the recognizer (`lld/textcheck.py`).
  Sound effects are levelled under Larry's voice; no filler booms. `lld/qc.py` checks voice vs script, captions vs
  script, pace, dead air, loud moments and the share line; a failing episode is marked **QC FAILED** in the sheet and
  the next one takes the slot (`qc_attempts`). Thresholds: `brand.json` `qc`.
- Videos are **≥ 60 s** (`min_seconds` in `assets/brand.json`). Owner reconfirmed 2026-11-09 — don't propose shorter.
- LLD-040 (Nebraska safe haven) and LLD-060 (Thirteenth Amendment) keep a **serious tone**; never joke about children,
  slavery or incarceration.

## How a post is made (`run.py`)
1. `python run.py window` — gate: is a posting slot ~2 h away and not yet claimed (`state/last_slot.txt`)?
2. Voice: `lld/make_voice.py` → local TTS server on :8300. Since 2026-11-09 Larry is **Chatterbox** (`lld/tts_chatterbox.py`,
   chatterbox-tts==0.1.7 in its own venv, exaggeration 0.75 / cfg 0.35 = audition #6, picked by the owner by ear;
   speed via atempo, `voice_speed` 1.08; no pitch "pop": `voice_pop` false). The old Kokoro `am_puck` voice was
   **removed for good** (owner, 2026-11-10): never bring it back or use it for previews. Script comes from `scenes/<ID>.json` → `script`
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

## Look and cast (`larry-3d/`)
- `styles.js`: `classic | toon | diorama | noir | cinematic`, chosen by `brand.json` `"style"` (or `LLD_STYLE`).
  `cinematic` = rounded edges, image-based light, grain bump, warm sun + cool fill + rim, light bloom, slight depth
  filmic grade. Depth of field and 4x MSAA are **off** by default (each ~0.28 s/frame in software WebGL; SMAA does the
  edges); `style_on: ['dof','msaa']` brings them back. GTAO ambient occlusion is **off** (it leaves a dark box in the courtroom); `style_on: ['ao']`
  in a timeline forces it for experiments. Vignette `darkness` must stay ≤ 1 (above it colours go negative).
- `primates.js`: character kit, `"<species>.<outfit>"` — species baboon mandrill capuchin macaque gibbon proboscis
  tarsier bonobo; outfits cop customs suit irs hardhat chef cardigan dress hoodie tracksuit tourist overalls.
  Story characters are cast **automatically from their name tag** (`ROLES` in primates.js: OFFICER/RANGER → baboon cop,
  IRS/TAX → macaque irs, BANK/companies → mandrill suit, WIFE → bonobo dress, GRANDMA → capuchin cardigan…).
  Leads (Gary, Chad…) stay the chimp, the judge stays the gorilla, government stays the orangutan, Larry is the only lemur.
  Override in markup: `P:smug.point=mandrill.chef`.

## Deploying changes
- From the Mac clone: `bash ~/.n8n-files/lld-pipeline/update.sh` = commit + pull --rebase + push + start a test run.
- Then review `test-output` (download the mp4, check frames with ffmpeg, check `report.json`).
- Renders for a slot start ~4 h early (≈08:05 and ≈15:05 ET; `EARLY` in run.py, cron in post.yml). Push changes before
  then or they apply to the next slot.

## Episodes: the story format (current)
All episodes LLD-001…061 except 040/060 use (001–006 rewritten in `batch0.py` for the relaunch) the "viral story" structure (`story_format: true` in the JSON):
deadpan paradox hook → a named everyman (Gary, Nigel, Chad…) living it in present tense, acted out by characters →
3–6 escalation beats → a "Wait…?" beat → "You see," pivot where Larry explains with an everyday analogy →
caveats in one line → ironic twist ending → share line → loop line. ~3.55 spoken words/s.

Scene plans are generated from a compact markup in `tools/episodes/`:
- `batch0.py … batch7.py` hold `E = {episode_number: markup}`; `names.py` holds who each character plays per episode.
- `python3 tools/episodes/story.py tools/episodes/batch1.py` validates; add `--write` to rewrite `scenes/LLD-*.json`
  (it keeps the other fields of each JSON: hook card, share_line, music_vibe, caption…).
- Markup: `hook [disclaimer] body [loop] loop line`; put `{set; cast; sign}` before a sentence to start a new shot.
  - sets: studio courtroom office shop street neighborhood harbor capitol campsite prison yellowstone
  - cast: `L:<pose>` Larry (explaining concerned pointing smug surprised thinking sneaky);
    `C:<face>.<gest>` chimp, `J:` gorilla judge, `P:` orangutan (add `=species.outfit` for a kit look). faces: neutral surprised smug worried angry;
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

## Relaunch (started 2026-11-09)
- Owner restarted the run from LLD-001 with the new voice, cast, cinematic look and story scripts.
- Owner approved the LLD-001 test (voice, look, script) on 2026-11-09. Merged to `main`, `LIVE=true`; the relaunch
  starts with LLD-001 on 2026-11-10 12:00 ET, then two posts a day. Pause again with
  `gh variable set LIVE --body false -R legalloopholes/lld-pipeline`.
- Sheet: LLD-001…014 set back to SCRIPTED; their old post links/Video File cleared (list kept locally in
  `previews/old_posts.md`, git-ignored). Owner archives/hides the old posts himself (not delete).
- `voice-audition` was merged into `main` on 2026-11-09; work on `main` from now on.

## Open items (as of 2026-11-09)
1. **Render time** — first cinematic test ran 2.5 h+ on the runner. Fixed 2026-11-09: DOF/MSAA off (−44% per frame,
   measured locally with `LLD_SOFTGL=1`), renders start 4 h early. Check `render_seconds` in the test `report.json`.
   Next lever if needed: image-based light (~0.2 s/frame) or rendering in parallel browser pages.
2. **Queue order** — consider moving relatable money/crime/relationship episodes ahead of niche trade cases.
3. **TikTok** — confirm the owner is posting the inbox drafts consistently.
