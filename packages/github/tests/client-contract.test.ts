import { describe, expect, it } from "vitest";
import { createGitHubClient } from "../src/api/client.js";
import { createOrUpdateComment } from "../src/api/comments.js";
import { COMMENT_MARKER } from "../src/render/comment.js";

describe("GitHub API client contracts", () => {
  it("creates and updates check runs with the expected payloads", async () => {
    const calls: Array<{ method: string; url: string; body: unknown }> = [];
    const client = createGitHubClient({
      token: "install-token",
      fetchImpl: async (url, init) => {
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ method: String(init?.method), url: String(url), body });
        if (String(init?.method) === "POST") {
          return json({ id: 77, name: "Breakline", head_sha: "bbb", status: "in_progress" });
        }
        return json({});
      },
    });

    const created = await client.createCheckRun({
      owner: "acme",
      repo: "payments",
      name: "Breakline",
      headSha: "bbb",
      status: "in_progress",
      startedAt: "2026-09-11T18:00:00.000Z",
      output: { title: "Breakline analysis", summary: "Analyzing behavioral impact..." },
    });
    expect(created.id).toBe(77);
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "https://api.github.com/repos/acme/payments/check-runs",
      body: {
        name: "Breakline",
        head_sha: "bbb",
        status: "in_progress",
        output: { title: "Breakline analysis", summary: "Analyzing behavioral impact..." },
      },
    });

    await client.updateCheckRun({
      owner: "acme",
      repo: "payments",
      checkRunId: 77,
      status: "completed",
      conclusion: "neutral",
      detailsUrl: "https://app.breakline.dev/r/1",
      output: { title: "High behavioral impact", summary: "## Breakline Report" },
    });
    expect(calls[1]).toMatchObject({
      method: "PATCH",
      url: "https://api.github.com/repos/acme/payments/check-runs/77",
      body: {
        status: "completed",
        conclusion: "neutral",
        details_url: "https://app.breakline.dev/r/1",
      },
    });
  });

  it("updates an existing Breakline comment instead of creating another", async () => {
    const calls: string[] = [];
    const client = createGitHubClient({
      token: "install-token",
      fetchImpl: async (url, init) => {
        calls.push(`${init?.method} ${url}`);
        if (String(url).endsWith("/comments?per_page=100")) {
          return json([
            { id: 1, body: "human review" },
            { id: 9, body: `${COMMENT_MARKER}\n## Breakline Analysis\nold` },
          ]);
        }
        return json({ id: 9, body: "updated" });
      },
    });
    await createOrUpdateComment(client, {
      owner: "acme",
      repo: "payments",
      number: 184,
      body: `${COMMENT_MARKER}\nnew`,
    });
    expect(calls.some((call) => call.startsWith("PATCH") && call.includes("/issues/comments/9"))).toBe(true);
    expect(calls.some((call) => call.startsWith("POST") && call.includes("/issues/184/comments"))).toBe(false);
  });

  it("requests an installation token from the GitHub App endpoint", async () => {
    const { createGitHubTokenClient } = await import("../src/app/installation-token.js");
    const calls: Array<{ url: string; auth?: string | null }> = [];
    const client = createGitHubTokenClient(async (url, init) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(url), auth: headers.get("authorization") });
      return json({ token: "ghs_xxx", expires_at: "2026-09-11T19:00:00.000Z" });
    });
    const issued = await client.requestToken(42, "jwt-token");
    expect(issued.token).toBe("ghs_xxx");
    expect(calls[0]?.url).toBe("https://api.github.com/app/installations/42/access_tokens");
    expect(calls[0]?.auth).toBe("Bearer jwt-token");
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
