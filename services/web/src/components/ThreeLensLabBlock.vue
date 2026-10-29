<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { lensLabels } from '../lib/aliases';
import type { LensType, SessionBlock } from '@lightfield/shared';

const props = defineProps<{
  block: SessionBlock;
  interactive: boolean;
  selectedLens?: LensType;
  submissions: Array<{ id: string; alias: string; lens: LensType; response: string; timestamp: string }>;
}>();
const emit = defineEmits<{ submit: [lens: LensType, response: string] }>();
const lens = ref<LensType>(props.selectedLens ?? 'EXPERIENCE');
const response = ref('');
const lensKeys = Object.keys(lensLabels) as LensType[];
const notes = computed(() => [...props.submissions].reverse());
watch(() => props.selectedLens, (value) => { if (value) lens.value = value; });
function submit(): void {
  const value = response.value.trim();
  if (!value || !props.interactive) return;
  emit('submit', lens.value, value);
  response.value = '';
}
</script>

<template>
  <div class="activity-stack">
    <div class="activity-kicker">THREE LENSES · EQUAL STATUS</div>
    <h2 class="activity-question">{{ block.title }}</h2>
    <p class="muted-copy">Pick the perspective you want to add. Each lens contributes a different, equally important field note.</p>
    <div class="lens-tabs" role="tablist" aria-label="Field lenses">
      <button v-for="key in lensKeys" :key="key" class="lens-tab" :class="{ active: lens === key }" :aria-selected="lens === key" role="tab" @click="lens = key">
        <span class="lens-tab-index">0{{ lensKeys.indexOf(key) + 1 }}</span><strong>{{ lensLabels[key].label }}</strong>
      </button>
    </div>
    <div class="lens-prompt"><div class="lens-prompt-label">{{ lensLabels[lens].title }}</div><p>{{ lensLabels[lens].focus }}</p>
      <label class="field-label" for="lens-note">Your field note</label>
      <textarea id="lens-note" v-model="response" class="text-input lens-textarea" maxlength="3000" :disabled="!interactive" :placeholder="lens === 'EXPERIENCE' ? 'Describe a moment that should feel clear, useful, or reassuring…' : lens === 'GROUNDING' ? 'Name one constraint and how you would verify it…' : 'Outline one data or request detail that needs careful handling…'" />
      <div class="lens-submit-row"><span class="character-count">{{ response.length }} / 3000</span><button class="button primary" :disabled="!interactive || !response.trim()" @click="submit">Add field note <span>↗</span></button></div>
    </div>
    <div class="submission-list"><div class="submission-heading"><h3>Collected perspectives</h3><span class="count-pill">{{ submissions.length }}</span></div>
      <article v-for="note in notes.slice(0, 8)" :key="note.id" class="submission-note"><div><strong>{{ note.alias }}</strong><span class="lens-label" :class="`lens-${note.lens.toLowerCase()}`">{{ lensLabels[note.lens].label }}</span></div><p>{{ note.response }}</p></article>
      <p v-if="!submissions.length" class="empty-inline">No notes yet. A short, specific observation is a great start.</p>
    </div>
  </div>
</template>
