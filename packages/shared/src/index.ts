import { z } from 'zod';

export const blockTypes = ['POLL', 'QUIZ', 'CONCEPT', 'LAB_3_LENS', 'SANDBOX_SPIN', 'HOMEWORK'] as const;
export const lensTypes = ['EXPERIENCE', 'GROUNDING', 'PAYLOAD'] as const;
export const campusOrigins = ['MAIN_BUILDING', 'CENTENNIAL', 'SASSCON_RD'] as const;
export const routeConstraints = ['ANY', 'RAIN_SHELTERED', 'NO_STEEP_SLOPES'] as const;

export const sourceSchema = z.object({ title: z.string().max(300), uri: z.string().url().max(2048) }).strict();
export const coordinateSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).strict();
export const restaurantSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(180),
  cuisine: z.string().max(120).default(''),
  priceHKD: z.number().int().min(0).max(5000),
  walkMins: z.number().int().min(0).max(300),
  signatureDish: z.string().max(240).default(''),
  pitch: z.string().max(500).default(''),
  coordinates: coordinateSchema.optional(),
}).strict();
export const rotatorConfigSchema = z.object({
  campusOrigin: z.enum(campusOrigins),
  maxBudgetHKD: z.number().int().min(20).max(2000),
  maxWalkMins: z.number().int().min(1).max(90),
  weatherRoute: z.enum(routeConstraints),
  vibeInstruction: z.string().trim().min(1).max(220),
}).strict();

const quizQuestionSchema = z.object({
  prompt: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(6),
  answerIndex: z.number().int().min(0).max(5),
  explanation: z.string().max(500).default(''),
}).strict();
export const learningObjectivesSchema = z.array(z.string().trim().min(10).max(300)).min(2).max(3);
export const learningSupportSchema = z.object({
  guidedSteps: z.array(z.string().min(1).max(400)).max(4).default([]),
  hint: z.string().max(500).default(''),
  stretchChallenge: z.string().max(600).default(''),
}).strict().default({ guidedSteps: [], hint: '', stretchChallenge: '' });
export const sessionBlockSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  type: z.enum(blockTypes),
  title: z.string().min(1).max(160),
  durationMinutes: z.number().int().min(1).max(120),
  description: z.string().max(1200).default(''),
  prompt: z.string().max(500).optional(),
  options: z.array(z.string().min(1).max(200)).max(12).optional(),
  questions: z.array(quizQuestionSchema).max(20).optional(),
  learningSupport: learningSupportSchema,
}).strict();

