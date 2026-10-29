<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AnonymousQuestion } from '@lightfield/shared';

const props = defineProps<{
  questions: AnonymousQuestion[];
  interactive: boolean;
  presenter: boolean;
  votedQuestionIds: string[];
}>();
const emit = defineEmits<{ ask: [text: string]; vote: [questionId: string]; answered: [questionId: string] }>();
const questionText = ref('');
const sortedQuestions = computed(() => [...props.questions].sort((a, b) => Number(a.answered) - Number(b.answered) || b.votes - a.votes || a.submittedAt.localeCompare(b.submittedAt)));

function submitQuestion(): void {
  const text = questionText.value.trim();
  if (text.length < 3 || text.length > 500 || !props.interactive) return;
  emit('ask', text);
  questionText.value = '';
}
</script>

<template>
  <section class="qna-panel" aria-labelledby="qna-title">
    <div class="qna-heading">
      <div><span class="activity-kicker">OPEN FLOOR · ANONYMOUS</span><h2 id="qna-title">Questions for the room</h2><p>Ask without a name. Upvote questions you would like the presenter to answer.</p></div>
      <span class="qna-count">{{ questions.length }} {{ questions.length === 1 ? 'QUESTION' : 'QUESTIONS' }}</span>
    </div>
    <form v-if="interactive" class="qna-form" @submit.prevent="submitQuestion">
      <label class="sr-only" for="anonymous-question">Your anonymous question</label>
      <input id="anonymous-question" v-model="questionText" class="text-input" maxlength="500" minlength="3" placeholder="What would you like to ask?" required />
      <button class="button primary" type="submit" :disabled="questionText.trim().length < 3">Ask anonymously <span>↗</span></button>
    </form>
    <p v-else-if="!presenter" class="qna-readonly">Questions are read-only in this Field Log.</p>
    <div v-if="sortedQuestions.length" class="qna-list">
      <article v-for="question in sortedQuestions" :key="question.id" class="qna-item" :class="{ answered: question.answered }">
        <div class="qna-vote">
          <button type="button" :aria-label="`Upvote question, ${question.votes} votes`" :aria-pressed="votedQuestionIds.includes(question.id)" :disabled="!interactive || votedQuestionIds.includes(question.id)" @click="emit('vote', question.id)">↑</button>
          <strong>{{ question.votes }}</strong>
        </div>
        <div class="qna-copy"><p>{{ question.text }}</p><span>{{ question.answered ? 'ANSWERED' : 'ANONYMOUS QUESTION' }}</span></div>
        <button v-if="presenter && !question.answered" class="button secondary qna-answer" type="button" @click="emit('answered', question.id)">Mark answered</button>
        <span v-else-if="question.answered" class="qna-answered">✓ Answered</span>
      </article>
    </div>
    <div v-else class="qna-empty">No questions yet. Add one to open the conversation.</div>
  </section>
</template>
