import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readdir, readFile, rename, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from '../paths.js';
import {
  askQuestionInputSchema, generatedArtifactSchema, joinSessionInputSchema,
  labSubmissionInputSchema, learningObjectivesSchema, pollSubmissionSchema, questionIdInputSchema,
  quizSubmissionSchema, sessionBlockSchema, sessionSnapshotSchema, takeawayFeedbackInputSchema,
  type GeneratedArtifact, type SessionBlock, type SessionSnapshot, type RotatorConfig,
} from '@lightfield/shared';

export const SESSION_DIR = path.join(DATA_DIR, 'sessions');
const TEMPLATE_DIR = path.join(DATA_DIR, 'templates');
const ARCHIVE_ID = /^[a-zA-Z0-9_-]{1,100}$/;

type Template = { id: string; title: string; durationMode: SessionSnapshot['durationMode']; learningObjectives: string[]; blocks: SessionBlock[] };
type ActiveSession = {
  snapshot: SessionSnapshot;
  presenterToken: string;
  blockStartedAt: number;
  questionVoters: Map<string, Set<string>>;
  feedbackParticipants: Set<string>;
};

function emptyRecordedState(): SessionSnapshot['recordedState'] {
  return {
    participants: {}, pollResults: {}, pollVoters: {}, quizResults: {}, labSubmissions: [], generatedArtifacts: [],
    takeawayFeedback: [], anonymousQuestions: [],
  };
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

export class SessionStore {
  private readonly active = new Map<string, ActiveSession>();

  async templates(): Promise<Template[]> {
    const names = (await readdir(TEMPLATE_DIR)).filter((name) => name.endsWith('.json')).sort();
    const templates: Template[] = [];
    for (const name of names) {
      const raw: unknown = JSON.parse(await readFile(path.join(TEMPLATE_DIR, name), 'utf8'));
      if (!raw || typeof raw !== 'object') continue;
      const source = raw as Record<string, unknown>;
      if (typeof source.id !== 'string' || !ARCHIVE_ID.test(source.id) || typeof source.title !== 'string' || !Array.isArray(source.blocks)) continue;
      const blocks = source.blocks.map((block) => sessionBlockSchema.parse(block));
      const learningObjectives = learningObjectivesSchema.parse(source.learningObjectives);
      if (!['15_MIN', '60_MIN', '120_MIN'].includes(String(source.durationMode))) continue;
      templates.push({ id: source.id, title: source.title, durationMode: source.durationMode as Template['durationMode'], learningObjectives, blocks });
    }
    return templates;
  }

  async create(title: string, presenterName: string, templateId: string): Promise<{ snapshot: SessionSnapshot; presenterToken: string }> {
    const template = (await this.templates()).find((item) => item.id === templateId);
    if (!template) throw new Error('Template not found.');
    const now = new Date().toISOString();
    const id = randomUUID();
    const snapshot = sessionSnapshotSchema.parse({
      schemaVersion: 1, id, title, createdAt: now, updatedAt: now,
      durationMode: template.durationMode, status: 'LIVE', presenterName,
      learningObjectives: clone(template.learningObjectives),
      currentBlockIndex: 0, blocks: clone(template.blocks), recordedState: emptyRecordedState(),
    });
    const presenterToken = randomBytes(32).toString('base64url');
    this.active.set(id, {
      snapshot, presenterToken, blockStartedAt: Date.now(),
      questionVoters: new Map(), feedbackParticipants: new Set(),
    });
    await this.persist(snapshot);
    return { snapshot: clone(snapshot), presenterToken };
  }

  async list(): Promise<{ active: SessionSnapshot[]; archives: SessionSnapshot[]; templates: Array<Pick<Template, 'id' | 'title' | 'durationMode'>> }> {
    const live = [...this.active.values()].map(({ snapshot }) => clone(snapshot));
    const liveIds = new Set(live.map((session) => session.id));
    const names = (await readdir(SESSION_DIR).catch(() => [] as string[])).filter((name) => name.endsWith('.json')).sort().reverse();
    const archives: SessionSnapshot[] = [];
    for (const name of names) {
      const id = name.slice(0, -5);
      if (!ARCHIVE_ID.test(id) || liveIds.has(id)) continue;
      try {
        const parsed = sessionSnapshotSchema.parse(JSON.parse(await readFile(path.join(SESSION_DIR, name), 'utf8')));
        const archive = { ...parsed, status: 'ARCHIVED' as const };
        archives.push(sessionSnapshotSchema.parse(archive));
      } catch {
        // Ignore invalid or partially-written files; never expose file contents in errors.
      }
    }
    return {
      active: live,
      archives,
      templates: (await this.templates()).map(({ id, title, durationMode }) => ({ id, title, durationMode })),
    };
  }

  async get(id: string): Promise<SessionSnapshot | undefined> {
    if (!ARCHIVE_ID.test(id)) return undefined;
    const active = this.active.get(id);
    if (active) return clone(active.snapshot);
    try {
      const parsed = sessionSnapshotSchema.parse(JSON.parse(await readFile(path.join(SESSION_DIR, `${id}.json`), 'utf8')));
      return sessionSnapshotSchema.parse({ ...parsed, status: 'ARCHIVED' });
    } catch {
      return undefined;
    }
  }

  authorizePresenter(id: string, token: unknown): boolean {
    const active = this.active.get(id);
    if (!active || typeof token !== 'string') return false;
    const expected = Buffer.from(active.presenterToken);
    const received = Buffer.from(token);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  isLive(id: string): boolean { return this.active.has(id); }

  async advance(id: string, direction: -1 | 1): Promise<SessionSnapshot> {
    const session = this.requireLive(id);
    const previousIndex = session.snapshot.currentBlockIndex;
    session.snapshot.currentBlockIndex = Math.max(0, Math.min(session.snapshot.blocks.length - 1, previousIndex + direction));
    if (previousIndex !== session.snapshot.currentBlockIndex) session.blockStartedAt = Date.now();
    return this.commit(session.snapshot);
  }

  async join(id: string, input: unknown): Promise<SessionSnapshot> {
    const session = this.requireLive(id);
    const data = joinSessionInputSchema.parse(input);
    if (!session.snapshot.recordedState.participants[data.participantId]) {
      session.snapshot.recordedState.participants[data.participantId] = { alias: data.alias, quizScore: 0, joinedAt: new Date().toISOString() };
    }
    return this.commit(session.snapshot);
  }

  async poll(id: string, participantId: string, input: unknown): Promise<SessionSnapshot> {
    const session = this.requireParticipant(id, participantId);
    const { blockId, option } = pollSubmissionSchema.parse(input);
    const block = this.requireBlock(session.snapshot, blockId, 'POLL');
    if (!block.options?.includes(option)) throw new Error('Invalid poll option.');
    const results = session.snapshot.recordedState.pollResults[blockId] ??= {};
    const voters = session.snapshot.recordedState.pollVoters[blockId] ??= {};
    const previous = voters[participantId];
    if (previous) results[previous] = Math.max(0, (results[previous] ?? 1) - 1);
    voters[participantId] = option;
    results[option] = (results[option] ?? 0) + 1;
    return this.commit(session.snapshot);
  }

  async quiz(id: string, participantId: string, input: unknown): Promise<{ snapshot: SessionSnapshot; score: number }> {
    const session = this.requireParticipant(id, participantId);
    const data = quizSubmissionSchema.parse(input);
    const block = this.requireBlock(session.snapshot, data.blockId, 'QUIZ');
    if (Date.now() - session.blockStartedAt > block.durationMinutes * 60_000) throw new Error('Quiz time has ended.');
    const questions = block.questions ?? [];
    if (!questions.length || data.answers.length !== questions.length) throw new Error('Quiz answers do not match the active quiz.');
    const score = questions.reduce((total, question, index) => total + (question.answerIndex === data.answers[index] ? 1 : 0), 0);
    const results = session.snapshot.recordedState.quizResults[data.blockId] ??= [];
    if (results.some((result) => result.participantId === participantId)) throw new Error('Quiz already submitted.');
    const elapsedMs = Math.min(Date.now() - session.blockStartedAt, block.durationMinutes * 60_000);
    results.push({ participantId, alias: session.snapshot.recordedState.participants[participantId].alias, score, timeMs: elapsedMs, completedAt: new Date().toISOString() });
    session.snapshot.recordedState.participants[participantId].quizScore += score;
    const snapshot = await this.commit(session.snapshot);
    return { snapshot, score };
  }

  async lab(id: string, participantId: string, input: unknown): Promise<SessionSnapshot> {
    const session = this.requireParticipant(id, participantId);
    const data = labSubmissionInputSchema.parse(input);
    this.requireBlock(session.snapshot, data.blockId, 'LAB_3_LENS');
    const participant = session.snapshot.recordedState.participants[participantId];
    participant.selectedLens = data.lens;
    session.snapshot.recordedState.labSubmissions.push({
      id: randomUUID(), participantId, alias: participant.alias, lens: data.lens,
      timestamp: new Date().toISOString(), response: data.response,
    });
    return this.commit(session.snapshot);
  }

  async submitTakeawayFeedback(id: string, participantId: string, input: unknown): Promise<SessionSnapshot> {
    const session = this.requireParticipant(id, participantId);
    if (session.snapshot.blocks[session.snapshot.currentBlockIndex]?.type !== 'HOMEWORK') throw new Error('Takeaway feedback is only available in the closing block.');
    if (session.feedbackParticipants.has(participantId)) throw new Error('Feedback has already been submitted.');
    const data = takeawayFeedbackInputSchema.parse(input);
    if (data.objectivesToApply.some((objective) => !session.snapshot.learningObjectives.includes(objective))) {
      throw new Error('Select objectives from this session.');
    }
    session.snapshot.recordedState.takeawayFeedback.push({ id: randomUUID(), submittedAt: new Date().toISOString(), ...data });
    const snapshot = await this.commit(session.snapshot);
    session.feedbackParticipants.add(participantId);
    return snapshot;
  }

  async askQuestion(id: string, participantId: string, input: unknown): Promise<SessionSnapshot> {
    const session = this.requireParticipant(id, participantId);
    const data = askQuestionInputSchema.parse(input);
    session.snapshot.recordedState.anonymousQuestions.push({
      id: randomUUID(), submittedAt: new Date().toISOString(), text: data.text, votes: 0, answered: false,
    });
    return this.commit(session.snapshot);
  }

  async voteQuestion(id: string, participantId: string, input: unknown): Promise<SessionSnapshot> {
    const session = this.requireParticipant(id, participantId);
    const { questionId } = questionIdInputSchema.parse(input);
    const question = session.snapshot.recordedState.anonymousQuestions.find((item) => item.id === questionId);
    if (!question) throw new Error('Question not found.');
    const voters = session.questionVoters.get(questionId) ?? new Set<string>();
    if (voters.has(participantId)) throw new Error('You have already voted for this question.');
    voters.add(participantId);
    session.questionVoters.set(questionId, voters);
    question.votes += 1;
    return this.commit(session.snapshot);
  }

  async markQuestionAnswered(id: string, input: unknown): Promise<SessionSnapshot> {
    const session = this.requireLive(id);
    const { questionId } = questionIdInputSchema.parse(input);
    const question = session.snapshot.recordedState.anonymousQuestions.find((item) => item.id === questionId);
    if (!question) throw new Error('Question not found.');
    question.answered = true;
    return this.commit(session.snapshot);
  }

  async saveArtifact(id: string, input: unknown): Promise<SessionSnapshot> {
    const session = this.requireLive(id);
    const activeBlock = session.snapshot.blocks[session.snapshot.currentBlockIndex];
    if (!activeBlock || activeBlock.type !== 'SANDBOX_SPIN') throw new Error('Field Tests can only be saved during the sandbox block.');
    const artifact: GeneratedArtifact = generatedArtifactSchema.parse(input);
    if (!artifact.restaurants.some((restaurant) => restaurant.id === artifact.winningRestaurantId)) throw new Error('Winning suggestion is not in this field test.');
    const artifacts = session.snapshot.recordedState.generatedArtifacts;
    const existing = artifacts.findIndex((item) => item.id === artifact.id);
    if (existing === -1) artifacts.push(artifact); else artifacts[existing] = artifact;
    return this.commit(session.snapshot);
  }

  async archive(id: string, token: unknown): Promise<SessionSnapshot> {
    if (!this.authorizePresenter(id, token)) throw new Error('Presenter authorization required.');
    const active = this.requireLive(id);
    active.snapshot.status = 'ARCHIVED';
    const result = await this.commit(active.snapshot);
    this.active.delete(id);
    return result;
  }

  private requireLive(id: string): ActiveSession {
    const session = this.active.get(id);
    if (!session) throw new Error('Live session not found.');
    return session;
  }

  private requireParticipant(id: string, participantId: string): ActiveSession {
    const session = this.requireLive(id);
    if (!session.snapshot.recordedState.participants[participantId]) throw new Error('Join this session before submitting.');
    return session;
  }

  private requireBlock(snapshot: SessionSnapshot, blockId: string, type: SessionBlock['type']): SessionBlock {
    const block = snapshot.blocks.find((candidate) => candidate.id === blockId);
    const activeBlock = snapshot.blocks[snapshot.currentBlockIndex];
    if (!block || block.type !== type || activeBlock?.id !== blockId) throw new Error('Activity is not available in this session.');
    return block;
  }

  private async commit(snapshot: SessionSnapshot): Promise<SessionSnapshot> {
    snapshot.updatedAt = new Date().toISOString();
    const parsed = sessionSnapshotSchema.parse(snapshot);
    await this.persist(parsed);
    return clone(parsed);
  }

  private async persist(snapshot: SessionSnapshot): Promise<void> {
    await mkdir(SESSION_DIR, { recursive: true });
    const destination = path.join(SESSION_DIR, `${snapshot.id}.json`);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(sessionSnapshotSchema.parse(snapshot), null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, destination);
  }
}
