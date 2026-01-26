#!/usr/bin/env node

import { Command } from 'commander';
import { initRepository } from './cli/init.js';
import { syncCommand } from './cli/sync.js';
import { logPatches } from './cli/log.js';
import { showObject } from './cli/show.js';
import { listObjects } from './cli/list.js';
import { exportRepository } from './cli/export.js';
import { diffStates } from './cli/diff.js';
import { showStatus } from './cli/status.js';
import { revertPatch } from './cli/revert.js';

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
    .action(async (path: string) => {
        try {
            await initRepository({ path });
        } catch (error) {
            console.error('Error:', (error as Error).message);
            process.exit(1);
        }
    });

// sync command (unified sync for all sources)
program
    .command('sync')
    .description('Sync all data sources')
    .option('-m, --message <message>', 'Commit message')
    .option('-s, --source <name>', 'Sync specific source')
    .action(async (options) => {
        try {
            await syncCommand(options);
        } catch (error) {
            console.error('Error:', (error as Error).message);
            process.exit(1);
        }
    });

// commit command (alias for sync for transition)
program
    .command('commit')
    .description('Commit workspace changes (alias for sync)')
    .option('-m, --message <message>', 'Commit message')
    .action(async (cmdOptions?: any) => {
        try {
            const options = {
                message: cmdOptions?.message,
            };
            await syncCommand(options);
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
    .action(async (objectId, options) => {
        try {
            await logPatches({ ...options, objectId });
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
    .action(async (id: string) => {
        try {
            await showObject(id);
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
    .action(async (options) => {
        try {
            await listObjects(options);
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
    .action(async (options) => {
        try {
            await diffStates(options);
        } catch (error) {
            console.error('Error:', (error as Error).message);
            process.exit(1);
        }
    });

// status command
program
    .command('status')
    .description('Show repository status')
    .action(async () => {
        try {
            await showStatus();
        } catch (error) {
            console.error('Error:', (error as Error).message);
            process.exit(1);
        }
    });

// revert command
program
    .command('revert')
    .description('Revert the last patch by creating a reverse patch')
    .action(async () => {
        try {
            await revertPatch();
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
    .action(async (options) => {
        try {
            await exportRepository(options);
        } catch (error) {
            console.error('Error:', (error as Error).message);
            process.exit(1);
        }
    });

// source command
program
    .command('source')
    .description('Manage data sources')
    .argument('<action>', 'Action (add|list|remove)')
    .argument('[name]', 'Source name')
    .option('--type <type>', 'Source type (local|git)', 'local')
    .option('--path <path>', 'Path for local source')
    .action(async (action, name, options) => {
        const { handleSource } = await import('./cli/source.js');
        await handleSource([action, name], options);
    });

program.parse();
