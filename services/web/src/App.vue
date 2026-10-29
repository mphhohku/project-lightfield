<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { LensType } from '@lightfield/shared';
import PollBlock from './components/PollBlock.vue';
import QnaPanel from './components/QnaPanel.vue';
import ScaffoldPanel from './components/ScaffoldPanel.vue';
import TakeawayBlock from './components/TakeawayBlock.vue';
import QuizBlock from './components/QuizBlock.vue';
import ThreeLensLabBlock from './components/ThreeLensLabBlock.vue';
import LunchRotatorBlock from './components/LunchRotatorBlock.vue';
import { useSessionStore } from './stores/session';

const store = useSessionStore();
const presenterName = ref('Field Host');
const sessionTitle = ref('HKU Lunch Rotator · Team Exchange');
const templateId = ref('15min-lunch-gacha');
const selectedLog = ref('');
const copyNotice = ref('');
const startBusy = ref(false);
const selectedTemplate = computed(() => store.templates.find((template) => template.id === templateId.value));
const participantCount = computed(() => Object.keys(store.session?.recordedState.participants ?? {}).length);
const pollCounts = computed(() => store.currentBlock ? store.session?.recordedState.pollResults[store.currentBlock.id] ?? {} : {});
const selectedVote = computed(() => store.currentBlock && store.participantId ? store.session?.recordedState.pollVoters[store.currentBlock.id]?.[store.participantId] ?? '' : '');
const labSubmissions = computed(() => store.session?.recordedState.labSubmissions ?? []);
const quizEntries = computed(() => store.currentBlock ? store.session?.recordedState.quizResults[store.currentBlock.id] ?? [] : []);
const quizScore = computed(() => {
  if (!store.currentBlock || !store.participantId) return null;
  const saved = quizEntries.value.find((entry) => entry.participantId === store.participantId);
  return saved?.score ?? (store.lastQuizScore?.blockId === store.currentBlock.id ? store.lastQuizScore.score : null);
});
const totalPollVotes = computed(() => Object.values(store.session?.recordedState.pollResults ?? {}).reduce((sum, results) => sum + Object.values(results).reduce((inner, count) => inner + count, 0), 0));
const invitationUrl = computed(() => store.session ? `${window.location.origin}${window.location.pathname}?session=${encodeURIComponent(store.session.id)}` : '');
const questions = computed(() => store.session?.recordedState.anonymousQuestions ?? []);
const takeawayFeedback = computed(() => store.session?.recordedState.takeawayFeedback ?? []);
const theme = ref<'dark' | 'light'>(localStorage.getItem('lightfield-theme') === 'light' ? 'light' : 'dark');

function toggleTheme(): void {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  localStorage.setItem('lightfield-theme', theme.value);
}

onMounted(async () => {
  await store.refreshLogs();
  const querySession = new URLSearchParams(location.search).get('session');
  if (querySession) await store.openSessionFromUrl(querySession);
});

