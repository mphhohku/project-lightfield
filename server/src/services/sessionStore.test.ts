import { afterEach, describe, expect, it } from 'vitest';
import { readFile, rm } from 'node:fs/promises';
import { SessionStore, SESSION_DIR } from './sessionStore';
import type { GeneratedArtifact } from '@lightfield/shared';

const createdIds: string[] = [];
afterEach(async () => { await Promise.all(createdIds.splice(0).map((id) => rm(`${SESSION_DIR}/${id}.json`, { force: true }))); });

const sampleArtifact: GeneratedArtifact = {
  id: 'field-test-one', timestamp: new Date().toISOString(), triggeredByGroup: 'HKU Lunch Rotator',
  filtersUsed: { campusOrigin: 'MAIN_BUILDING', maxBudgetHKD: 120, maxWalkMins: 30, weatherRoute: 'ANY', vibeInstruction: 'Relaxed lunch' },
  restaurants: [{ id: 'demo-1', name: 'Demo One', cuisine: 'Noodles', priceHKD: 55, walkMins: 10, signatureDish: 'Bowl', pitch: 'Example only.' }],
  winningRestaurantId: 'demo-1', mapSources: [], webSources: [], searchQueries: [], sourceMode: 'demo',
};

describe('JSON session recorder and activities', () => {
  it('loads practical learning objectives and tiered support for every curriculum', async () => {
    const templates = await new SessionStore().templates();
    expect(templates).toHaveLength(3);
    for (const template of templates) {
      expect(template.learningObjectives.length).toBeGreaterThanOrEqual(2);
      expect(template.learningObjectives.length).toBeLessThanOrEqual(3);
      expect(template.blocks.every((block) => block.learningSupport.guidedSteps.length > 0 && block.learningSupport.stretchChallenge.length > 0)).toBe(true);
    }
  });

  it('records live poll, quiz, and three-lens activity, then replays without rewriting the archive', async () => {
    const store = new SessionStore();
    const created = await store.create('Test field log', 'Presenter', '15min-lunch-gacha');
    createdIds.push(created.snapshot.id);
    const participantId = '9bd65010-20c8-4a72-b3b0-bb2c5ee71123';
    await store.join(created.snapshot.id, { participantId, alias: 'Centennial Owl' });
    const vote = await store.poll(created.snapshot.id, participantId, { blockId: 'lunch-poll', option: 'Budget' });
    expect(vote.recordedState.pollResults['lunch-poll'].Budget).toBe(1);
    await store.advance(created.snapshot.id, 1);
    const quiz = await store.quiz(created.snapshot.id, participantId, { blockId: 'grounding-quiz', answers: [1, 1], timeMs: 12000 });
    expect(quiz.score).toBe(2);
    expect(quiz.snapshot.recordedState.quizResults['grounding-quiz'][0].participantId).toBe(participantId);
    await store.advance(created.snapshot.id, 1);
    await store.advance(created.snapshot.id, 1);
    const lab = await store.lab(created.snapshot.id, participantId, { blockId: 'lens-lab', lens: 'GROUNDING', response: 'Verify walking estimates before presenting them.' });
    expect(lab.recordedState.labSubmissions[0].lens).toBe('GROUNDING');
    await store.advance(created.snapshot.id, 1);
    await store.saveArtifact(created.snapshot.id, sampleArtifact);
    const closed = await store.archive(created.snapshot.id, created.presenterToken);
    expect(closed.status).toBe('ARCHIVED');
    expect(closed.recordedState.generatedArtifacts[0].winningRestaurantId).toBe('demo-1');
    const archivePath = `${SESSION_DIR}/${created.snapshot.id}.json`;
    const beforeReplay = await readFile(archivePath, 'utf8');
    const replay = await store.get(created.snapshot.id);
    const afterReplay = await readFile(archivePath, 'utf8');
    expect(replay?.recordedState.labSubmissions).toHaveLength(1);
    expect(afterReplay).toBe(beforeReplay);
  });

  it('stores anonymous takeaway feedback and Q&A while enforcing one vote per participant', async () => {
    const store = new SessionStore();
    const created = await store.create('Reflection test', 'Presenter', '15min-lunch-gacha');
    createdIds.push(created.snapshot.id);
    const participantId = '9bd65010-20c8-4a72-b3b0-bb2c5ee71124';
    await store.join(created.snapshot.id, { participantId, alias: 'Centennial Owl' });
    const feedback = {
      objectivesToApply: [created.snapshot.learningObjectives[0]],
      workplaceAction: 'Review one AI result with the team this week.',
      stars: 'The source-checking exercise was useful.',
      wishes: 'Leave more time for peer discussion.',
    };
    await expect(store.submitTakeawayFeedback(created.snapshot.id, participantId, feedback)).rejects.toThrow('closing block');

    const questionSnapshot = await store.askQuestion(created.snapshot.id, participantId, { text: 'How would we validate this estimate?' });
    const question = questionSnapshot.recordedState.anonymousQuestions[0];
    expect(question.text).toBe('How would we validate this estimate?');
    expect(question).not.toHaveProperty('participantId');
    expect(question).not.toHaveProperty('alias');
    const voted = await store.voteQuestion(created.snapshot.id, participantId, { questionId: question.id });
    expect(voted.recordedState.anonymousQuestions[0].votes).toBe(1);
    await expect(store.voteQuestion(created.snapshot.id, participantId, { questionId: question.id })).rejects.toThrow('already voted');
    const answered = await store.markQuestionAnswered(created.snapshot.id, { questionId: question.id });
    expect(answered.recordedState.anonymousQuestions[0].answered).toBe(true);

    while (store.isLive(created.snapshot.id)) {
      const snapshot = await store.get(created.snapshot.id);
      if (snapshot?.blocks[snapshot.currentBlockIndex]?.type === 'HOMEWORK') break;
      await store.advance(created.snapshot.id, 1);
    }
    const saved = await store.submitTakeawayFeedback(created.snapshot.id, participantId, feedback);
    const entry = saved.recordedState.takeawayFeedback[0];
    expect(entry).toMatchObject(feedback);
    expect(entry).not.toHaveProperty('participantId');
    expect(entry).not.toHaveProperty('alias');
    expect(JSON.stringify(entry)).not.toContain(participantId);
    await expect(store.submitTakeawayFeedback(created.snapshot.id, participantId, feedback)).rejects.toThrow('already been submitted');
  });

  it('rejects secret-bearing artifacts and invalid activity submissions', async () => {
    const store = new SessionStore();
    const created = await store.create('Validation test', 'Presenter', '15min-lunch-gacha');
    createdIds.push(created.snapshot.id);
    await expect(store.saveArtifact(created.snapshot.id, { ...sampleArtifact, apiKey: 'never-store-me' })).rejects.toThrow();
    await expect(store.poll(created.snapshot.id, '00000000-0000-4000-8000-000000000000', { blockId: 'unknown', option: 'bad' })).rejects.toThrow();
    const saved = await store.get(created.snapshot.id);
    expect(JSON.stringify(saved)).not.toContain('never-store-me');
  });
});
