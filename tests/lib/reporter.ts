/**
 * Lightweight test result collector + Markdown report writer.
 * Tests don't throw to fail — they push issues. This lets one scenario
 * surface multiple problems instead of stopping at the first.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Issue {
  severity: Severity;
  scenario: string;
  message: string;
  expected?: string;
  actual?: string;
  fix?: string;
}

export interface ScenarioResult {
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'error';
  durationMs: number;
  issues: Issue[];
  notes: string[];
  error?: string;
}

export class Reporter {
  results: ScenarioResult[] = [];
  startedAt = new Date();

  push(result: ScenarioResult) {
    this.results.push(result);
    const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '!';
    const dur = `(${result.durationMs}ms)`;
    // eslint-disable-next-line no-console
    console.log(`  ${icon} [${result.category}] ${result.name} ${dur}`);
    for (const issue of result.issues) {
      // eslint-disable-next-line no-console
      console.log(`      → [${issue.severity}] ${issue.message}`);
    }
    if (result.error) {
      // eslint-disable-next-line no-console
      console.log(`      ! ${result.error}`);
    }
  }

  summary() {
    const pass = this.results.filter((r) => r.status === 'pass').length;
    const fail = this.results.filter((r) => r.status === 'fail').length;
    const err = this.results.filter((r) => r.status === 'error').length;
    const issues = this.results.flatMap((r) => r.issues);
    return { pass, fail, err, total: this.results.length, issues };
  }

  writeMarkdown(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    const { pass, fail, err, total, issues } = this.summary();
    const bySeverity = (s: Severity) => issues.filter((i) => i.severity === s);

    const lines: string[] = [];
    lines.push(`# LazyPoker — E2E Test Report`);
    lines.push('');
    lines.push(`Generated: ${this.startedAt.toISOString()}`);
    lines.push('');
    lines.push(`## Summary`);
    lines.push('');
    lines.push(`| Metric | Count |`);
    lines.push(`|---|---|`);
    lines.push(`| Total scenarios | ${total} |`);
    lines.push(`| Passed | ${pass} |`);
    lines.push(`| Failed | ${fail} |`);
    lines.push(`| Errored | ${err} |`);
    lines.push(`| Critical issues | ${bySeverity('critical').length} |`);
    lines.push(`| High issues | ${bySeverity('high').length} |`);
    lines.push(`| Medium issues | ${bySeverity('medium').length} |`);
    lines.push(`| Low issues | ${bySeverity('low').length} |`);
    lines.push('');

    if (issues.length > 0) {
      lines.push(`## Issues`);
      lines.push('');
      const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
      for (const sev of order) {
        const list = bySeverity(sev);
        if (list.length === 0) continue;
        lines.push(`### ${sev[0].toUpperCase()}${sev.slice(1)} (${list.length})`);
        lines.push('');
        for (const i of list) {
          lines.push(`- **${i.scenario}** — ${i.message}`);
          if (i.expected !== undefined) lines.push(`  - Expected: \`${i.expected}\``);
          if (i.actual !== undefined) lines.push(`  - Actual: \`${i.actual}\``);
          if (i.fix) lines.push(`  - Suggested fix: ${i.fix}`);
        }
        lines.push('');
      }
    } else {
      lines.push(`## Issues`);
      lines.push('');
      lines.push(`No issues found.`);
      lines.push('');
    }

    lines.push(`## Scenario Details`);
    lines.push('');
    const grouped = new Map<string, ScenarioResult[]>();
    for (const r of this.results) {
      if (!grouped.has(r.category)) grouped.set(r.category, []);
      grouped.get(r.category)!.push(r);
    }
    for (const [cat, rs] of grouped) {
      lines.push(`### ${cat}`);
      lines.push('');
      lines.push(`| Scenario | Status | Duration | Issues | Notes |`);
      lines.push(`|---|---|---|---|---|`);
      for (const r of rs) {
        const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⚠️';
        const notes = r.notes.length ? r.notes.join('; ').slice(0, 80) : '';
        lines.push(`| ${r.name} | ${icon} ${r.status} | ${r.durationMs}ms | ${r.issues.length} | ${notes} |`);
      }
      lines.push('');
    }

    writeFileSync(path, lines.join('\n'));
  }
}
