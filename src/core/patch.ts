import { HolonDatabase } from '../storage/database.js';
import { HolonObject, PatchContent, PatchInput } from '../types/index.js';
import { computeHash } from '../utils/hash.js';

export class PatchManager {
    constructor(private db: HolonDatabase) { }

    /**
     * Create and commit a patch
     */
    commit(input: PatchInput, currentView: string = 'main'): HolonObject {
        const now = new Date().toISOString();

        // Get HEAD from current view
        const view = this.db.getView(currentView);
        const head = view?.headPatchId || '';

        // Build patch content
        const content: PatchContent = {
            op: input.op,
            target: input.target,
            agent: input.agent,
            parentId: head || undefined,
            payload: input.payload,
            confidence: input.confidence,
            evidence: input.evidence,
            note: input.note,
        };

        // Compute patch ID
        const patchObject: HolonObject = {
            id: '', // Will be computed
            type: 'patch',
            content,
            createdAt: now,
        };

        const id = computeHash(patchObject);
        patchObject.id = id;

        // Store patch
        this.db.insertObject(id, 'patch', content, now);

        // Update view's HEAD
        this.db.updateView(currentView, id);

        // Also update global HEAD for backward compatibility
        this.db.setConfig('head', id);

        // Apply patch to state view
        this.applyPatchToStateView(patchObject);

        return patchObject;
    }

    /**
     * Apply a patch to the state view
     */
    private applyPatchToStateView(patch: HolonObject): void {
        const content = patch.content as PatchContent;
        const now = new Date().toISOString();

        switch (content.op) {
            case 'add':
                if (content.payload?.object) {
                    const obj = content.payload.object;
                    this.db.upsertStateView(
                        content.target,
                        obj.type,
                        obj.content,
                        false,
                        now
                    );
                }
                break;

            case 'update':
                const existing = this.db.getStateViewObject(content.target);
                if (existing && content.payload?.changes) {
                    const updated = { ...existing.content, ...content.payload.changes };
                    this.db.upsertStateView(
                        content.target,
                        existing.type,
                        updated,
                        false,
                        now
                    );
                }
                break;

            case 'delete':
                this.db.upsertStateView(content.target, '', {}, true, now);
                break;

            case 'link':
                // For relation objects
                if (content.payload?.relation) {
                    this.db.upsertStateView(
                        content.target,
                        'relation',
                        content.payload.relation,
                        false,
                        now
                    );
                }
                break;

            case 'merge':
                // Mark source objects as deleted
                if (content.payload?.merge?.sourceIds) {
                    for (const sourceId of content.payload.merge.sourceIds) {
                        this.db.upsertStateView(sourceId, '', {}, true, now);
                    }
                }
                break;
        }
    }

    /**
     * Get patch by ID
     */
    getPatch(id: string): HolonObject | null {
        return this.db.getObject(id);
    }

    /**
     * Get all patches
     */
    getAllPatches(limit?: number): HolonObject[] {
        return this.db.getAllPatches(limit);
    }

    /**
     * Get patches for a specific target
     */
    getPatchesByTarget(targetId: string): HolonObject[] {
        return this.db.getPatchesByTarget(targetId);
    }

    /**
     * Get current HEAD
     */
    getHead(): string {
        return this.db.getConfig('head') || '';
    }
}
