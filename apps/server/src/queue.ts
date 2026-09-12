import type { AnalysisQueue, PullRequestAnalysisJob } from "@breakline/github";

export class InProcessQueue implements AnalysisQueue {
  private pending: Promise<void> = Promise.resolve();

  constructor(
    private readonly processJob: (job: PullRequestAnalysisJob) => Promise<void>,
    private readonly immediate = false,
  ) {}

  async enqueue(job: PullRequestAnalysisJob): Promise<void> {
    const run = () => this.processJob(job);
    if (this.immediate) {
      await run();
      return;
    }
    this.pending = this.pending.then(run, run);
  }

  async drain(): Promise<void> {
    await this.pending;
  }
}
