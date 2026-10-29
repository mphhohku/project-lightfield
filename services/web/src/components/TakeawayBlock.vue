<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TakeawayFeedback, TakeawayFeedbackInput } from '@lightfield/shared';

const props = defineProps<{
  objectives: string[];
  interactive: boolean;
  submitted: boolean;
  feedback: TakeawayFeedback[];
  showFeedback: boolean;
}>();
const emit = defineEmits<{ submit: [input: TakeawayFeedbackInput] }>();
const selectedObjectives = ref<string[]>([]);
const workplaceAction = ref('');
const stars = ref('');
const wishes = ref('');
const canSubmit = computed(() => props.interactive && selectedObjectives.value.length > 0 && !!workplaceAction.value.trim() && !!stars.value.trim() && !!wishes.value.trim());

function submit(): void {
  if (!canSubmit.value) return;
  emit('submit', {
    objectivesToApply: [...selectedObjectives.value],
    workplaceAction: workplaceAction.value.trim(),
    stars: stars.value.trim(),
    wishes: wishes.value.trim(),
  });
}
</script>

<template>
  <section class="takeaway-panel" aria-labelledby="takeaway-title">
    <div class="activity-kicker">REVISIT · REFLECT · APPLY</div>
    <h2 id="takeaway-title">Take one useful thing back to work.</h2>
    <p class="takeaway-intro">Revisit the objectives from the opening. Choose what you will apply, then make your next step concrete.</p>
    <form v-if="interactive && !submitted" class="takeaway-form" @submit.prevent="submit">
      <fieldset class="objective-checklist">
        <legend>Which learning objective will you use?</legend>
        <label v-for="objective in objectives" :key="objective" class="objective-option">
          <input v-model="selectedObjectives" type="checkbox" :value="objective" />
          <span>{{ objective }}</span>
        </label>
      </fieldset>
      <label class="field-label">One action I will try at work<textarea v-model="workplaceAction" class="text-input takeaway-textarea" maxlength="800" placeholder="This week, I will…" required /></label>
      <div class="stars-wishes-grid">
        <label class="field-label">Stars · what helped or worked well?<textarea v-model="stars" class="text-input takeaway-textarea" maxlength="1000" placeholder="A moment, idea, or activity worth keeping…" required /></label>
        <label class="field-label">Wishes · what could be better or different?<textarea v-model="wishes" class="text-input takeaway-textarea" maxlength="1000" placeholder="A question, change, or support you would like…" required /></label>
      </div>
      <p class="anonymous-note">Your Stars and Wishes are saved without your name or participant ID.</p>
      <button class="button primary" type="submit" :disabled="!canSubmit">Save anonymous takeaway <span>↗</span></button>
    </form>
    <p v-else-if="submitted" class="feedback-confirmation" role="status">Thank you. Your anonymous reflection has been saved.</p>
    <ul v-else class="takeaway-objectives-readonly"><li v-for="objective in objectives" :key="objective">{{ objective }}</li></ul>

    <div v-if="showFeedback && feedback.length" class="feedback-results">
      <h3>ANONYMOUS STARS AND WISHES · {{ feedback.length }} RESPONSES</h3>
      <article v-for="entry in feedback" :key="entry.id" class="feedback-entry">
        <p><strong>★ Stars</strong> {{ entry.stars }}</p>
        <p><strong>↗ Wishes</strong> {{ entry.wishes }}</p>
        <small>Workplace action: {{ entry.workplaceAction }}</small>
      </article>
    </div>
  </section>
</template>
