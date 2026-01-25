import { HolonDatabase } from '../storage/database.js';
import { getDatabasePath, ensureHolonHome, HolonHomeError } from '../utils/home.js';
import { computeDiff, formatDiff } from '../core/diff.js';

export interface DiffOptions {
    from: string;
    to: string;
}

export async function diffStates(options: DiffOptions): Promise<void> {
    // Ensure holonbase home is initialized
    try {
        await ensureHolonHome();
    } catch (error) {
        if (error instanceof HolonHomeError) {
            console.error(error.message);
            process.exit(1);
        }
        throw error;
    }

    const dbPath = getDatabasePath();
    const db = new HolonDatabase(dbPath);

    // Resolve patch IDs (support HEAD~N syntax later)
    const fromPatchId = resolvePatchId(db, options.from);
    const toPatchId = resolvePatchId(db, options.to);

    if (!fromPatchId || !toPatchId) {
        console.error('Invalid patch ID');
        db.close();
        process.exit(1);
    }

    // Get state views at both patches
    const fromState = computeStateAtPatch(db, fromPatchId);
    const toState = computeStateAtPatch(db, toPatchId);

    // Compute diff
    const diff = computeDiff(fromState, toState);

    // Display diff
    console.log(`Diff from ${fromPatchId.substring(0, 16)} to ${toPatchId.substring(0, 16)}\n`);
    console.log(formatDiff(diff));

    db.close();
}

/**
 * Resolve patch ID (support HEAD, HEAD~N in the future)
 */
function resolvePatchId(db: HolonDatabase, ref: string): string | null {
    if (ref === 'HEAD') {
        return db.getConfig('head');
    }

    // For now, just return the ref as-is (assume it's a patch ID)
    const patch = db.getObject(ref);
    return patch ? ref : null;
}

/**
 * Compute state view at a specific patch
 */
function computeStateAtPatch(db: HolonDatabase, patchId: string): Map<string, any> {
    const state = new Map();

    // Collect patch chain from root to target
    const patches = collectPatchChain(db, patchId);

    // Apply patches in order
    for (const patch of patches) {
        applyPatchToState(state, patch);
    }

    return state;
}

/**
 * Collect patch chain from root to target
 */
function collectPatchChain(db: HolonDatabase, targetPatchId: string): any[] {
    const chain: any[] = [];
    let currentId: string | null = targetPatchId;

    while (currentId) {
        const patch = db.getObject(currentId);
        if (!patch || patch.type !== 'patch') break;

        chain.unshift(patch); // Add to front
        currentId = patch.content.parentId || null;
    }

    return chain;
}

/**
 * Apply a single patch to state
 */
function applyPatchToState(state: Map<string, any>, patch: any): void {
    const content = patch.content;

    switch (content.op) {
        case 'add':
            if (content.payload?.object) {
                state.set(content.target, content.payload.object);
            }
            break;

        case 'update':
            const existing = state.get(content.target);
            if (existing && content.payload?.changes) {
                const updated = { ...existing, content: { ...existing.content, ...content.payload.changes } };
                state.set(content.target, updated);
            }
            break;

        case 'delete':
            state.delete(content.target);
            break;

        case 'link':
            if (content.payload?.relation) {
                state.set(content.target, {
                    type: 'relation',
                    content: content.payload.relation,
                });
            }
            break;

        case 'merge':
            if (content.payload?.merge?.sourceIds) {
                for (const sourceId of content.payload.merge.sourceIds) {
                    state.delete(sourceId);
                }
            }
            break;
    }
}
