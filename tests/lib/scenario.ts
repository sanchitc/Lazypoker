/**
 * Scenario runner. Each scenario is an async function that uses helpers
 * to drive a fresh server + clients, calls `expect`/`issue` to record
 * findings, and returns. The runner times it, catches errors, and pushes
 * a ScenarioResult into the reporter.
 */
import { startServer, TestServer } from './harness.js';
import { TestClient } from './client.js';
import { Reporter, ScenarioResult, Severity, Issue } from './reporter.js';

export interface Ctx {
  server: TestServer;
  clients: TestClient[];
  /** Spawn a new client connected to this server. */
  client(name: string): Promise<TestClient>;
  /** Record a soft failure — keeps scenario running. */
  issue(opts: Omit<Issue, 'scenario'>): void;
  /** Assert. On failure records an issue and continues unless `bail` set. */
  expect(
    cond: boolean,
    message: string,
    opts?: { severity?: Severity; expected?: string; actual?: string; fix?: string; bail?: boolean }
  ): void;
  note(s: string): void;
}

export interface Scenario {
  name: string;
  category: string;
  fn: (ctx: Ctx) => Promise<void>;
  /** If true, scenario uses fixed RNG seed (best-effort — JS Math.random reseed). */
  skip?: boolean;
}

export async function runScenario(scenario: Scenario, reporter: Reporter): Promise<void> {
  if (scenario.skip) return;
  const start = Date.now();
  const result: ScenarioResult = {
    name: scenario.name,
    category: scenario.category,
    status: 'pass',
    durationMs: 0,
    issues: [],
    notes: [],
  };

  let server: TestServer | null = null;
  const clients: TestClient[] = [];

  try {
    server = await startServer();
    const ctx: Ctx = {
      server,
      clients,
      async client(name: string) {
        const c = new TestClient(name, server!.url);
        await c.connect();
        clients.push(c);
        return c;
      },
      issue(i) {
        result.issues.push({ ...i, scenario: scenario.name });
        if (i.severity === 'critical' || i.severity === 'high' || i.severity === 'medium') {
          result.status = 'fail';
        }
      },
      expect(cond, message, opts = {}) {
        if (!cond) {
          result.issues.push({
            scenario: scenario.name,
            severity: opts.severity || 'high',
            message,
            expected: opts.expected,
            actual: opts.actual,
            fix: opts.fix,
          });
          result.status = 'fail';
          if (opts.bail) throw new Error(`bail: ${message}`);
        }
      },
      note(s) {
        result.notes.push(s);
      },
    };

    await scenario.fn(ctx);
  } catch (e: any) {
    if (!String(e.message || '').startsWith('bail:')) {
      result.status = 'error';
      result.error = e?.stack || String(e);
    }
  } finally {
    for (const c of clients) c.disconnect();
    if (server) await server.close().catch(() => {});
    result.durationMs = Date.now() - start;
    reporter.push(result);
  }
}
