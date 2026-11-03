#!/bin/bash
# Legal Loopholes Daily - one-time setup of the GitHub version of the pipeline. Run in Terminal:
#   bash ~/.n8n-files/lld-pipeline/setup.sh
# What it does: logs you into GitHub (in your browser), creates the public repo legalloopholes/lld-pipeline,
# uploads the pipeline code, copies your existing logins (TikTok, Facebook/Instagram, lld-media, and the Google Sheets
# and YouTube logins stored in n8n) into the repo's encrypted GitHub Secrets, and starts one TEST run.
# Nothing is posted by the test run. Your Mac keeps posting until you run cutover.sh.
set -euo pipefail
export PATH="$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
REPO=legalloopholes/lld-pipeline
DIR="$(cd "$(dirname "$0")" && pwd)"
S="$HOME/.n8n-files/secrets"

command -v brew >/dev/null || { echo "Homebrew is needed (https://brew.sh)."; exit 1; }
command -v gh >/dev/null || { echo "Installing the GitHub command-line tool..."; brew install gh; }

if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo; echo "== GitHub login: a code will be shown; press Enter, then paste it in the browser and approve =="
  gh auth login -h github.com -p https -w -s workflow
fi
if ! gh api -i user 2>/dev/null | grep -i '^x-oauth-scopes:' | grep -q workflow; then
  echo; echo "== GitHub needs one more permission (to upload the workflow file); approve it in the browser =="
  gh auth refresh -h github.com -s workflow
fi
ME=$(gh api user --jq .login)
[ "$ME" = "legalloopholes" ] || { echo "You are logged into GitHub as '$ME'. Run: gh auth login   and use the legalloopholes account."; exit 1; }
gh auth setup-git

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "Creating public repo $REPO ..."
  gh repo create "$REPO" --public --description "Legal Loopholes Daily - automatic video pipeline (GitHub Actions)"
fi

cd "$DIR"
[ -d .git ] || { git init -q -b main; git remote add origin "https://github.com/$REPO.git"; }
git add -A
git -c user.name="legalloopholes" -c user.email="legalloopholes@users.noreply.github.com" commit -q -m "Pipeline update" || true
git fetch -q origin main 2>/dev/null && git -c user.name="legalloopholes" -c user.email="legalloopholes@users.noreply.github.com" pull -q --rebase origin main || true
git push -q -u origin main
echo "Code uploaded."

echo "Copying logins into GitHub Secrets (encrypted; never shown)..."
for f in tiktok meta github; do [ -f "$S/$f.json" ] || { echo "Missing $S/$f.json"; exit 1; }; done
gh secret set TIKTOK_JSON   -R "$REPO" < "$S/tiktok.json"
gh secret set META_JSON     -R "$REPO" < "$S/meta.json"
gh secret set GH_MEDIA_JSON -R "$REPO" < "$S/github.json"
gh secret list -R "$REPO" | grep -q '^STATE_KEY' || openssl rand -hex 32 | gh secret set STATE_KEY -R "$REPO"

N8N=$(command -v n8n || true)
[ -n "$N8N" ] || { echo "Could not find the n8n command (looked in ~/.npm-global/bin and PATH)."; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
"$N8N" export:credentials --id=hlHt3cI7CKiFJclU --decrypted --output="$T/sheets.json" >/dev/null 2>&1 || { echo "n8n could not export the Google Sheets login."; exit 1; }
"$N8N" export:credentials --id=kMOfYqtVKcaZNkL2 --decrypted --output="$T/youtube.json" >/dev/null 2>&1 || { echo "n8n could not export the YouTube login."; exit 1; }
pick() { python3 - "$1" <<'PY'
import json, sys
d = json.load(open(sys.argv[1])); d = d[0] if isinstance(d, list) else d; c = d['data']
t = c.get('oauthTokenData') or {}
if not t.get('refresh_token'): sys.exit('no refresh token in this n8n login - reconnect it in n8n first')
print(json.dumps({'client_id': c['clientId'], 'client_secret': c['clientSecret'], 'refresh_token': t['refresh_token']}))
PY
}
pick "$T/sheets.json"  | gh secret set GOOGLE_SHEETS_JSON -R "$REPO"
pick "$T/youtube.json" | gh secret set YOUTUBE_JSON       -R "$REPO"
rm -rf "$T"

gh variable set LIVE --body false -R "$REPO"
echo "Secrets saved. Scheduled posting from GitHub stays OFF until cutover.sh."
sleep 3
gh workflow run post.yml -R "$REPO" -f mode=test
echo; echo "Test run started (takes about 30-45 minutes, posts nothing): https://github.com/$REPO/actions"
