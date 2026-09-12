# GitHub App development

For the full install-and-configure walkthrough, see [Install and configure the Breakline GitHub App](github-app-install.md).

This page is a short reference for a development app.

## Create a development app

1. Open [GitHub Developer Settings](https://github.com/settings/apps) and create a new GitHub App.
2. Use these values:

| Field | Suggested value |
| --- | --- |
| App name | `Breakline Dev` |
| Homepage URL | `http://localhost:3000` |
| Setup URL / callback | `http://localhost:3000/github/setup` |
| Webhook URL | `https://<your-tunnel>/api/github/webhooks` |
| Webhook secret | a long random string |

3. Repository permissions:

| Permission | Access |
| --- | --- |
| Checks | Read & Write |
| Contents | Read |
| Metadata | Read |
| Pull requests | Read |
| Issues | Read & Write (only if you enable PR comments) |

Do not request administration, workflows, secrets, deployments, or organization administration.

4. Subscribe to events:

- `Pull request`
- `Installation`
- `Installation repositories`

5. Generate a private key and download the `.pem` file.

## Environment

Copy `.env.example` and set:

```text
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
BREAKLINE_BASE_URL=http://localhost:3000
DATABASE_URL=file:./data/breakline.json
PORT=3000
```

`GITHUB_APP_PRIVATE_KEY` may contain the PEM text, including escaped `\n` characters. You can also set `GITHUB_APP_PRIVATE_KEY_PATH` to the downloaded key file.

## Run locally

```bash
pnpm install
pnpm build
pnpm dev:github
```

Expose the webhook with a tunnel you already use (`ngrok`, Cloudflare Tunnel, or smee.io). Breakline does not embed a specific tunnel.

Install the app on a test account or organization, then open a TypeScript/JavaScript pull request. Breakline should create a `Breakline` check run and, when analysis finishes, link to:

```text
/r/github/{owner}/{repo}/pull/{number}/analysis/{id}
```

## Repository config

Optional `breakline.yml` in the analyzed repository:

```yaml
version: 1

github:
  enabled: true
  comment: false
  annotations: true
  analyzeDrafts: true

analysis:
  minConfidence: medium

report:
  maxGithubFindings: 5
```

## Security notes

- Every webhook is verified with `X-Hub-Signature-256`.
- Installation tokens stay in memory and are never written to the database or logs.
- Temporary clones live under the system temp directory and are deleted after analysis.
- Repository code is parsed, not executed. Breakline does not run install hooks or repository scripts.
