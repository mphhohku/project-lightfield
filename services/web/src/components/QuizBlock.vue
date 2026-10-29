<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { SessionBlock } from '@lightfield/shared';

const props = defineProps<{
  block: SessionBlock;
  leaderboard: Array<{ alias: string; score: number; timeMs: number }>;
  participantId: string;
  interactive: boolean;
  score: number | null;
}>();
const emit = defineEmits<{ submit: [answers: number[], timeMs: number] }>();
const questions = computed(() => props.block.questions ?? []);
const answers = ref<number[]>([]);
const seconds = ref(35);
const submitted = ref(false);
const startedAt = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
const ranked = computed(() => [...props.leaderboard].sort((a, b) => b.score - a.score || a.timeMs - b.timeMs).slice(0, 5));
const canSubmit = computed(() => answers.value.length === questions.value.length && questions.value.every((_question, index) => answers.value[index] !== undefined && answers.value[index] >= 0));
function choose(index: number, answerIndex: number): void { answers.value[index] = answerIndex; answers.value = [...answers.value]; }
function submit(): void {
  if (submitted.value || !props.interactive) return;
  submitted.value = true;
  if (timer) clearInterval(timer);
  emit('submit', questions.value.map((_question, index) => answers.value[index] ?? -1), Math.max(0, Date.now() - startedAt.value));
}
onMounted(() => {
  answers.value = Array(questions.value.length).fill(-1);
  if (props.interactive) timer = setInterval(() => {
    if (seconds.value > 0) seconds.value -= 1;
    else submit();
  }, 1000);
});
onBeforeUnmount(() => { if (timer) clearInterval(timer); });
</script>

<template>
  <div class="activity-stack">
    <div class="quiz-headline">
      <div><div class="activity-kicker">QUICK KNOWLEDGE CHECK</div><h2 class="activity-question">{{ block.title }}</h2></div>
      <div v-if="interactive && !submitted" class="timer-chip" :class="{ urgent: seconds <= 10 }" aria-live="polite"><span>◷</span> 00:{{ String(seconds).padStart(2, '0') }}</div>
    </div>
    <p class="muted-copy">Choose an answer for each question. The leaderboard ranks score, then completion time.</p>
    <section v-for="(question, questionIndex) in questions" :key="questionIndex" class="quiz-question">
      <div class="question-index">QUESTION {{ String(questionIndex + 1).padStart(2, '0') }}</div>
      <h3>{{ question.prompt }}</h3>
      <div class="quiz-options">
        <button v-for="(option, optionIndex) in question.options" :key="optionIndex" class="quiz-option" :class="{ picked: answers[questionIndex] === optionIndex }" :disabled="!interactive || submitted" @click="choose(questionIndex, optionIndex)">
          <span class="option-letter">{{ String.fromCharCode(65 + optionIndex) }}</span>{{ option }}
        </button>
      </div>
    </section>
    <div v-if="interactive" class="quiz-action">
      <button class="button primary" :disabled="!canSubmit || submitted" @click="submit">{{ submitted ? 'Response submitted' : 'Submit answers' }} <span>→</span></button>
      <span v-if="score !== null" class="score-badge">Score: {{ score }} / {{ questions.length }}</span>
    </div>
    <div v-if="ranked.length" class="leaderboard">
      <div class="leaderboard-title"><span>FIELD LOG</span><h3>Fastest thoughtful answers</h3></div>
      <div v-for="(entry, index) in ranked" :key="`${entry.alias}-${index}`" class="leader-row"><span class="rank-number">{{ String(index + 1).padStart(2, '0') }}</span><span>{{ entry.alias }}</span><strong>{{ entry.score }} pts</strong><small>{{ (entry.timeMs / 1000).toFixed(1) }}s</small></div>
    </div>
    <p v-else class="empty-inline">No quiz entries yet. The first responses will appear here.</p>
  </div>
</template>
