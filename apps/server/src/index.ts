import { createAppJwt, createGitHubClient, createGitHubTokenClient, InstallationAuth } from "@breakline/github";
import { loadEnv } from "./env.js";
import { createHttpServer } from "./http.js";
import { createLogger } from "./log.js";
import { Metrics } from "./metrics.js";
import { InProcessQueue } from "./queue.js";
import { openStore } from "./store.js";
import { createWorker } from "./worker.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger();
  const metrics = new Metrics();
  const store = await openStore(env.databaseUrl);
  const tokens = new InstallationAuth(
    { appId: env.githubAppId, privateKey: env.githubPrivateKey },
    createGitHubTokenClient(),
  );
  const worker = createWorker({
    store,
    getToken: (installationId) => tokens.getToken(installationId),
    baseUrl: env.baseUrl,
    logger,
    metrics,
  });
  const queue = new InProcessQueue(worker);
  const server = createHttpServer({
    secret: env.githubWebhookSecret,
    store,
    queue,
    logger,
    metrics,
    async loadInstallation(installationId) {
      const jwt = createAppJwt({ appId: env.githubAppId, privateKey: env.githubPrivateKey });
      const appClient = createGitHubClient({ token: jwt });
      const account = await appClient.getInstallationAccount(installationId);
      const token = await tokens.getToken(installationId);
      const repos = await createGitHubClient({ token }).listInstallationRepositories(installationId);
      return { account: account.login, repositories: repos.map((repo) => ({ name: repo.name })) };
    },
  });

  server.listen(env.port, () => {
    logger.info("server_started", { port: env.port });
  });
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Failed to start Breakline server"}\n`);
  process.exit(1);
});
