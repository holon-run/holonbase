#!/usr/bin/env node
/**
 * CLI wrapper for Holon publisher.
 *
 * Usage:
 *   node bin/publisher.js --owner <owner> --repo <repo> --pr <number> --output <dir> --token <token>
 */

import { Octokit } from '@octokit/rest';
import { publishHolonResults } from './lib/publisher.js';

function usage() {
  // Keep this minimal for Actions logs.
  console.log(
    [
      'Usage:',
      '  node bin/publisher.js --owner <owner> --repo <repo> --pr <number> --output <dir> --token <token>',
      '',
      'Options:',
      '  --owner   Repository owner',
      '  --repo    Repository name',
      '  --pr      Pull request number',
      '  --output  Holon output directory (contains pr-fix.json, summary.md)',
      '  --token   GitHub token',
      '  --help    Show help',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index++) {
    const key = argv[index];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    if (name === 'help') {
      args.help = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) continue;
    args[name] = value;
    index++;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    usage();
    process.exit(0);
  }

  const owner = args.owner;
  const repo = args.repo;
  const prNumber = args.pr ? Number(args.pr) : NaN;
  const outputDir = args.output;
  const token = args.token;

  if (!owner || !repo || !outputDir || !token || Number.isNaN(prNumber)) {
    usage();
    process.exit(2);
  }

  const octokit = new Octokit({ auth: token });

  const context = {
    octokit,
    payload: {
      repository: {
        owner: { login: owner },
        name: repo,
      },
    },
  };

  const results = await publishHolonResults(context, { outputDir, prNumber });
  console.log(JSON.stringify(results));
}

main().catch((error) => {
  console.error('Publisher failed:', error);
  process.exit(1);
});