export const participantSchema = z.object({
  alias: z.string().min(1).max(60),
  selectedLens: z.enum(lensTypes).optional(),
  quizScore: z.number().int().min(0).default(0),
  joinedAt: z.string().datetime().optional(),
}).strict();
export const labSubmissionSchema = z.object({
  id: z.string().min(1).max(120),
  participantId: z.string().min(1).max(120),
  alias: z.string().min(1).max(60),
  lens: z.enum(lensTypes),
  timestamp: z.string().datetime(),
  response: z.string().min(1).max(3000),
}).strict();
export const takeawayFeedbackSchema = z.object({
  id: z.string().uuid(),
  submittedAt: z.string().datetime(),
  objectivesToApply: z.array(z.string().min(10).max(300)).min(1).max(3),
  workplaceAction: z.string().trim().min(1).max(800),
  stars: z.string().trim().min(1).max(1000),
  wishes: z.string().trim().min(1).max(1000),
}).strict();
export const anonymousQuestionSchema = z.object({
  id: z.string().uuid(),
  submittedAt: z.string().datetime(),
  text: z.string().min(3).max(500),
  votes: z.number().int().nonnegative().default(0),
  answered: z.boolean().default(false),
}).strict();
export const takeawayFeedbackInputSchema = z.object({
  objectivesToApply: z.array(z.string().min(10).max(300)).min(1).max(3),
  workplaceAction: z.string().trim().min(1).max(800),
  stars: z.string().trim().min(1).max(1000),
  wishes: z.string().trim().min(1).max(1000),
}).strict();
export const askQuestionInputSchema = z.object({ text: z.string().trim().min(3).max(500) }).strict();
export const questionIdInputSchema = z.object({ questionId: z.string().uuid() }).strict();
export const generatedArtifactSchema = z.object({
  id: z.string().min(1).max(120),
  timestamp: z.string().datetime(),
  triggeredByGroup: z.string().max(100).default('Field test'),
  filtersUsed: rotatorConfigSchema,
  restaurants: z.array(restaurantSchema).min(1).max(10),
  winningRestaurantId: z.string().min(1).max(120),
  mapSources: z.array(sourceSchema).max(40).default([]),
  webSources: z.array(sourceSchema).max(40).default([]),
  searchQueries: z.array(z.string().max(500)).max(30).default([]),
  sourceMode: z.enum(['grounded', 'unverified', 'demo']).default('demo'),
}).strict();
export const sessionSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  title: z.string().min(1).max(180),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  durationMode: z.enum(['15_MIN', '60_MIN', '120_MIN']),
  status: z.enum(['LIVE', 'ARCHIVED', 'TEMPLATE']),
  presenterName: z.string().max(80),
  learningObjectives: learningObjectivesSchema.default([
    'Identify a useful problem to address in your work.',
    'Choose one practical next step you can try immediately.',
  ]),
  currentBlockIndex: z.number().int().min(0),
  blocks: z.array(sessionBlockSchema).min(1).max(100),
  recordedState: z.object({
    participants: z.record(participantSchema),
    pollResults: z.record(z.record(z.number().int().nonnegative())),
    pollVoters: z.record(z.record(z.string().max(120))),
    quizResults: z.record(z.array(z.object({ participantId: z.string().uuid(), alias: z.string().max(60), score: z.number().int().nonnegative(), timeMs: z.number().nonnegative(), completedAt: z.string().datetime() }).strict())), 
    labSubmissions: z.array(labSubmissionSchema).max(5000),
    generatedArtifacts: z.array(generatedArtifactSchema).max(500),
    takeawayFeedback: z.array(takeawayFeedbackSchema).max(5000).default([]),
    anonymousQuestions: z.array(anonymousQuestionSchema).max(5000).default([]),
  }).strict(),
}).strict();

export const createSessionInputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  presenterName: z.string().trim().min(1).max(80),
  templateId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
}).strict();
export const joinSessionInputSchema = z.object({
  participantId: z.string().uuid(),
  alias: z.string().trim().min(1).max(60),
}).strict();
export const pollSubmissionSchema = z.object({ blockId: z.string().max(80), option: z.string().trim().min(1).max(200) }).strict();
export const quizSubmissionSchema = z.object({ blockId: z.string().max(80), answers: z.array(z.number().int().min(-1).max(5)).max(20), timeMs: z.number().nonnegative().max(3600000) }).strict();
export const labSubmissionInputSchema = z.object({ blockId: z.string().max(80), lens: z.enum(lensTypes), response: z.string().trim().min(1).max(3000) }).strict();

export type BlockType = typeof blockTypes[number];
export type LensType = typeof lensTypes[number];
export type RotatorConfig = z.infer<typeof rotatorConfigSchema>;
export type Restaurant = z.infer<typeof restaurantSchema>;
export type GeneratedArtifact = z.infer<typeof generatedArtifactSchema>;
export type SessionBlock = z.infer<typeof sessionBlockSchema>;
export type LearningSupport = z.infer<typeof learningSupportSchema>;
export type TakeawayFeedback = z.infer<typeof takeawayFeedbackSchema>;
export type TakeawayFeedbackInput = z.infer<typeof takeawayFeedbackInputSchema>;
export type AnonymousQuestion = z.infer<typeof anonymousQuestionSchema>;
export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>;
export type SourceCitation = z.infer<typeof sourceSchema>;
