import type { NormalizedEvent } from "../types/github-events.js";

export interface InstallationRecord {
  githubInstallationId: number;
  githubAccountId: number;
  githubAccountLogin: string;
  status: "active" | "suspended" | "deleted";
}

export interface RepositoryRecord {
  githubRepositoryId: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
}

export function installationFromEvent(
  event: Extract<NormalizedEvent, { kind: "installation" }>,
): { installation: InstallationRecord; repositories: RepositoryRecord[] } {
  const status =
    event.action === "deleted" ? "deleted" : event.action === "suspend" ? "suspended" : "active";
  return {
    installation: {
      githubInstallationId: event.installationId,
      githubAccountId: event.account.id,
      githubAccountLogin: event.account.login,
      status,
    },
    repositories: event.repositories.map((repo) => repositoryFromPayload(repo, event.account.login)),
  };
}

export function repositoriesFromEvent(
  event: Extract<NormalizedEvent, { kind: "installation_repositories" }>,
): { added: RepositoryRecord[]; removed: RepositoryRecord[] } {
  return {
    added: event.added.map((repo) => repositoryFromPayload(repo, event.account.login)),
    removed: event.removed.map((repo) => repositoryFromPayload(repo, event.account.login)),
  };
}

function repositoryFromPayload(
  repo: { id: number; name: string; full_name: string; private: boolean },
  accountLogin: string,
): RepositoryRecord {
  const [owner, name] = repo.full_name.split("/");
  return {
    githubRepositoryId: repo.id,
    owner: owner || accountLogin,
    name: name || repo.name,
    fullName: repo.full_name,
    private: repo.private,
  };
}
