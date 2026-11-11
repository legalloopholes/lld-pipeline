"""Legal Loopholes Daily - shared text tools for the voice and caption checks.

- tokens(text): the words of a script as display tokens ("Gary's", "fifty", "Death.") with a normalized key each.
- heard(audio, sr): Parakeet speech-to-text -> [[word, start_seconds], ...].
- score(expected, heard): how well a take says the expected words (1.0 = every word, nothing extra).
- align(expected_tokens, heard_words): script words get the recognizer's timings; unmatched runs are spread
  evenly between their matched neighbours. Captions therefore always show the script's words.
Numbers: the recognizer writes digits ("50", "30th"), scripts write words; both sides are mapped to words.
"""
import os, re, difflib
import numpy as np

MODEL = os.path.expanduser('~/.n8n-files/aligner-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8/')
_rec = None

ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split()
ORD = {'one': 'first', 'two': 'second', 'three': 'third', 'five': 'fifth', 'eight': 'eighth', 'nine': 'ninth', 'twelve': 'twelfth'}


def num_words(n):
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ('' if n % 10 == 0 else ' ' + ONES[n % 10])
    if n < 1000: return ONES[n // 100] + ' hundred' + ('' if n % 100 == 0 else ' ' + num_words(n % 100))
    for div, name in ((10 ** 9, 'billion'), (10 ** 6, 'million'), (1000, 'thousand')):
        if n >= div: return num_words(n // div) + ' ' + name + ('' if n % div == 0 else ' ' + num_words(n % div))


def ordinal(words):
    *head, last = words.split()
    if last in ORD: last = ORD[last]
    elif last.endswith('y'): last = last[:-1] + 'ieth'
    else: last += 'th'
    return ' '.join(head + [last])


def spoken_keys(word):
    """normalized key(s) one written word stands for: "50-square-mile" -> fifty square mile, "30th" -> thirtieth"""
    w = word.lower().replace('’', "'").replace('%', ' percent').replace('$', '')
    out = []
    for part in re.split(r"[-–—/\s]+", w):
        m = re.fullmatch(r"(\d{1,3}(?:,\d{3})+|\d+)(st|nd|rd|th|s)?", re.sub(r"[^\w,]", '', part).strip(','))
        if m:
            n = int(m.group(1).replace(',', ''))
            if 1100 <= n <= 2099 and n % 100 and m.group(2) in (None, 's'):          # years: "1872" -> eighteen seventy two
                ws = num_words(n // 100) + ' ' + num_words(n % 100)
            else:
                ws = num_words(n)
            if m.group(2) in ('st', 'nd', 'rd', 'th'): ws = ordinal(ws)
            out += ws.split()
        else:
            part = re.sub(r"'(d|ll|ve|re)$", '', part)              # the recognizer often drops these ("you'd" -> "you")
            k = re.sub(r'[^a-z0-9]', '', part)
            if k: out.append(k)
    return out


def tokens(text):
    """display words of a text with their keys: [(display, [keys...]), ...]"""
    text = re.sub(r'\[[^\]]*\]', ' ', text)
    return [(w, spoken_keys(w)) for w in text.split() if spoken_keys(w)]


def keys_of(text_or_tokens):
    toks = tokens(text_or_tokens) if isinstance(text_or_tokens, str) else text_or_tokens
    return [k for _, ks in toks for k in ks]


def recognizer():
    global _rec
    if _rec is None:
        import sherpa_onnx
        _rec = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=MODEL + 'encoder.int8.onnx', decoder=MODEL + 'decoder.int8.onnx',
            joiner=MODEL + 'joiner.int8.onnx', tokens=MODEL + 'tokens.txt',
            model_type='nemo_transducer', num_threads=4)
    return _rec


def heard(audio, sr):
    """speech-to-text with word start times; audio float32 or int16 mono"""
    x = audio.astype(np.float32) / (32768.0 if audio.dtype == np.int16 else 1.0)
    if sr != 16000: x = np.interp(np.arange(0, len(x), sr / 16000), np.arange(len(x)), x).astype(np.float32)
    rec = recognizer(); words = []
    step = 16000 * 25                                   # long audio in ~25 s pieces cut at the quietest spot
    fr = 320; i = 0
    while i < len(x):
        j = min(len(x), i + step)
        if j < len(x):
            lo, hi = i + step - 16000 * 4, min(len(x), i + step + 16000 * 2)
            env = [np.abs(x[k:k + fr]).mean() for k in range(lo, hi - fr, fr)]
            j = lo + int(np.argmin(env)) * fr
        s = rec.create_stream(); s.accept_waveform(16000, x[i:j]); rec.decode_stream(s)
        for tok, ts in zip(s.result.tokens, s.result.timestamps):
            if tok.startswith((' ', '▁')) or not words: words.append([tok.strip(' ▁'), ts + i / 16000])
            else: words[-1][0] += tok
        i = j
    return [w for w in words if spoken_keys(w[0])]


LETTERS = {'b': 'bee', 'c': 'see', 'u': 'you', 'r': 'are', 'y': 'why', 't': 'tea', 'o': 'oh', 'q': 'queue', 'j': 'jay'}


def heard_keys(words):
    out = []
    for w, t in words:
        for k in spoken_keys(w): out.append((LETTERS.get(k, k), t))
    return out


def same_sound(a, b):
    """the same words written differently: "bumble bee" / "bumblebee", "text" / "texts" is NOT the same"""
    return ''.join(a) == ''.join(b)


def opcodes(exp, got):
    """difflib opcodes where a "replace" that is only a spacing difference counts as equal"""
    out = []
    for op, a1, a2, b1, b2 in difflib.SequenceMatcher(None, exp, got, autojunk=False).get_opcodes():
        if op == 'replace' and same_sound(exp[a1:a2], got[b1:b2]): op = 'equal'
        out.append((op, a1, a2, b1, b2))
    return out


def score(expected_text, words):
    """fraction of expected words said, minus extra words; plus the list of differences"""
    exp = keys_of(expected_text); got = [k for k, _ in heard_keys(words)]
    ops = opcodes(exp, got)
    match = sum(a2 - a1 for op, a1, a2, b1, b2 in ops if op == 'equal')
    seen = sum(b2 - b1 for op, a1, a2, b1, b2 in ops if op == 'equal')
    diffs = [(' '.join(exp[a1:a2]), ' '.join(got[b1:b2])) for op, a1, a2, b1, b2 in ops if op != 'equal']
    return (match - max(0, len(got) - seen) * 0.5) / max(1, len(exp)), diffs


def align(toks, words, total=None):
    """start time for every script token (display words), using the recognizer's timings where the words agree"""
    flat = [(i, k) for i, (_, ks) in enumerate(toks) for k in ks]
    hk = heard_keys(words)
    sm = difflib.SequenceMatcher(None, [k for _, k in flat], [k for k, _ in hk], autojunk=False)
    start = [None] * len(toks)
    for a, b, n in sm.get_matching_blocks():
        for d in range(n):
            ti = flat[a + d][0]
            if start[ti] is None: start[ti] = hk[b + d][1]
    known = [i for i, s_ in enumerate(start) if s_ is not None]
    if not known: return [None] * len(toks), 0.0
    end_t = total if total is not None else hk[-1][1] + 0.4
    i = 0
    while i < len(toks):                                   # spread each unmatched run between its anchors, by word length
        if start[i] is not None: i += 1; continue
        j = i
        while j < len(toks) and start[j] is None: j += 1
        lo, hi = (i - 1 if i > 0 else None), (j if j < len(toks) else None)
        t0 = start[lo] if lo is not None else 0.0
        t1 = start[hi] if hi is not None else max(end_t, t0 + 0.3 * (j - i))
        items = ([lo] if lo is not None else []) + list(range(i, j))
        w = [max(2, len(toks[k][0])) for k in items]; tot = sum(w); cum = 0
        for k, wk in zip(items, w):
            if k != lo: start[k] = t0 + (t1 - t0) * cum / tot
            cum += wk
        i = j
    for k in range(1, len(start)):                         # keep them in order
        if start[k] <= start[k - 1]: start[k] = start[k - 1] + 0.05
    return start, len(known) / len(toks)


def confirmed_diffs(audio, sr, spoken, words=None):
    """words the full-read recognizer got wrong that are STILL wrong when their own few seconds are re-checked.
    Returns [(token_index, display_word, start_seconds, heard_in_clip)]. Context-free misses (phone/bone) drop out."""
    toks = tokens(spoken)
    if words is None: words = heard(audio, sr)
    flat = [(i, k) for i, (_, ks) in enumerate(toks) for k in ks]
    hk = heard_keys(words)
    starts, _ = align(toks, words, len(audio) / sr)
    bad = sorted({flat[j][0] for op, a1, a2, b1, b2 in opcodes([k for _, k in flat], [k for k, _ in hk])
                  if op in ('replace', 'delete') for j in range(a1, a2)})
    out = []
    for i in bad:
        t = starts[i] or 0.0; want = toks[i][1]; got = ''
        for lo, hi in ((1.8, 1.6), (2.6, 1.0), (1.0, 2.4)):           # three windows: any one hearing it right is enough
            g = [k for k, _ in heard_keys(heard(audio[int(max(0, t - lo) * sr):int((t + hi) * sr)], sr))]
            got = ' '.join(g)
            if all(k in g for k in want) or ''.join(want) in ''.join(g) and len(''.join(want)) >= 3: break
        else: out.append((i, toks[i][0], round(t, 2), got))
    return out
