import { readFileSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';
import { HolonDatabase } from '../storage/database.js';
import { PatchManager } from '../core/patch.js';
import { PatchInputSchema } from '../types/index.js';
import { findHolonbaseRoot } from '../utils/repo.js';
import { ConfigManager } from '../utils/config.js';

export interface CommitOptions {
    file?: string;
    stdin?: boolean;
    dryRun?: boolean;
    confirm?: boolean;
}

function promptUser(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

export async function commitPatch(options: CommitOptions): Promise<void> {
    // Find repository root
    const repoRoot = findHolonbaseRoot(process.cwd());
    if (!repoRoot) {
        throw new Error('Not a holonbase repository (or any parent up to mount point)');
    }

    // Read patch input
    let patchJson: string;
    if (options.stdin) {
        // Read from stdin
        patchJson = readFileSync(0, 'utf-8');
    } else if (options.file) {
        patchJson = readFileSync(options.file, 'utf-8');
    } else {
        throw new Error('Must provide either --file or read from stdin');
    }

    // Parse and validate
    const patchInput = JSON.parse(patchJson);
    const validated = PatchInputSchema.parse(patchInput);

    // Open database and config
    const dbPath = join(repoRoot, '.holonbase', 'holonbase.db');
    const configPath = join(repoRoot, '.holonbase', 'config.json');

    const db = new HolonDatabase(dbPath);
    const config = new ConfigManager(configPath);
    const patchManager = new PatchManager(db);

    // Get current view
    const currentView = config.getCurrentView();

    // Dry-run mode: preview without committing
    if (options.dryRun) {
        console.log('=== Dry Run Mode ===');
        console.log('Would commit:');
        console.log(`  Operation: ${validated.op}`);
        console.log(`  Target: ${validated.target}`);
        console.log(`  Agent: ${validated.agent}`);
        console.log(`  View: ${currentView}`);

        if (validated.confidence !== undefined) {
            console.log(`  Confidence: ${validated.confidence}`);
        }

        // Show object details for add operation
        if (validated.op === 'add' && validated.payload?.object) {
            console.log(`  Object type: ${validated.payload.object.type}`);
        }

        console.log('');
        console.log('Run without --dry-run to commit.');
        db.close();
        return;
    }

    // Confirm mode: ask for confirmation
    if (options.confirm) {
        console.log('About to commit:');
        console.log(`  Operation: ${validated.op}`);
        console.log(`  Target: ${validated.target}`);
        console.log(`  Agent: ${validated.agent}`);
        console.log(`  View: ${currentView}`);
        console.log('');

        const answer = await promptUser('Proceed? [y/N]: ');

        if (answer.toLowerCase() !== 'y') {
            console.log('Aborted.');
            db.close();
            return;
        }
    }

    // Commit patch to current view
    const patch = patchManager.commit(validated, currentView);

    console.log(`Committed patch ${patch.id}`);
    console.log(`  Operation: ${patch.content.op}`);
    console.log(`  Target: ${patch.content.target}`);
    console.log(`  Agent: ${patch.content.agent}`);
    console.log(`  View: ${currentView}`);

    db.close();
}
