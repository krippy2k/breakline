import { describe, expect, it } from "vitest";
import { normalizeEvent } from "../src/webhooks/normalize.js";
import { createAnalysisJob } from "../src/webhooks/pull-request.js";

const repository = {
  id: 99,
  name: "payments",
  full_name: "acme/payments",
  private: true,
  owner: { id: 1, login: "acme" },
};

const pullRequest = {
  id: 500,
  number: 184,
  draft: false,
  state: "open",
  base: { sha: "aaa1111", ref: "main", repo: repository },
  head: { sha: "bbb2222", ref: "feature", repo: repository },
};

describe("normalizeEvent", () => {
  it("normalizes supported pull request actions", () => {
    for (const action of ["opened", "reopened", "synchronize", "ready_for_review"] as const) {
      const event = normalizeEvent("pull_request", {
        action,
        number: 184,
        pull_request: pullRequest,
        repository,
        installation: { id: 42 },
      });
      expect(event.kind).toBe("pull_request");
      if (event.kind === "pull_request") {
        expect(event.action).toBe(action);
        expect(createAnalysisJob(event)).toEqual({
          installationId: 42,
          repositoryId: 99,
          owner: "acme",
          repo: "payments",
          pullRequestNumber: 184,
          pullRequestId: 500,
          baseSha: "aaa1111",
          headSha: "bbb2222",
          draft: false,
        });
      }
    }
  });

  it("ignores unsupported pull request actions", () => {
    expect(
      normalizeEvent("pull_request", {
        action: "closed",
        pull_request: pullRequest,
        repository,
        installation: { id: 42 },
      }).kind,
    ).toBe("ignored");
  });

  it("normalizes installation and repository events", () => {
    const created = normalizeEvent("installation", {
      action: "created",
      installation: { id: 7, account: { id: 1, login: "acme" } },
      repositories: [{ id: 99, name: "payments", full_name: "acme/payments", private: true }],
    });
    expect(created).toMatchObject({ kind: "installation", action: "created", installationId: 7 });

    const added = normalizeEvent("installation_repositories", {
      action: "added",
      installation: { id: 7, account: { id: 1, login: "acme" } },
      repositories_added: [{ id: 100, name: "web", full_name: "acme/web", private: false }],
    });
    expect(added).toMatchObject({ kind: "installation_repositories", action: "added" });
  });
});
