export interface CheckRun {
  id: number;
  name: string;
  head_sha: string;
  status: string;
  html_url?: string;
}

export interface CheckAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: "notice" | "warning" | "failure";
  message: string;
  title?: string;
}

export interface CreateCheckRunInput {
  owner: string;
  repo: string;
  name: string;
  headSha: string;
  status: "queued" | "in_progress" | "completed";
  startedAt?: string;
  completedAt?: string;
  conclusion?: string;
  detailsUrl?: string;
  output: {
    title: string;
    summary: string;
    annotations?: CheckAnnotation[];
  };
}

export interface UpdateCheckRunInput extends Omit<CreateCheckRunInput, "name" | "headSha"> {
  checkRunId: number;
  headSha?: string;
  name?: string;
}

export interface PullRequestInfo {
  id: number;
  number: number;
  draft: boolean;
  state: string;
  baseSha: string;
  headSha: string;
  title: string;
}

export interface IssueComment {
  id: number;
  body: string;
  user?: { login?: string; type?: string };
}

export interface GitHubClient {
  createCheckRun(input: CreateCheckRunInput): Promise<CheckRun>;
  updateCheckRun(input: UpdateCheckRunInput): Promise<void>;
  getPullRequest(owner: string, repo: string, number: number): Promise<PullRequestInfo>;
  listIssueComments(owner: string, repo: string, number: number): Promise<IssueComment[]>;
  createIssueComment(owner: string, repo: string, number: number, body: string): Promise<IssueComment>;
  updateIssueComment(owner: string, repo: string, commentId: number, body: string): Promise<void>;
  getInstallationAccount(installationId: number): Promise<{ login: string; id: number }>;
  listInstallationRepositories(installationId: number): Promise<
    Array<{ id: number; name: string; full_name: string; private: boolean; owner: { login: string } }>
  >;
}

export interface GitHubClientOptions {
  token: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export function createGitHubClient(options: GitHubClientOptions): GitHubClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? "https://api.github.com";

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${options.token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "breakline",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`GitHub API ${method} ${path} failed (${response.status})`);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  return {
    async createCheckRun(input) {
      return request<CheckRun>("POST", `/repos/${input.owner}/${input.repo}/check-runs`, checkPayload(input));
    },
    async updateCheckRun(input) {
      await request(
        "PATCH",
        `/repos/${input.owner}/${input.repo}/check-runs/${input.checkRunId}`,
        checkPayload(input),
      );
    },
    async getPullRequest(owner, repo, number) {
      const data = await request<{
        id: number;
        number: number;
        draft?: boolean;
        state: string;
        title: string;
        base: { sha: string };
        head: { sha: string };
      }>("GET", `/repos/${owner}/${repo}/pulls/${number}`);
      return {
        id: data.id,
        number: data.number,
        draft: Boolean(data.draft),
        state: data.state,
        baseSha: data.base.sha,
        headSha: data.head.sha,
        title: data.title,
      };
    },
    async listIssueComments(owner, repo, number) {
      return request<IssueComment[]>("GET", `/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`);
    },
    async createIssueComment(owner, repo, number, body) {
      return request<IssueComment>("POST", `/repos/${owner}/${repo}/issues/${number}/comments`, { body });
    },
    async updateIssueComment(owner, repo, commentId, body) {
      await request("PATCH", `/repos/${owner}/${repo}/issues/comments/${commentId}`, { body });
    },
    async getInstallationAccount(installationId) {
      const data = await request<{ account: { login: string; id: number } }>(
        "GET",
        `/app/installations/${installationId}`,
      );
      return data.account;
    },
    async listInstallationRepositories(installationId) {
      const data = await request<{
        repositories: Array<{ id: number; name: string; full_name: string; private: boolean; owner: { login: string } }>;
      }>("GET", `/installation/repositories?per_page=100`);
      void installationId;
      return data.repositories;
    },
  };
}

function checkPayload(input: CreateCheckRunInput | UpdateCheckRunInput): Record<string, unknown> {
  return {
    name: input.name ?? "Breakline",
    head_sha: "headSha" in input ? input.headSha : undefined,
    status: input.status,
    started_at: input.startedAt,
    completed_at: input.completedAt,
    conclusion: input.conclusion,
    details_url: input.detailsUrl,
    output: input.output,
  };
}
