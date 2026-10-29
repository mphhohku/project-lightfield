<script setup lang="ts">
import type { LearningSupport } from '@lightfield/shared';

defineProps<{ support: LearningSupport }>();
</script>

<template>
  <details class="scaffold-panel">
    <summary>Need a starting point? <span>Optional guided steps and stretch challenge</span></summary>
    <div class="scaffold-content">
      <div v-if="support.guidedSteps.length">
        <h3>GUIDED STEPS</h3>
        <ol><li v-for="step in support.guidedSteps" :key="step">{{ step }}</li></ol>
      </div>
      <p v-if="support.hint" class="scaffold-hint"><strong>HINT</strong> {{ support.hint }}</p>
      <div v-if="support.stretchChallenge" class="scaffold-stretch">
        <h3>GO FURTHER · OPTIONAL</h3>
        <p>{{ support.stretchChallenge }}</p>
      </div>
    </div>
  </details>
</template>
