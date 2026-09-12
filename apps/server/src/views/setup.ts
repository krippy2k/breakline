import { escapeHtml } from "./escape.js";

export function renderSetupPage(input: { account: string; repositories: Array<{ name: string }> }): string {
  const repos =
    input.repositories.length > 0
      ? input.repositories.map((repo) => `<li>✓ ${escapeHtml(repo.name)}</li>`).join("")
      : "<li>No repositories selected yet.</li>";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Breakline is connected</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 40px auto; max-width: 640px; color: #111; }
    h1 { font-size: 1.5rem; }
    ul { padding-left: 1.2rem; }
  </style>
</head>
<body>
  <h1>Breakline is connected.</h1>
  <p>Organization: ${escapeHtml(input.account)}</p>
  <p>Repositories:</p>
  <ul>${repos}</ul>
  <p>Breakline will analyze new and updated pull requests.</p>
</body>
</html>`;
}
