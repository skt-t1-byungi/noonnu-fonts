import { z } from 'zod'

export const EvidenceKindSchema = z.enum(['license', 'homepage', 'download_page', 'other'])

export const EvidenceRecordSchema = z.object({
    kind: EvidenceKindSchema,
    url: z.string().url(),
    capturedAt: z.string(), // ISO 8601
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    path: z.string(),
})

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>

export const LicenseConfidenceSchema = z.enum(['low', 'medium', 'high'])
export const ReviewStatusSchema = z.enum(['blocked', 'needs_review', 'approved'])

export const LicenseAssessmentSchema = z.object({
    summary: z.string().optional(),
    redistributionAllowed: z.boolean().optional(),
    commercialUseAllowed: z.boolean().optional(),
    modificationAllowed: z.boolean().optional(),
    attributionRequired: z.boolean().optional(),
    restrictions: z.array(z.string()).optional(),
    confidence: LicenseConfidenceSchema.optional(),
    reviewStatus: ReviewStatusSchema.default('needs_review'),
    reviewNotes: z.string().optional(),
})

export type LicenseAssessment = z.infer<typeof LicenseAssessmentSchema>

export const SourceRecordSchema = z.object({
    sourceUrl: z.string().url(),
    downloadUrl: z.string().url().optional(),
    licenseUrl: z.string().url().optional(),
    discoveredAt: z.string(), // ISO 8601
})

export type SourceRecord = z.infer<typeof SourceRecordSchema>

export const ArtifactKindSchema = z.enum(['original_zip', 'ttf', 'otf', 'woff', 'woff2'])

export const ArtifactRecordSchema = z.object({
    kind: ArtifactKindSchema,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    size: z.number().int().nonnegative(),
    path: z.string(),
    sourceUrl: z.string().url().optional(),
})

export type ArtifactRecord = z.infer<typeof ArtifactRecordSchema>

export const QualitySchema = z.object({
    validationStatus: z.enum(['pass', 'warn', 'fail']).optional(),
    issues: z.array(z.string()).optional(),
    unicodeCoverage: z
        .object({
            // 최소 골격: 추후 확장
            notes: z.string().optional(),
        })
        .optional(),
})

export type Quality = z.infer<typeof QualitySchema>

export const FontRecordSchema = z.object({
    id: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    displayName: z.string().min(1),
    familyName: z.string().min(1),
    version: z.number().int().nonnegative().default(0),
    sources: z.array(SourceRecordSchema).default([]),
    evidence: z.array(EvidenceRecordSchema).optional(),
    license: LicenseAssessmentSchema.default({ reviewStatus: 'needs_review' }),
    artifacts: z.array(ArtifactRecordSchema).default([]),
    quality: QualitySchema.optional(),
})

export type FontRecord = z.infer<typeof FontRecordSchema>

export const RegistryFileSchema = z.object({
    schemaVersion: z.literal(1),
    generatedAt: z.string(), // ISO 8601
    fonts: z.array(FontRecordSchema),
})

export type RegistryFile = z.infer<typeof RegistryFileSchema>

