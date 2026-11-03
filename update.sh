#!/bin/bash
# Legal Loopholes Daily - upload changes made in ~/.n8n-files/lld-pipeline to GitHub and start a test run (posts nothing).
#   bash ~/.n8n-files/lld-pipeline/update.sh
# Does not touch secrets or the LIVE switch.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
REPO=legalloopholes/lld-pipeline
cd "$(dirname "$0")"
git add -A
git -c user.name="legalloopholes" -c user.email="legalloopholes@users.noreply.github.com" commit -q -m "${1:-Pipeline update}" || echo "Nothing new to commit."
git -c user.name="legalloopholes" -c user.email="legalloopholes@users.noreply.github.com" pull -q --rebase origin main
git push -q origin main
echo "Uploaded."
gh workflow run post.yml -R "$REPO" -f mode=test
echo "Test run started (about 30 minutes, posts nothing): https://github.com/$REPO/actions"
