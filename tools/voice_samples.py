#!/usr/bin/env python3
"""Voice audition: the same Larry lines in several free voices, for picking by ear.
   python tools/voice_samples.py kokoro OUTDIR      (main env)
   python tools/voice_samples.py chatterbox OUTDIR  (separate env with chatterbox-tts)"""
import sys, os
TEXT = ("What if you just married the only witness to your crime? "
        "Meet Otis. Otis is on trial for smuggling heroin. His wife was in on it too. "
        "But she makes a deal. She agrees to testify against him. "
        "Otis jumps up. You can't do that! She's my wife! "
        "Wait. The Supreme Court changes the rule? "
        "You see, the choice belongs to the spouse on the stand. Nobody can force her to testify. But nobody can stop her either.")
engine, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)

if engine == 'kokoro':
    import numpy as np, soundfile as sf
    from kokoro import KPipeline
    p = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M', device='cpu')
    for name, voice, speed in [('1-current-kokoro-puck', 'am_puck', 1.08), ('2-kokoro-fenrir', 'am_fenrir', 1.08),
                               ('3-kokoro-michael', 'am_michael', 1.08), ('4-kokoro-onyx', 'am_onyx', 1.08)]:
        a = np.concatenate([r.audio.cpu().numpy() for r in p(TEXT, voice=voice, speed=speed) if r.audio is not None])
        sf.write(f'{out}/{name}.wav', a, 24000); print('ok', name, flush=True)

else:
    import torch, torchaudio as ta
    torch.set_num_threads(os.cpu_count() or 4)
    from chatterbox.tts import ChatterboxTTS
    m = ChatterboxTTS.from_pretrained(device='cpu')
    for name, ex, cfg in [('5-chatterbox-normal', 0.5, 0.5), ('6-chatterbox-excited', 0.75, 0.35), ('7-chatterbox-wild', 1.0, 0.3)]:
        try:
            parts = [m.generate(s, exaggeration=ex, cfg_weight=cfg) for s in
                     [TEXT[:TEXT.index('Otis jumps')], TEXT[TEXT.index('Otis jumps'):TEXT.index('You see')], TEXT[TEXT.index('You see'):]]]
            ta.save(f'{out}/{name}.wav', torch.cat(parts, dim=-1), m.sr); print('ok', name, flush=True)
        except Exception as e: print('FAILED', name, e, flush=True)
    try:
        from chatterbox.tts_turbo import ChatterboxTurboTTS
        t = ChatterboxTurboTTS.from_pretrained(device='cpu')
        ref = f'{out}/6-chatterbox-excited.wav'
        wav = t.generate(TEXT.replace("Otis jumps up.", "Otis jumps up [gasp]."), audio_prompt_path=ref)
        ta.save(f'{out}/8-chatterbox-turbo.wav', wav, t.sr); print('ok turbo', flush=True)
    except Exception as e: print('FAILED turbo', e, flush=True)
