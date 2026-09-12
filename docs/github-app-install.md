# Install and configure the Breakline GitHub App

This guide walks through creating a GitHub App, connecting it to a local Breakline server, installing it on a repository, and confirming that pull requests receive a Breakline check.

Breakline analyzes TypeScript and JavaScript pull requests and posts a **Breakline** check with behavioral impact. It does not execute repository code.

---

## What you will set up

```text
You create a GitHub App
        ↓
You start Breakline locally
        ↓
You expose /api/github/webhooks with a tunnel
        ↓
You install the app on a test repository
        ↓
A pull request creates a Breakline check
```

You need:

- Node.js 20 or later
- [pnpm](https://pnpm.io/)
- Git
- A GitHub account that can create a GitHub App and install it on a test repository
- A public HTTPS URL for webhooks (ngrok, Cloudflare Tunnel, smee.io, or similar)

---

## 1. Clone and build Breakline

From the Breakline repository:

```bash
pnpm install
pnpm build
```

Confirm the server package is present:

```bash
pnpm --filter @breakline/server test
```

---

## 2. Choose URLs

Pick three URLs before you create the app.

| Purpose | Local development value |
| --- | --- |
| Homepage | `http://localhost:3000` |
| Setup / post-install page | `http://localhost:3000/github/setup` |
| Webhook | `https://<your-tunnel-host>/api/github/webhooks` |

The setup page is opened in your browser after installation, so `localhost` is fine.

The webhook is called by GitHub's servers, so it **cannot** be `localhost`. Create the tunnel in [step 5](#5-expose-the-webhook) and paste that HTTPS URL into the GitHub App form.

If you already know your tunnel host, use it now. Otherwise create the app with a placeholder webhook URL and update it after the tunnel starts.

---

## 3. Create the GitHub App

1. Sign in to GitHub.
2. Open [GitHub Developer Settings → GitHub Apps](https://github.com/settings/apps)  
   For an organization app, open the organization **Settings → Developer settings → GitHub Apps**.
3. Click **New GitHub App**.
4. Fill in the identity fields:

   | Field | Value |
   | --- | --- |
   | **GitHub App name** | `Breakline Dev` (must be unique on GitHub) |
   | **Homepage URL** | `http://localhost:3000` |
   | **Identifying and authorizing users** | Leave callback URL empty. Breakline v0.4 does not use OAuth. |
   | **Expire user authorization tokens** | Leave the default. |
   | **Request user authorization (OAuth) during installation** | Unchecked |
   | **Webhook** | Checked (**Active**) |
   | **Webhook URL** | `https://<your-tunnel-host>/api/github/webhooks` |
   | **Webhook secret** | A long random string. Save this; it becomes `GITHUB_WEBHOOK_SECRET`. |
   | **SSL verification** | Enable |

5. Under **Post installation**, set:

   | Field | Value |
   | --- | --- |
   | **Setup URL** | `http://localhost:3000/github/setup` |
   | **Redirect on update** | Optional. Check it if you want GitHub to return to the setup page when the installation changes. |

6. Under **Where can this GitHub App be installed?**, choose **Only on this account** for a personal development app.

Do not create the app yet. Set permissions and events first.

---

## 4. Set permissions and events

### Repository permissions

Set only these:

| Permission | Access | Why |
| --- | --- | --- |
| **Checks** | Read & write | Create and update the Breakline check run |
| **Contents** | Read | Fetch the pull request base and head trees |
| **Metadata** | Read | Required by GitHub for repository access |
| **Pull requests** | Read | Read PR metadata and commit SHAs |

If you want Breakline to leave a persistent PR comment (`github.comment: true` in `breakline.yml`), also set:

| Permission | Access | Why |
| --- | --- | --- |
| **Issues** | Read & write | PR comments use the Issues API |

Leave these unset:

- Administration
- Actions / Workflows
- Secrets
- Deployments
- Members
- Organization administration

### Subscribe to events

Check only:

- **Pull request**
- **Installation**
- **Installation repositories**

Breakline handles these pull request actions: `opened`, `reopened`, `synchronize`, and `ready_for_review`.

### Create the app

Click **Create GitHub App**.

On the app page, copy the **App ID**. That value is `GITHUB_APP_ID`.

---

## 5. Generate a private key

1. On the app page, scroll to **Private keys**.
2. Click **Generate a private key**.
3. GitHub downloads a `.pem` file. Store it outside the repository, or keep it locally and do not commit it (`.pem` files are gitignored).
4. You will point Breakline at this file with `GITHUB_APP_PRIVATE_KEY_PATH`.

Never commit the key. Never paste it into logs, issues, or chat.

---

## 6. Expose the webhook

GitHub must reach `POST /api/github/webhooks` over HTTPS.

Start a tunnel to local port `3000`. Examples:

**ngrok**

```bash
ngrok http 3000
```

Use the `https://…ngrok-free.app` (or similar) host.

**Cloudflare Tunnel**

```bash
cloudflared tunnel --url http://localhost:3000
```

**smee.io**

1. Open [https://smee.io](https://smee.io) and start a channel.
2. Forward it to Breakline:

```bash
smee --url https://smee.io/<id> --path /api/github/webhooks --port 3000
```

Then set the GitHub App **Webhook URL** to:

```text
https://<your-tunnel-host>/api/github/webhooks
```

If you created the app with a placeholder, open the app settings and update **Webhook URL**, then click **Save changes**.

---

## 7. Configure Breakline environment variables

The server reads process environment variables. It does not load `.env` automatically.

`.env.example` is a reference. The required variables are:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GITHUB_APP_ID` | Yes | Numeric App ID from the GitHub App page |
| `GITHUB_APP_PRIVATE_KEY` or `GITHUB_APP_PRIVATE_KEY_PATH` | Yes | App private key PEM, or a path to the downloaded `.pem` |
| `GITHUB_WEBHOOK_SECRET` | Yes | The webhook secret you entered in GitHub |
| `BREAKLINE_BASE_URL` | Recommended | Public or local base URL used in “View full report” links |
| `DATABASE_URL` | Optional | Persistence file. Defaults to in-memory if unset. |
| `PORT` | Optional | HTTP port. Defaults to `3000`. |

`GITHUB_APP_PRIVATE_KEY_PATH` is the easiest option, especially on Windows.

### Windows PowerShell

```powershell
$env:GITHUB_APP_ID = "123456"
$env:GITHUB_APP_PRIVATE_KEY_PATH = "C:\keys\breakline-app.pem"
$env:GITHUB_WEBHOOK_SECRET = "the-secret-you-entered-in-github"
$env:BREAKLINE_BASE_URL = "http://localhost:3000"
$env:DATABASE_URL = "file:./data/breakline.json"
$env:PORT = "3000"
```

If you prefer to paste the PEM into the environment, use `GITHUB_APP_PRIVATE_KEY` and keep the `-----BEGIN … PRIVATE KEY-----` block intact. Escaped `\n` newlines are also accepted.

### macOS / Linux

```bash
export GITHUB_APP_ID=123456
export GITHUB_APP_PRIVATE_KEY_PATH="$HOME/keys/breakline-app.pem"
export GITHUB_WEBHOOK_SECRET="the-secret-you-entered-in-github"
export BREAKLINE_BASE_URL=http://localhost:3000
export DATABASE_URL=file:./data/breakline.json
export PORT=3000
```

`BREAKLINE_BASE_URL` is written into GitHub Check details links:

```text
{BREAKLINE_BASE_URL}/r/github/{owner}/{repo}/pull/{number}/analysis/{id}
```

For local-only review, `http://localhost:3000` is enough. If other people need to open the report from GitHub, use a publicly reachable base URL.

---

## 8. Start the Breakline server

In the same terminal where the environment variables are set:

```bash
pnpm dev:github
```

You should see a structured log line such as:

```json
{"level":"info","event":"server_started","port":3000}
```

Check that the process is up:

```bash
curl http://localhost:3000/health
```

A JSON body with `"ok": true` means the server is running.

Leave this process running. Webhooks are rejected if the server or tunnel is down.

---

## 9. Deliver a ping to the webhook

1. Open the GitHub App settings.
2. Confirm **Webhook URL** is `https://<tunnel>/api/github/webhooks` and the secret matches `GITHUB_WEBHOOK_SECRET`.
3. Click **Recent Deliveries** (or send a ping from the webhook section).

GitHub sends a `ping` event. Breakline accepts it with HTTP 202.

If the delivery fails:

- **404** — the tunnel path is wrong. The path must be `/api/github/webhooks`.
- **401** — `GITHUB_WEBHOOK_SECRET` does not match the secret configured on the app.
- **Connection error** — the tunnel or `pnpm dev:github` is not running.

---

## 10. Install the app on a repository

1. Open the GitHub App page.
2. Click **Install App**.
3. Choose your user or organization.
4. Select **Only select repositories** and pick one test repository, or allow all repositories.
5. Click **Install**.

GitHub redirects the browser to:

```text
http://localhost:3000/github/setup?installation_id=<id>
```

You should see a short confirmation page listing the account and repositories. If the server was not running, start it and reload that URL.

The `installation` webhook also records the installation. Either path is enough for Breakline to know the app is connected.

You can change the repository list later from **GitHub → Settings → Applications → Installed GitHub Apps → Breakline Dev → Configure**.

---

## 11. Optional: repository `breakline.yml`

Breakline looks in the **head** revision of the pull request for one of:

- `breakline.yml`
- `.breakline.yml`
- `breakline.config.json`
- `.breakline.json`

If none exist, these defaults apply:

```yaml
version: 1

github:
  enabled: true
  comment: false
  annotations: true
  analyzeDrafts: true

analysis:
  minConfidence: medium
  maxChangedFiles: 200
  impact: true

report:
  maxGithubFindings: 5
```

Useful settings:

| Setting | Default | Effect |
| --- | --- | --- |
| `github.enabled` | `true` | Set `false` to skip analysis for that repository |
| `github.comment` | `false` | Set `true` to keep one PR comment updated in place (`<!-- breakline-report -->`). Requires the Issues read & write permission. |
| `github.annotations` | `true` | Inline check annotations for high-confidence findings (capped at 10) |
| `github.analyzeDrafts` | `true` | Set `false` to skip draft pull requests |
| `analysis.minConfidence` | `medium` | Hide findings below this confidence |
| `report.maxGithubFindings` | `5` | How many findings appear in the GitHub check summary |

Example that enables the optional PR comment:

```yaml
version: 1

github:
  comment: true
```

Commit this file on the branch being analyzed. Configuration is read from the pull request head, not from the Breakline server.

---

## 12. Verify with a pull request

1. In an installed repository, open a pull request that changes TypeScript or JavaScript.
2. GitHub sends `pull_request.opened` to Breakline.
3. The PR **Checks** tab should show **Breakline** as in progress, then completed.

Expected completed check:

- Title such as `High behavioral impact` or `No significant behavioral findings`
- A short markdown summary (impact, finding counts, key findings)
- A **View full report in Breakline** link when `BREAKLINE_BASE_URL` is set

The check is informational. Findings complete as `neutral` (or `success` when there are none). A `failure` conclusion means Breakline could not analyze the PR, not that findings exist.

Push another commit to the same PR. That sends `synchronize`. Breakline analyzes the new head SHA and updates the visible result. It will not publish an older SHA over a newer one.

Open the hosted report:

```text
http://localhost:3000/r/github/{owner}/{repo}/pull/{number}/analysis/{id}
```

---

## 13. Confirm the end-to-end path

The install is working when all of these are true:

1. The GitHub App is installed on the test repository.
2. Opening a supported PR creates a Breakline check.
3. The check moves from in progress to completed.
4. The summary shows impact and findings (or “no significant findings”).
5. The details link opens the Breakline report page.
6. A second commit creates a new analysis for the new head SHA.
7. No extra Breakline PR comments appear unless `github.comment` is enabled. If comments are enabled, the same comment is updated.

---

## Troubleshooting

**Webhook deliveries show 401**  
The secret on the GitHub App does not match `GITHUB_WEBHOOK_SECRET`. They must be identical.

**Check never appears**  
Confirm the app is installed on that repository, the webhook is Active, `Pull request` events are subscribed, and both the tunnel and `pnpm dev:github` are running. Check **Recent Deliveries** on the app.

**Check fails with “Repository fetch failed”**  
Contents permission must be Read. For private repos, the installation must include that repository. The server host must be able to run `git fetch` to GitHub.

**Report link does not open**  
`BREAKLINE_BASE_URL` must match a URL you can reach. For local use that is `http://localhost:3000`. The analysis record must still be in the store (`DATABASE_URL=file:./data/breakline.json` persists across restarts; in-memory storage does not).

**Draft PRs are skipped**  
`github.analyzeDrafts` is `false` in the repository config. The default is to analyze drafts.

**Want a PR comment**  
Set `github.comment: true` in `breakline.yml` and grant the app **Issues: Read & write**. Breakline updates one comment that contains `<!-- breakline-report -->`.

**Private key errors on startup**  
Use `GITHUB_APP_PRIVATE_KEY_PATH` and point it at the downloaded `.pem`. If you use `GITHUB_APP_PRIVATE_KEY`, include the full PEM header and footer.

**Server exits with “Missing required environment variable”**  
`GITHUB_APP_ID`, the private key, and `GITHUB_WEBHOOK_SECRET` must be set in the same shell that runs `pnpm dev:github`.

---

## Related

- [GitHub App development notes](github-app-development.md)
- [v0.4 specification](../spec/v0.4.md)
