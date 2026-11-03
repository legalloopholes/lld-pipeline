#!/bin/bash
# Legal Loopholes Daily - switch posting from the Mac (n8n) to GitHub. Run in Terminal AFTER n8n's
# "LLD v2 (scheduled)" workflow has been turned off:   bash ~/.n8n-files/lld-pipeline/cutover.sh
# It copies the Mac's newest TikTok login (TikTok renews it at every post) and turns scheduled posting on.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
REPO=legalloopholes/lld-pipeline
gh secret set TIKTOK_JSON -R "$REPO" < "$HOME/.n8n-files/secrets/tiktok.json"
gh variable set LIVE --body true -R "$REPO"
echo "GitHub now posts at 12:00 and 7:00 pm New York time. Your Mac can sleep."
echo "To pause GitHub posting:  gh variable set LIVE --body false -R $REPO"
