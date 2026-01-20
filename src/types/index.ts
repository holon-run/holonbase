import { z } from 'zod';

// Object Types
export const ObjectTypeSchema = z.enum([
    'concept',
    'claim',
    'relation',
    'note',
    'evidence',
    'file',
    'patch',
]);

export type ObjectType = z.infer<typeof ObjectTypeSchema>;

// Content schemas for each type
export const ConceptContentSchema = z.object({
    name: z.string(),
    definition: z.string().optional(),
    aliases: z.array(z.string()).optional(),
});

export const ClaimContentSchema = z.object({
    statement: z.string(),
    confidence: z.number().min(0).max(1).optional(),
    sourceId: z.string().optional(),
});

export const RelationContentSchema = z.object({
    sourceId: z.string(),
    targetId: z.string(),
    relationType: z.string(),
    attributes: z.record(z.any()).optional(),
});

export const NoteContentSchema = z.object({
    title: z.string().optional(),
    body: z.string(),
    linkedObjects: z.array(z.string()).optional(),
});

export const EvidenceContentSchema = z.object({
    type: z.enum(['url', 'document', 'observation']),
    uri: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
});

export const FileContentSchema = z.object({
    path: z.string(),
    hash: z.string().optional(),
    mimeType: z.string().optional(),
    title: z.string().optional(),
    size: z.number().optional(),
});

// Patch operations
export const PatchOpSchema = z.enum(['add', 'update', 'delete', 'link', 'merge']);

export type PatchOp = z.infer<typeof PatchOpSchema>;

// Patch content
export const PatchContentSchema = z.object({
    op: PatchOpSchema,
    target: z.string(),
    agent: z.string(),
    parentId: z.string().optional(),
    payload: z.any().optional(),
    confidence: z.number().min(0).max(1).optional(),
    evidence: z.array(z.string()).optional(),
    note: z.string().optional(),
});

// Unified Object schema
export const HolonObjectSchema = z.object({
    id: z.string(),
    type: ObjectTypeSchema,
    content: z.any(), // Will be validated based on type
    createdAt: z.string().datetime(),
});

export type HolonObject = z.infer<typeof HolonObjectSchema>;

// Type-specific content types
export type ConceptContent = z.infer<typeof ConceptContentSchema>;
export type ClaimContent = z.infer<typeof ClaimContentSchema>;
export type RelationContent = z.infer<typeof RelationContentSchema>;
export type NoteContent = z.infer<typeof NoteContentSchema>;
export type EvidenceContent = z.infer<typeof EvidenceContentSchema>;
export type FileContent = z.infer<typeof FileContentSchema>;
export type PatchContent = z.infer<typeof PatchContentSchema>;

// Union type for all content
export type ObjectContent =
    | ConceptContent
    | ClaimContent
    | RelationContent
    | NoteContent
    | EvidenceContent
    | FileContent
    | PatchContent;

// Input schema for creating patches (without id and createdAt)
export const PatchInputSchema = z.object({
    op: PatchOpSchema,
    agent: z.string(),
    target: z.string(),
    payload: z.any().optional(),
    confidence: z.number().min(0).max(1).optional(),
    evidence: z.array(z.string()).optional(),
    note: z.string().optional(),
});

export type PatchInput = z.infer<typeof PatchInputSchema>;
