export interface GitHubUser {
  id: number;
  login: string;
  type?: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubUser;
  clone_url?: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  draft?: boolean;
  state: string;
  title?: string;
  html_url?: string;
  base: {
    sha: string;
    ref: string;
    repo: GitHubRepository;
  };
  head: {
    sha: string;
    ref: string;
    repo: GitHubRepository | null;
  };
}

export interface PullRequestEvent {
  action: string;
  number: number;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  installation?: { id: number };
}

export interface InstallationEvent {
  action: string;
  installation: {
    id: number;
    account: GitHubUser;
    suspended_at?: string | null;
  };
  repositories?: Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  }>;
}

export interface InstallationRepositoriesEvent {
  action: string;
  installation: {
    id: number;
    account: GitHubUser;
  };
  repositories_added?: Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  }>;
  repositories_removed?: Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  }>;
}

export type NormalizedPullRequestAction = "opened" | "reopened" | "synchronize" | "ready_for_review";
export type NormalizedInstallationAction = "created" | "deleted" | "suspend" | "unsuspend";
export type NormalizedInstallationReposAction = "added" | "removed";

export type NormalizedEvent =
  | {
      kind: "pull_request";
      action: NormalizedPullRequestAction;
      installationId: number;
      repository: GitHubRepository;
      pullRequest: GitHubPullRequest;
    }
  | {
      kind: "installation";
      action: NormalizedInstallationAction;
      installationId: number;
      account: GitHubUser;
      repositories: NonNullable<InstallationEvent["repositories"]>;
    }
  | {
      kind: "installation_repositories";
      action: NormalizedInstallationReposAction;
      installationId: number;
      account: GitHubUser;
      added: NonNullable<InstallationRepositoriesEvent["repositories_added"]>;
      removed: NonNullable<InstallationRepositoriesEvent["repositories_removed"]>;
    }
  | { kind: "ignored"; event: string; action?: string };
