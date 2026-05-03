/**
 * Test runner entrypoint.
 *
 *   npx tsx tests/runner.ts            # run all
 *   npx tsx tests/runner.ts --only Lobby   # run a category
 *   npx tsx tests/runner.ts --grep showdown    # run scenarios matching name
 *
 * Output: console summary + tests/reports/REPORT.md
 */
import { Reporter } from './lib/reporter.js';
import { runScenario, Scenario } from './lib/scenario.js';
import { lobbyScenarios } from './scenarios/lobby.js';
import { fullModeScenarios } from './scenarios/full-mode.js';
import { chipOnlyScenarios } from './scenarios/chip-only.js';
import { handEvaluatorScenarios } from './scenarios/hand-evaluator.js';
import { reconnectScenarios } from './scenarios/reconnect.js';
import { regressionScenarios } from './scenarios/regression.js';
import { edgeCaseScenarios } from './scenarios/edge-cases.js';
import { teenPattiScenarios } from './scenarios/teen-patti.js';

function parseArgs() {
  const args = process.argv.slice(2);
  let only: string | null = null;
  let grep: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--only') only = args[++i];
    else if (args[i] === '--grep') grep = args[++i];
  }
  return { only, grep };
}

async function main() {
  const { only, grep } = parseArgs();
  const reporter = new Reporter();

  const all: Scenario[] = [
    ...lobbyScenarios,
    ...handEvaluatorScenarios,
    ...fullModeScenarios,
    ...chipOnlyScenarios,
    ...reconnectScenarios,
    ...regressionScenarios,
    ...edgeCaseScenarios,
    ...teenPattiScenarios,
  ];

  const filtered = all.filter((s) => {
    if (only && s.category.toLowerCase() !== only.toLowerCase()) return false;
    if (grep && !s.name.toLowerCase().includes(grep.toLowerCase())) return false;
    return true;
  });

  console.log('');
  console.log('  ♠ ♥ ♦ ♣  LazyPoker E2E Test Runner  ♣ ♦ ♥ ♠');
  console.log('');
  console.log(`  Running ${filtered.length} of ${all.length} scenarios`);
  console.log('');

  let lastCategory = '';
  for (const sc of filtered) {
    if (sc.category !== lastCategory) {
      console.log('');
      console.log(`  [${sc.category}]`);
      lastCategory = sc.category;
    }
    await runScenario(sc, reporter);
  }

  const { pass, fail, err, total, issues } = reporter.summary();
  console.log('');
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  Passed: ${pass}/${total}    Failed: ${fail}    Errored: ${err}`);
  console.log(`  Issues: ${issues.length}`);
  console.log('');

  const reportPath = new URL('./reports/REPORT.md', import.meta.url).pathname;
  reporter.writeMarkdown(reportPath);
  console.log(`  Report: ${reportPath}`);
  console.log('');

  process.exit(fail + err > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(2);
});
