#!/usr/bin/env node

import { Command } from 'commander';
import { initRepository } from './cli/init.js';
import { commitPatch } from './cli/commit.js';
import { logPatches } from './cli/log.js';
import { showObject } from './cli/show.js';
import { getObject, listObjects } from './cli/get.js';
import { exportRepository } from './cli/export.js';
import { diffStates } from './cli/diff.js';

const program = new Command();

program
    .name('holonbase')
    .description('A version control engine for AI-driven structured knowledge systems')
    .version('0.1.0-alpha');

// init command
program
    .command('init')
    .description('Initialize a new holonbase repository')
    .argument('[path]', 'Path to initialize', '.')
    .action((path: string) => {
        try {
            initRepository({ path });
        } catch (error) {
            console.error('Error:', (error as Error).message);
            process.exit(1);
        }
    });

// commit command
program
    .command('commit')
    .description('Commit a patch')
    .argument('[file]', 'Patch JSON file (or use stdin with -)')
    .action((file?: string) => {
        try {
            const options = {
                file: file && file !== '-' ? file : undefined,
                stdin: !file || file === '-',
            };
            commitPatch(options);
        } catch (error) {
            console.error('Error:', (error as Error).message);
            process.exit(1);
        }
    });

// log command
program
    .command('log')
    .description('Show patch history')
    .argument('[object_id]', 'Object ID to show history for')
    .option('-n, --limit <number>', 'Limit number of patches', parseInt)
    .action((objectId, options) => {
        try {
            logPatches({ ...options, objectId });
        } catch (error) {
            console.error('Error:', (error as Error).message);
            process.exit(1);
        }
    });

// show command
program
    .command('show')
    .description('Show object details')
    .argument('<id>', 'Object ID')
    .action((id: string) => {
        try {
            showObject(id);
        } catch (error) {
            console.error('Error:', (error as Error).message);
            process.exit(1);
        }
    });

// get command
program
    .command('get')
    .description('Get object from current state')
    .argument('<id>', 'Object ID')
    .action((id: string) => {
        try {
            getObject(id);
        } catch (error) {
            console.error('Error:', (error as Error).message);
            process.exit(1);
        }
    });

// list command
program
    .command('list')
    .description('List objects in current state')
    .option('-t, --type <type>', 'Filter by object type')
    .action((options) => {
        try {
            listObjects(options);
        } catch (error) {
            console.error('Error:', (error as Error).message);
            process.exit(1);
        }
    });

// diff command
program
    .command('diff')
    .description('Compare two states')
    .requiredOption('--from <patch_id>', 'From patch ID (or HEAD)')
    .requiredOption('--to <patch_id>', 'To patch ID (or HEAD)')
    .action((options) => {
        try {
            diffStates(options);
        } catch (error) {
            console.error('Error:', (error as Error).message);
            process.exit(1);
        }
    });

// export command
program
    .command('export')
    .description('Export repository data')
    .option('-f, --format <format>', 'Export format (json|jsonl)', 'jsonl')
    .option('-o, --output <path>', 'Output path')
    .action((options) => {
        try {
            exportRepository(options);
        } catch (error) {
            console.error('Error:', (error as Error).message);
            process.exit(1);
        }
    });

program.parse();
