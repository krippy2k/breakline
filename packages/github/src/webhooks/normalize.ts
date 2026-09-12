import type {
  InstallationEvent,
  InstallationRepositoriesEvent,
  NormalizedEvent,
  NormalizedInstallationAction,
  NormalizedInstallationReposAction,
  NormalizedPullRequestAction,
  PullRequestEvent,
} from "../types/github-events.js";

const PR_ACTIONS = new Set<NormalizedPullRequestAction>([
  "opened",
  "reopened",
  "synchronize",
  "ready_for_review",
]);
const INSTALL_ACTIONS = new Set<NormalizedInstallationAction>(["created", "deleted", "suspend", "unsuspend"]);
const INSTALL_REPO_ACTIONS = new Set<NormalizedInstallationReposAction>(["added", "removed"]);

export function normalizeEvent(event: string, payload: unknown): NormalizedEvent {
  if (event === "pull_request") {
    const body = payload as PullRequestEvent;
    if (!PR_ACTIONS.has(body.action as NormalizedPullRequestAction) || !body.installation?.id || !body.pull_request) {
      return { kind: "ignored", event, action: body.action };
    }
    return {
      kind: "pull_request",
      action: body.action as NormalizedPullRequestAction,
      installationId: body.installation.id,
      repository: body.repository,
      pullRequest: body.pull_request,
    };
  }

  if (event === "installation") {
    const body = payload as InstallationEvent;
    if (!INSTALL_ACTIONS.has(body.action as NormalizedInstallationAction) || !body.installation?.id) {
      return { kind: "ignored", event, action: body.action };
    }
    return {
      kind: "installation",
      action: body.action as NormalizedInstallationAction,
      installationId: body.installation.id,
      account: body.installation.account,
      repositories: body.repositories ?? [],
    };
  }

  if (event === "installation_repositories") {
    const body = payload as InstallationRepositoriesEvent;
    if (!INSTALL_REPO_ACTIONS.has(body.action as NormalizedInstallationReposAction) || !body.installation?.id) {
      return { kind: "ignored", event, action: body.action };
    }
    return {
      kind: "installation_repositories",
      action: body.action as NormalizedInstallationReposAction,
      installationId: body.installation.id,
      account: body.installation.account,
      added: body.repositories_added ?? [],
      removed: body.repositories_removed ?? [],
    };
  }

  return { kind: "ignored", event };
}
