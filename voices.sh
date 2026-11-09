#!/bin/bash
# Legal Loopholes Daily - render a voice audition (posts nothing).
#   bash ~/.n8n-files/lld-pipeline/voices.sh
# Commits what's here, pushes this commit to the voice-audition-run branch (that push starts the audition),
# and the samples land on the voice-samples branch:
#   https://github.com/legalloopholes/lld-pipeline/tree/voice-samples
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"
mkdir -p .github/workflows && cp tools/voices.yml .github/workflows/voices.yml
git add -A
git -c user.name="legalloopholes" -c user.email="legalloopholes@users.noreply.github.com" commit -q -m "Voice audition" || echo "Nothing new to commit."
git push -q -f origin HEAD:voice-audition-run
echo "Voice audition started (about 15-40 minutes, posts nothing)."