async function startSession(): Promise<void> {
  startBusy.value = true;
  try {
    await store.startSession({ title: sessionTitle.value, presenterName: presenterName.value, templateId: templateId.value });
    selectedLog.value = store.session?.id ?? '';
  } catch { /* store displays a safe, user-facing error */ }
  finally { startBusy.value = false; }
}
async function chooseLog(id: string): Promise<void> {
  if (!id) return;
  if (id === store.session?.id && store.mode === 'live') return;
  try { await store.joinSession(id); selectedLog.value = id; }
  catch { selectedLog.value = store.session?.id ?? ''; }
}
async function copyInvite(): Promise<void> {
  if (!invitationUrl.value) return;
  try { await navigator.clipboard.writeText(invitationUrl.value); copyNotice.value = 'Join link copied'; }
  catch { copyNotice.value = invitationUrl.value; }
  window.setTimeout(() => { copyNotice.value = ''; }, 4000);
}
function openFromLanding(id: string): void { void chooseLog(id); }
function downloadFieldNotes(): void {
  const notes = `# Lightfield · Field Notes\n\n## Evidence before confidence\n- Identify which claims need current, source-backed verification.\n- Treat citations as useful trails to inspect, not guarantees.\n\n## Design for the whole team\n- Experience: make loading, error, and empty states understandable.\n- Grounding: make constraints and source coverage visible.\n- Payload: send only necessary data and keep credentials out of archives.\n\n## Next experiment\n1. State a question you can test.\n2. Choose one success signal.\n3. Record an owner and a review date.\n`;
  const url = URL.createObjectURL(new Blob([notes], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'lightfield-field-notes.md'; link.click(); URL.revokeObjectURL(url);
}
function handleQuizSubmit(answers: number[], timeMs: number): void {
  if (store.currentBlock) store.submitQuiz(store.currentBlock.id, answers, timeMs);
}
function handleLabSubmit(lens: LensType, response: string): void {
  if (store.currentBlock) store.submitLab(store.currentBlock.id, lens, response);
}
function blockIcon(type: string): string {
  return ({ POLL: '◉', QUIZ: '✳', CONCEPT: '◌', LAB_3_LENS: '⌗', SANDBOX_SPIN: '↻', HOMEWORK: '↗' } as Record<string, string>)[type] ?? '•';
}
function labelForBlock(type: string): string {
  return ({ POLL: 'POLL', QUIZ: 'QUIZ', CONCEPT: 'CONCEPT', LAB_3_LENS: '3-LENS LAB', SANDBOX_SPIN: 'FIELD TEST', HOMEWORK: 'TAKEAWAY' } as Record<string, string>)[type] ?? type;
}
</script>

<template>
  <div class="app-frame" :data-theme="theme">
    <header class="topbar">
      <a class="brand-lockup" href="#" aria-label="Lightfield home" @click.prevent="store.leave()">
        <span class="brand-mark"><i /><i /><i /></span>
        <span class="brand-word">LIGHTFIELD<span class="brand-slash"> // </span><small>HKU AI FIELDWORK</small></span>
      </a>
      <div class="topbar-right">
        <label v-if="store.activeSessions.length || store.archives.length" class="field-log-picker"><span>FIELD LOGS</span>
          <select v-model="selectedLog" aria-label="Open a live session or archived Field Log" @change="chooseLog(selectedLog)">
            <option value="">Choose a Field Log</option>
            <optgroup v-if="store.activeSessions.length" label="LIVE NOW">
              <option v-for="log in store.activeSessions" :key="log.id" :value="log.id">{{ log.title }}</option>
            </optgroup>
            <optgroup v-if="store.archives.length" label="RECORDED FIELD LOGS">
              <option v-for="log in store.archives" :key="log.id" :value="log.id">{{ new Date(log.createdAt).toLocaleDateString() }} · {{ log.title }}</option>
            </optgroup>
          </select>
        </label>
        <div v-if="store.mode === 'live'" class="connection-indicator" :class="{ disconnected: !store.connected }"><span />{{ store.connected ? 'LIVE ROOM' : 'RECONNECTING' }}</div>
        <button class="button secondary theme-toggle" type="button" :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">{{ theme === 'dark' ? '☼ Light' : '☾ Dark' }}</button>
        <button class="profile-button" :title="store.alias || 'No participant joined'" aria-label="Participant profile">{{ store.alias ? store.alias.slice(0, 1) : 'LF' }}</button>
      </div>
    </header>

    <main v-if="!store.session" class="landing-page">
      <section class="landing-hero">
        <div class="hero-eyebrow"><span class="eyebrow-line" /> HKU AI FIELDWORK & KNOWLEDGE EXCHANGE</div>
        <h1>Learn by looking<br /><em>through every lens.</em></h1>
        <p>A shared field for ideas, experiments, and the small details that make AI useful. Host a live exchange or join your team's Field Log.</p>
        <div class="hero-signature"><span>01</span><span>EXPERIENCE</span><i /> <span>02</span><span>GROUNDING</span><i /> <span>03</span><span>PAYLOAD</span></div>
        <div class="hero-orbit" aria-hidden="true"><div class="orbit-ring ring-a" /><div class="orbit-ring ring-b" /><div class="orbit-ring ring-c" /><div class="orbit-core"><span>LF</span><small>FIELD / 03</small></div><span class="orbit-caption cap-a">NOTICE</span><span class="orbit-caption cap-b">VERIFY</span><span class="orbit-caption cap-c">REFLECT</span></div>
      </section>

      <section class="launch-grid">
        <div class="launch-panel host-panel">
          <div class="panel-index">START A SESSION <span>01 / HOST</span></div>
          <h2>Set the room<br />in motion.</h2>
          <p>Choose a format. Your live room and Field Log are ready in a moment.</p>
          <form class="start-form" @submit.prevent="startSession">
            <label class="field-label">Session title<input v-model="sessionTitle" class="text-input" required maxlength="180" /></label>
            <label class="field-label">Presenter name<input v-model="presenterName" class="text-input" required maxlength="80" /></label>
            <label class="field-label">Starting curriculum
              <select v-model="templateId" class="text-input" required><option v-for="template in store.templates" :key="template.id" :value="template.id">{{ template.title }} · {{ template.durationMode.replace('_', ' ') }}</option></select>
            </label>
            <button class="button primary wide-button" type="submit" :disabled="startBusy || !store.templates.length">{{ startBusy ? 'Opening your room…' : 'Create live session' }} <span>↗</span></button>
          </form>
          <div class="launch-footnote"><span>●</span> No login. Your participant link works immediately.</div>
        </div>

        <div class="launch-panel join-panel">
          <div class="panel-index">JOIN OR REVISIT <span>02 / PARTICIPATE</span></div>
          <h2>Find your<br />Field Log.</h2>
          <p>Join live with a generated HKU alias, or browse a past session at your own pace.</p>
          <div v-if="store.activeSessions.length" class="log-list">
            <button v-for="log in store.activeSessions" :key="log.id" class="log-card live-log" @click="openFromLanding(log.id)"><span class="log-card-icon">↗</span><span><strong>{{ log.title }}</strong><small>{{ log.presenterName }} · {{ log.recordedState.participants && Object.keys(log.recordedState.participants).length }} participants</small></span><span class="live-tag">LIVE</span></button>
          </div>
          <div v-else class="empty-log"><span>◌</span><strong>The room is quiet for now.</strong><small>Start a session or come back to a shared link.</small></div>
          <div v-if="store.archives.length" class="archive-shortlist"><div class="archive-shortlist-title">RECENT RECORDINGS</div>
            <button v-for="log in store.archives.slice(0, 3)" :key="log.id" class="archive-link" @click="openFromLanding(log.id)"><span>{{ new Date(log.createdAt).toLocaleDateString() }}</span><strong>{{ log.title }}</strong><span>↗</span></button>
          </div>
        </div>
      </section>

      <section class="value-strip"><div><span>01</span><strong>Live by design</strong><small>Polls, quizzes, and shared field notes.</small></div><div><span>02</span><strong>Replay with context</strong><small>Every session becomes a portable JSON log.</small></div><div><span>03</span><strong>Test with evidence</strong><small>Bring a key, inspect sources, or start with demo data.</small></div></section>
      <footer class="page-footer"><span>LIGHTFIELD / HKU</span><span>NOTICE · VERIFY · REFLECT</span><span>FIELD NOTES FOR WHAT'S NEXT</span></footer>
    </main>

    <main v-else class="session-page">
      <div class="session-heading">
        <div class="session-heading-title"><button class="back-button" aria-label="Back to Lightfield home" @click="store.leave()">←</button><div><div class="session-overline">{{ store.mode === 'replay' ? 'FIELD LOG / REPLAY' : 'LIVE SESSION / FIELDWORK' }}</div><h1>{{ store.session.title }}</h1></div></div>
        <div class="session-heading-actions">
          <span class="session-status" :class="store.session.status === 'LIVE' ? 'status-live' : 'status-archive'"><i />{{ store.session.status === 'LIVE' ? 'LIVE' : 'RECORDED' }}</span>
          <button v-if="store.isPresenter" class="button secondary" @click="copyInvite">{{ copyNotice === 'Join link copied' ? 'Link copied ✓' : 'Copy join link' }} <span>↗</span></button>
          <button v-if="store.isPresenter" class="button archive-button" @click="store.archive()">End session &amp; save Field Log</button>
          <button v-else-if="store.mode === 'live'" class="button secondary" @click="store.leave()">Leave room</button>
          <button v-else class="button secondary" @click="store.leave()">Back to sessions</button>
        </div>
      </div>
      <div v-if="store.mode === 'live' && store.role === 'participant'" class="participant-ribbon"><span class="participant-avatar">{{ store.alias.slice(0, 1) }}</span><span>Welcome, <strong>{{ store.alias }}</strong></span><span class="ribbon-divider" /> <span>You joined without an account</span><span class="ribbon-spacer" /><button class="button text-button" @click="copyInvite">{{ copyNotice || 'Share session link' }}</button></div>
      <div v-if="store.error" class="global-alert" role="alert"><span>!</span>{{ store.error }}<button aria-label="Dismiss" @click="store.error = ''">×</button></div>

      <section class="learning-objectives-card" aria-labelledby="objectives-title">
        <div class="objectives-intro"><span class="activity-kicker">START WITH THE OUTCOME</span><h2 id="objectives-title">Three things to take back to work.</h2><p>We will return to these objectives in the takeaway.</p></div>
        <ol><li v-for="(objective, index) in store.session.learningObjectives" :key="objective"><span>{{ String(index + 1).padStart(2, '0') }}</span>{{ objective }}</li></ol>
      </section>

      <div class="workbench">
        <aside class="curriculum-rail">
          <div class="rail-topline"><span>FIELD GUIDE</span><span>{{ String(store.session.blocks.length).padStart(2, '0') }} STEPS</span></div>
          <div class="rail-progress"><span :style="{ width: `${((store.session.currentBlockIndex + 1) / store.session.blocks.length) * 100}%` }" /></div>
          <button v-for="(block, index) in store.session.blocks" :key="block.id" class="block-nav" :class="{ current: store.session.currentBlockIndex === index, complete: store.session.currentBlockIndex > index }" :aria-current="store.session.currentBlockIndex === index ? 'step' : undefined" @click="store.mode === 'replay' ? (store.session.currentBlockIndex = index) : undefined">
            <span class="block-marker">{{ store.session.currentBlockIndex > index ? '✓' : blockIcon(block.type) }}</span><span class="block-nav-copy"><small>{{ labelForBlock(block.type) }} · {{ String(index + 1).padStart(2, '0') }}</small><strong>{{ block.title }}</strong><em>{{ block.durationMinutes }} min</em></span>
          </button>
          <div class="rail-bottom"><span class="rail-note-icon">⌁</span><p>Every perspective<br />adds a new focus.</p><span class="rail-caption">FIELDWORK / {{ store.session.durationMode.replace('_', ' ') }}</span></div>
        </aside>

        <section v-if="store.currentBlock" class="activity-column">
          <div class="block-meta"><div><span class="block-meta-number">{{ String(store.session.currentBlockIndex + 1).padStart(2, '0') }}</span><span class="block-meta-slash">/</span><span class="block-meta-total">{{ String(store.session.blocks.length).padStart(2, '0') }}</span><span class="block-meta-type">{{ labelForBlock(store.currentBlock.type) }}</span></div><span class="duration-pill">◷ &nbsp;{{ store.currentBlock.durationMinutes }} MIN</span></div>
          <p class="block-description">{{ store.currentBlock.description }}</p>
          <ScaffoldPanel :support="store.currentBlock.learningSupport" />

          <div v-if="store.currentBlock.type === 'POLL'" class="activity-card">
            <PollBlock :block="store.currentBlock" :counts="pollCounts" :selected-option="selectedVote" :interactive="store.mode === 'live' && store.role === 'participant'" @vote="store.submitPoll(store.currentBlock!.id, $event)" />
          </div>
          <div v-else-if="store.currentBlock.type === 'QUIZ'" class="activity-card">
            <QuizBlock :key="store.currentBlock.id" :block="store.currentBlock" :leaderboard="quizEntries" :participant-id="store.participantId" :interactive="store.mode === 'live' && store.role === 'participant' && !quizEntries.some((entry) => entry.participantId === store.participantId)" :score="quizScore" @submit="handleQuizSubmit" />
          </div>
          <div v-else-if="store.currentBlock.type === 'LAB_3_LENS'" class="activity-card">
            <ThreeLensLabBlock :block="store.currentBlock" :submissions="labSubmissions" :selected-lens="store.participantId ? store.session.recordedState.participants[store.participantId]?.selectedLens : undefined" :interactive="store.mode === 'live' && store.role === 'participant'" @submit="handleLabSubmit" />
          </div>
          <div v-else-if="store.currentBlock.type === 'SANDBOX_SPIN'" class="activity-card rotator-card">
            <LunchRotatorBlock :key="store.currentBlock.id" :block="store.currentBlock" :session-id="store.session.id" :latest-artifact="store.latestArtifact" :can-save="store.isPresenter" @save="store.saveArtifact" />
          </div>
          <div v-else-if="store.currentBlock.type === 'CONCEPT'" class="activity-card concept-card"><div class="concept-symbol">◌</div><div class="activity-kicker">A SHARED FRAME</div><h2 class="activity-question">{{ store.currentBlock.title }}</h2><p class="concept-copy">{{ store.currentBlock.description }}</p><div class="concept-callout"><span>FIELD NOTE</span><p>Good systems make evidence visible, keep room for human judgment, and remain useful when a dependency is unavailable.</p></div><div class="concept-footer"><span>LIGHTFIELD / {{ store.session.durationMode.replace('_', ' ') }}</span><span>NOTICE · VERIFY · REFLECT</span></div></div>
          <div v-else class="activity-card homework-card"><div class="activity-kicker">CLOSE THE LOOP</div><h2 class="activity-question">{{ store.currentBlock.title }}</h2><p class="concept-copy">{{ store.currentBlock.description }}</p><TakeawayBlock :objectives="store.session.learningObjectives" :interactive="store.mode === 'live' && store.role === 'participant'" :submitted="store.feedbackSubmitted" :feedback="takeawayFeedback" :show-feedback="store.isPresenter || store.mode === 'replay'" @submit="store.submitTakeawayFeedback" /><button class="button secondary" @click="downloadFieldNotes">Download field notes <span>↓</span></button><div class="concept-footer"><span>FIELD LOG / {{ store.session.title }}</span><span>END OF FIELDWORK</span></div></div>

          <div class="step-controls"><button class="button secondary" :disabled="store.session.currentBlockIndex === 0 || (store.mode === 'live' && !store.isPresenter)" @click="store.advance('previous')">← Previous</button><div class="step-control-center"><span>{{ store.session.currentBlockIndex + 1 }} of {{ store.session.blocks.length }}</span><span v-if="store.mode === 'replay'">Replay controls never alter the archive</span><span v-else-if="store.isPresenter">Presenter controls · changes appear live</span><span v-else>Waiting for the presenter to advance</span></div><button class="button primary" :disabled="store.session.currentBlockIndex >= store.session.blocks.length - 1 || (store.mode === 'live' && !store.isPresenter)" @click="store.advance('next')">Next step <span>→</span></button></div>
        </section>

        <aside class="insight-rail">
          <div class="insight-card room-card"><div class="insight-head"><span>THE ROOM</span><span class="room-spark">✳</span></div><div class="room-count">{{ String(participantCount).padStart(2, '0') }}<small>participants</small></div><div class="room-divider" /><div class="room-stat"><span>Poll responses</span><strong>{{ totalPollVotes }}</strong></div><div class="room-stat"><span>Lens notes</span><strong>{{ labSubmissions.length }}</strong></div><div class="room-stat"><span>Field Tests</span><strong>{{ store.session.recordedState.generatedArtifacts.length }}</strong></div></div>
          <div class="insight-card now-card"><div class="insight-head"><span>IN FOCUS</span><span>{{ store.currentBlock ? String(store.session.currentBlockIndex + 1).padStart(2, '0') : '—' }}</span></div><h3>{{ store.currentBlock?.title }}</h3><p>{{ store.currentBlock ? labelForBlock(store.currentBlock.type) : '' }} · {{ store.currentBlock?.durationMinutes }} MIN</p><div class="focus-rule" /><div class="lens-mini-list"><div><i class="lens-dot experience" /><span>Experience</span><small>People &amp; intent</small></div><div><i class="lens-dot grounding" /><span>Grounding</span><small>Evidence &amp; fit</small></div><div><i class="lens-dot payload" /><span>Payload</span><small>Data &amp; boundaries</small></div></div></div>
          <div v-if="store.latestArtifact" class="latest-field-test"><span>LAST FIELD TEST</span><strong>{{ store.latestArtifact.restaurants.find((item) => item.id === store.latestArtifact?.winningRestaurantId)?.name || 'Saved result' }}</strong><small>{{ store.latestArtifact.sourceMode === 'demo' ? 'Demonstration data' : store.latestArtifact.sourceMode === 'unverified' ? 'Live response · no citations' : `${store.latestArtifact.mapSources.length + store.latestArtifact.webSources.length} citations` }}</small></div>
          <div class="side-quote"><span>“</span><p>Refocus the same moment from a different lens.</p><small>LIGHTFIELD / FIELD PRINCIPLE</small></div>
        </aside>
      </div>
      <QnaPanel :questions="questions" :interactive="store.mode === 'live' && store.role === 'participant'" :presenter="store.isPresenter" :voted-question-ids="store.votedQuestionIds" @ask="store.askQuestion" @vote="store.voteQuestion" @answered="store.markQuestionAnswered" />
      <footer class="session-footer"><span>LIGHTFIELD / {{ store.session.id.slice(0, 8).toUpperCase() }}</span><span>{{ store.mode === 'replay' ? 'REPLAY MODE · READ ONLY' : store.connected ? 'SOCKET.IO · CONNECTED' : 'WAITING FOR CONNECTION' }}</span><span>JSON FIELD LOG / {{ store.session.status }}</span></footer>
    </main>
  </div>
</template>
