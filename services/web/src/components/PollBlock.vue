<script setup lang="ts">
import { computed } from 'vue';
import type { SessionBlock } from '@lightfield/shared';

const props = defineProps<{
  block: SessionBlock;
  counts: Record<string, number>;
  selectedOption: string;
  interactive: boolean;
}>();
const emit = defineEmits<{ vote: [option: string] }>();
const options = computed(() => props.block.options ?? []);
const total = computed(() => Object.values(props.counts).reduce((sum, count) => sum + count, 0));
function percent(option: string): number { return total.value ? Math.round(((props.counts[option] ?? 0) / total.value) * 100) : 0; }
</script>

<template>
  <div class="activity-stack">
    <div class="activity-kicker"><span class="live-dot" /> PARTICIPANT PULSE</div>
    <h2 class="activity-question">{{ block.prompt || block.title }}</h2>
    <p class="muted-copy">One response per participant. You can change your vote while the session is live.</p>
    <div class="poll-options" role="group" :aria-label="block.prompt || 'Poll options'">
      <button v-for="option in options" :key="option" class="poll-option" :class="{ selected: selectedOption === option }" :disabled="!interactive" @click="emit('vote', option)">
        <span class="poll-option-top"><span>{{ option }}</span><strong>{{ counts[option] ?? 0 }} <small>{{ percent(option) }}%</small></strong></span>
        <span class="poll-track"><span class="poll-fill" :style="{ width: `${percent(option)}%` }" /></span>
      </button>
    </div>
    <div class="activity-footnote"><span class="tiny-icon">↗</span> {{ total }} {{ total === 1 ? 'response' : 'responses' }} · results update live</div>
  </div>
</template>
