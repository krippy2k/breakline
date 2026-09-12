import type { GitHubClient } from "./client.js";
import { isBreaklineComment } from "../render/comment.js";

export async function createOrUpdateComment(
  client: GitHubClient,
  input: { owner: string; repo: string; number: number; body: string },
): Promise<void> {
  const comments = await client.listIssueComments(input.owner, input.repo, input.number);
  const existing = comments.find((comment) => isBreaklineComment(comment.body));
  if (existing) {
    await client.updateIssueComment(input.owner, input.repo, existing.id, input.body);
    return;
  }
  await client.createIssueComment(input.owner, input.repo, input.number, input.body);
}
