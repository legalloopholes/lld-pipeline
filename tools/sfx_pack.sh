#!/bin/bash
# Pack your own sound effects (assets/sfx/*.wav: vine boom, Metal Gear alert, quack, huh...) for the cloud renders.
# The repo is public, so the files go in encrypted (assets/sfx.tgz.enc). A new random key is made here and sent
# straight into the GitHub secret SFX_KEY; it is never printed or saved. Run it again whenever you add or change a sound.
#   bash tools/sfx_pack.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ls assets/sfx/*.wav >/dev/null
export SFX_KEY="$(openssl rand -hex 32)"
tar czf - -C assets sfx | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -salt -pass env:SFX_KEY -out assets/sfx.tgz.enc
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -pass env:SFX_KEY -in assets/sfx.tgz.enc | tar tzf - >/dev/null   # check it opens
printf %s "$SFX_KEY" | gh secret set SFX_KEY -R legalloopholes/lld-pipeline
unset SFX_KEY
git add assets/sfx.tgz.enc
git commit -q -m "Encrypted sound effects pack" && git push -q
echo "Done: $(ls assets/sfx/*.wav | wc -l | tr -d ' ') sounds packed, key saved in GitHub as SFX_KEY, pack pushed."
