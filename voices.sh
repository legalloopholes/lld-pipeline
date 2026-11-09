#!/bin/bash
# Legal Loopholes Daily - render a voice audition (posts nothing). Runs from the voice-audition branch; main is untouched.
#   bash ~/.n8n-files/lld-pipeline/voices.sh
# Samples land on the voice-samples branch:
#   https://github.com/legalloopholes/lld-pipeline/tree/voice-samples
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"
git switch -q voice-audition
mkdir -p .github/workflows && cp tools/voices.yml .github/workflows/voices.yml
git add -A
git -c user.name="legalloopholes" -c user.email="legalloopholes@users.noreply.github.com" commit -q -m "Voice audition" || echo "Nothing new to commit."
git push -q -u origin voice-audition    # the push starts the workflow
echo "Voice audition started (about 20-40 minutes, posts nothing)."
