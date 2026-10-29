import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { io, type Socket } from 'socket.io-client';
import type { GeneratedArtifact, SessionSnapshot, TakeawayFeedbackInput } from '@lightfield/shared';
import { api, makeHkuAlias, type SessionIndex } from '../lib/api';

type Mode = 'idle' | 'live' | 'replay';
type Role = 'presenter' | 'participant' | null;

export const useSessionStore = defineStore('session', () => {
  const session = ref<SessionSnapshot | null>(null);
  const activeSessions = ref<SessionSnapshot[]>([]);
  const archives = ref<SessionSnapshot[]>([]);
  const templates = ref<SessionIndex['templates']>([]);
  const mode = ref<Mode>('idle');
  const role = ref<Role>(null);
  const participantId = ref('');
  const alias = ref('');
  const presenterToken = ref('');
  const connected = ref(false);
  const error = ref('');
  const lastQuizScore = ref<{ blockId: string; score: number } | null>(null);
  const feedbackSubmitted = ref(false);
  const votedQuestionIds = ref<string[]>([]);
  let socket: Socket | null = null;

  const currentBlock = computed(() => session.value?.blocks[session.value.currentBlockIndex] ?? null);
  const isPresenter = computed(() => role.value === 'presenter' && mode.value === 'live');
  const latestArtifact = computed(() => session.value?.recordedState.generatedArtifacts.at(-1) ?? null);

  async function refreshLogs(): Promise<void> {
    error.value = '';
    try {
      const result = await api.listSessions();
      activeSessions.value = result.active;
      archives.value = result.archives;
      templates.value = result.templates;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to load Field Logs.'; }
  }

  function disconnect(): void {
    if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null; }
    connected.value = false;
  }

  function connect(sessionId: string, joinPayload: Record<string, string>): void {
    disconnect();
    error.value = '';
    const next = io({ path: '/socket.io', autoConnect: true, reconnection: true, transports: ['websocket', 'polling'] });
    socket = next;
    next.on('connect', () => { connected.value = true; next.emit('join_session', { sessionId, ...joinPayload }); });
    next.on('disconnect', () => { connected.value = false; });
    next.on('session_state', (snapshot: SessionSnapshot) => { session.value = snapshot; });
    next.on('session_updated', (snapshot: SessionSnapshot) => { session.value = snapshot; });
    next.on('session_archived', (snapshot: SessionSnapshot) => {
      session.value = snapshot;
      mode.value = 'replay';
      role.value = null;
      presenterToken.value = '';
      participantId.value = '';
      disconnect();
      void refreshLogs();
    });
    next.on('quiz_scored', (result: { blockId: string; score: number }) => { lastQuizScore.value = result; });
    next.on('takeaway_feedback_saved', () => { feedbackSubmitted.value = true; });
    next.on('operation_error', (result: { message?: string }) => { error.value = result?.message || 'The live action could not be completed.'; });
  }

  async function startSession(input: { title: string; presenterName: string; templateId: string }): Promise<void> {
    error.value = '';
    try {
      const result = await api.startSession(input);
      session.value = result.session;
      presenterToken.value = result.presenterToken;
      participantId.value = '';
      feedbackSubmitted.value = false;
      votedQuestionIds.value = [];
      alias.value = input.presenterName;
      role.value = 'presenter';
      mode.value = 'live';
      connect(result.session.id, { role: 'presenter', presenterToken: result.presenterToken });
      history.replaceState(null, '', `?session=${encodeURIComponent(result.session.id)}`);
      await refreshLogs();
    } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to start a session.'; throw cause; }
  }

  async function joinSession(sessionId: string): Promise<void> {
    error.value = '';
    try {
      const { session: selected } = await api.getSession(sessionId);
      session.value = selected;
      if (selected.status === 'LIVE') {
        participantId.value = crypto.randomUUID();
        feedbackSubmitted.value = false;
        votedQuestionIds.value = [];
        alias.value = makeHkuAlias();
        role.value = 'participant';
        mode.value = 'live';
        presenterToken.value = '';
        connect(selected.id, { role: 'participant', participantId: participantId.value, alias: alias.value });
      } else {
        disconnect();
        participantId.value = '';
        role.value = null;
        mode.value = 'replay';
        presenterToken.value = '';
      }
      history.replaceState(null, '', `?session=${encodeURIComponent(selected.id)}`);
    } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to open this Field Log.'; throw cause; }
  }

  async function openSessionFromUrl(sessionId: string): Promise<void> {
    try { await joinSession(sessionId); } catch { history.replaceState(null, '', location.pathname); }
  }

  function advance(direction: 'next' | 'previous'): void {
    if (mode.value === 'replay' && session.value) {
      const delta = direction === 'next' ? 1 : -1;
      session.value = { ...session.value, currentBlockIndex: Math.max(0, Math.min(session.value.blocks.length - 1, session.value.currentBlockIndex + delta)) };
      return;
    }
    socket?.emit('advance_block', { direction });
  }

  function submitPoll(blockId: string, option: string): void { socket?.emit('submit_poll', { blockId, option }); }
  function submitQuiz(blockId: string, answers: number[], timeMs: number): void { socket?.emit('submit_quiz', { blockId, answers, timeMs }); }
  function submitLab(blockId: string, lens: string, response: string): void { socket?.emit('submit_lab', { blockId, lens, response }); }
  function askQuestion(text: string): void { socket?.emit('ask_anonymous_question', { text }); }
  function voteQuestion(questionId: string): void {
    if (votedQuestionIds.value.includes(questionId)) return;
    votedQuestionIds.value = [...votedQuestionIds.value, questionId];
    socket?.emit('vote_anonymous_question', { questionId });
  }
  function markQuestionAnswered(questionId: string): void { socket?.emit('mark_question_answered', { questionId }); }
  function submitTakeawayFeedback(input: TakeawayFeedbackInput): void { socket?.emit('submit_takeaway_feedback', input); }

  async function saveArtifact(artifact: GeneratedArtifact): Promise<void> {
    if (!session.value || mode.value !== 'live' || role.value !== 'presenter') return;
    try {
      const { session: updated } = await api.saveArtifact(session.value.id, artifact, presenterToken.value);
      session.value = updated;
      await refreshLogs();
    } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to save this Field Test.'; }
  }

  async function archive(): Promise<void> {
    if (!session.value || !presenterToken.value) return;
    try {
      const { session: archived } = await api.archiveSession(session.value.id, presenterToken.value);
      session.value = archived;
      mode.value = 'replay';
      role.value = null;
      presenterToken.value = '';
      disconnect();
      await refreshLogs();
    } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to archive this Field Log.'; }
  }

  function leave(): void {
    disconnect();
    session.value = null;
    role.value = null;
    mode.value = 'idle';
    presenterToken.value = '';
    participantId.value = '';
    history.replaceState(null, '', location.pathname);
  }

  return {
    session, activeSessions, archives, templates, mode, role, participantId, alias,
    connected, error, lastQuizScore, feedbackSubmitted, votedQuestionIds, currentBlock, isPresenter, latestArtifact,
    refreshLogs, startSession, joinSession, openSessionFromUrl, advance,
    submitPoll, submitQuiz, submitLab, askQuestion, voteQuestion, markQuestionAnswered, submitTakeawayFeedback,
    saveArtifact, archive, leave,
  };
});
