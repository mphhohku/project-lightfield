<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { generatedArtifactSchema, restaurantSchema, rotatorConfigSchema, type GeneratedArtifact, type Restaurant, type RotatorConfig, type SessionBlock } from '@lightfield/shared';
import { api } from '../lib/api';
import { requestGroundedPool, type GroundedPool } from '../lib/gemini';
import FieldMap from './FieldMap.vue';

const props = defineProps<{
  block: SessionBlock;
  sessionId: string;
  latestArtifact: GeneratedArtifact | null;
  canSave: boolean;
}>();
const emit = defineEmits<{ save: [artifact: GeneratedArtifact] }>();
const filters = ref<RotatorConfig>({ campusOrigin: 'MAIN_BUILDING', maxBudgetHKD: 120, maxWalkMins: 30, weatherRoute: 'ANY', vibeInstruction: 'Curious colleagues looking for a relaxed, easy-to-share lunch.' });
const apiKey = ref('');
const loading = ref(false);
const error = ref('');
const message = ref('');
const pool = ref<GroundedPool | null>(null);
const winnerId = ref('');
const selectedId = ref('');
const mapOpen = ref(false);
const spinning = ref(false);
const wheelRotation = ref(0);
const spinCount = ref(0);
const artifactId = ref('');
const lastSaved = ref(false);
const latestArtifactId = ref('');
const restaurants = computed(() => pool.value?.restaurants ?? []);
const winner = computed(() => restaurants.value.find((restaurant) => restaurant.id === winnerId.value) ?? null);
const wheelColors = ['#b7f26a', '#f0b44d', '#82a6db', '#e98065', '#b9a0d4'];
const wheelBackground = computed(() => {
  const count = Math.max(restaurants.value.length, 1);
  const stop = 360 / count;
  return `conic-gradient(${restaurants.value.map((_restaurant, index) => `${wheelColors[index % wheelColors.length]} ${index * stop}deg ${(index + 1) * stop}deg`).join(', ') || '#29312c 0deg 360deg'})`;
});
const citationsCount = computed(() => (pool.value?.mapSources.length ?? 0) + (pool.value?.webSources.length ?? 0));

watch(() => props.latestArtifact?.id, (id) => {
  const artifact = props.latestArtifact;
  if (!artifact || !id || id === latestArtifactId.value) return;
  latestArtifactId.value = id;
  pool.value = { restaurants: artifact.restaurants, mapSources: artifact.mapSources, webSources: artifact.webSources, searchQueries: artifact.searchQueries, sourceMode: artifact.sourceMode };
  winnerId.value = artifact.winningRestaurantId;
  selectedId.value = artifact.winningRestaurantId;
  artifactId.value = artifact.id;
  message.value = artifact.sourceMode === 'demo'
    ? 'Replaying a demonstration Field Test; details are not live-verified.'
    : artifact.sourceMode === 'unverified'
      ? 'Replaying a live response without returned citations; verify details independently.'
      : 'Replaying a saved grounded Field Test and its citations.';
  lastSaved.value = true;
}, { immediate: true });

function cleanKey(): void { apiKey.value = ''; }
function stableIndex(seedText: string, length: number): number {
  let hash = 2166136261;
  for (const char of seedText) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % length;
}
function matchesFilters(restaurant: Restaurant): boolean {
  return restaurant.priceHKD <= filters.value.maxBudgetHKD && restaurant.walkMins <= filters.value.maxWalkMins;
}

async function generateGrounded(): Promise<void> {
  error.value = '';
  message.value = '';
  if (!apiKey.value.trim()) { error.value = 'Enter your API key to request live grounding. Your key stays in this page memory and is sent only to the HKU endpoint.'; return; }
  const validation = rotatorConfigSchema.safeParse(filters.value);
  if (!validation.success) { error.value = 'Check the lunch filters and try again.'; return; }
  loading.value = true;
  lastSaved.value = false;
  winnerId.value = '';
  try {
    pool.value = await requestGroundedPool(apiKey.value, validation.data);
    artifactId.value = crypto.randomUUID();
    spinCount.value = 0;
    selectedId.value = pool.value.restaurants[0]?.id ?? '';
    message.value = citationsCount.value ? `${citationsCount.value} source citations returned. Check details before choosing.` : 'Suggestions returned, but no clickable citations were supplied. Verify details independently.';
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'The grounded request failed. Your key was not saved.';
  } finally { loading.value = false; }
}

async function loadDemo(): Promise<void> {
  error.value = '';
  message.value = '';
  loading.value = true;
  winnerId.value = '';
  lastSaved.value = false;
  try {
    const data = await api.getFallback();
    const parsed = data.restaurants.map((item) => restaurantSchema.safeParse(item)).filter((result) => result.success).map((result) => result.data);
    const candidates = parsed.filter(matchesFilters);
    if (candidates.length < 5) { error.value = 'The demo dataset has fewer than five options matching those limits. Increase the budget or walking time.'; return; }
    pool.value = { restaurants: candidates.slice(0, 5), mapSources: [], webSources: [], searchQueries: [], sourceMode: 'demo' };
    artifactId.value = crypto.randomUUID();
    spinCount.value = 0;
    selectedId.value = candidates[0].id;
    message.value = data.notice;
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Demo suggestions are not available right now.'; }
  finally { loading.value = false; }
}

function saveCurrentArtifact(chosen: Restaurant): void {
  if (!pool.value) return;
  const artifact = generatedArtifactSchema.parse({
    id: artifactId.value || crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    triggeredByGroup: 'HKU Lunch Rotator',
    filtersUsed: filters.value,
    restaurants: pool.value.restaurants,
    winningRestaurantId: chosen.id,
    mapSources: pool.value.mapSources,
    webSources: pool.value.webSources,
    searchQueries: pool.value.searchQueries,
    sourceMode: pool.value.sourceMode,
  });
  if (props.canSave) { emit('save', artifact); lastSaved.value = true; }
}

function spin(): void {
  if (!restaurants.value.length || spinning.value) return;
  const config = rotatorConfigSchema.parse(filters.value);
  const seed = `${props.sessionId}:${JSON.stringify(config)}:${restaurants.value.map((item) => item.id).join('|')}`;
  const index = (stableIndex(seed, restaurants.value.length) + spinCount.value) % restaurants.value.length;
  const chosen = restaurants.value[index];
  const segment = 360 / restaurants.value.length;
  const target = wheelRotation.value + 360 * 5 + (360 - (index + 0.5) * segment);
  wheelRotation.value = target;
  spinCount.value += 1;
  spinning.value = true;
  winnerId.value = '';
  window.setTimeout(() => {
    winnerId.value = chosen.id;
    selectedId.value = chosen.id;
    spinning.value = false;
    saveCurrentArtifact(chosen);
  }, 4900);
}

function selectRestaurant(id: string): void { selectedId.value = id; }
function mapsSources(sourceList: Array<{ title: string; uri: string }>): Array<{ title: string; uri: string }> {
  return sourceList.filter((source) => { try { return new URL(source.uri).protocol === 'https:'; } catch { return false; } });
}
</script>

<template>
  <div class="activity-stack rotator-layout">
    <div class="activity-kicker"><span class="rotator-glyph">✳</span> FIELD TESTING · HKU LUNCH ROTATOR</div>
    <div class="rotator-heading"><div><h2 class="activity-question">{{ block.title }}</h2><p class="muted-copy">Five distinct suggestions, then a deterministic client-side pick.</p></div><span class="rotator-mark">LF / 03</span></div>

    <div class="rotator-controls">
      <div class="form-grid">
        <label class="field-label">Campus origin
          <select v-model="filters.campusOrigin" class="text-input"><option value="MAIN_BUILDING">Main Building</option><option value="CENTENNIAL">Centennial Campus</option><option value="SASSCON_RD">Sassoon Road</option></select>
        </label>
        <label class="field-label">Budget per person <span class="field-unit">HKD</span>
          <input v-model.number="filters.maxBudgetHKD" class="text-input" type="number" min="20" max="2000" step="10" />
        </label>
        <label class="field-label">Maximum walk <span class="field-unit">minutes</span>
          <input v-model.number="filters.maxWalkMins" class="text-input" type="number" min="1" max="90" />
        </label>
        <label class="field-label">Route constraint
          <select v-model="filters.weatherRoute" class="text-input"><option value="ANY">Any route</option><option value="RAIN_SHELTERED">Prefer rain shelter</option><option value="NO_STEEP_SLOPES">Avoid steep slopes</option></select>
        </label>
      </div>
      <label class="field-label">Team vibe
        <textarea v-model="filters.vibeInstruction" class="text-input vibe-input" maxlength="220" placeholder="A mood or theme for the team's lunch…" />
      </label>
      <label class="field-label byok-label">Bring your own API key <span class="field-unit">in-memory only</span>
        <input v-model="apiKey" class="text-input" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste key for this request" />
        <span class="key-note">Sent directly to apidev.hku.hk for this request. Never sent to Lightfield's server or saved in the Field Log.</span>
      </label>
      <div class="rotator-actions">
        <button class="button primary" :disabled="loading || spinning" @click="generateGrounded">{{ loading ? 'Finding grounded suggestions…' : 'Find with live grounding' }} <span>↗</span></button>
        <button class="button secondary" :disabled="loading || spinning" @click="loadDemo">{{ loading ? 'Loading…' : 'Explore demo data' }}</button>
        <button class="button text-button" :disabled="!apiKey" @click="cleanKey">Clear key</button>
      </div>
      <p class="privacy-note"><span>◈</span> A key is held only in this browser tab's memory. Closing or reloading the page clears it. No Google SDK is used.</p>
      <div v-if="error" class="inline-alert" role="alert">{{ error }}</div>
      <div v-if="message" class="inline-notice" role="status">{{ message }}</div>
    </div>

    <section v-if="pool" class="results-section" aria-live="polite">
      <div class="results-heading"><div><div class="activity-kicker">YOUR FIVE OPTIONS</div><h3>{{ pool.sourceMode === 'demo' ? 'Demo suggestions' : pool.sourceMode === 'unverified' ? 'Unverified live response' : 'Grounded suggestions' }}</h3></div><span class="source-count">{{ citationsCount }} citations</span></div>
      <div class="wheel-row">
        <div class="wheel-shell">
          <div class="wheel-pointer" aria-hidden="true" />
          <div class="wheel" :style="{ background: wheelBackground, transform: `rotate(${wheelRotation}deg)` }" role="img" :aria-label="winner ? `Wheel winner: ${winner.name}` : 'Wheel of restaurant suggestions'">
            <span v-for="(restaurant, index) in restaurants" :key="restaurant.id" class="wheel-label" :style="{ transform: `rotate(${index * (360 / restaurants.length) + (180 / restaurants.length)}deg)` }">{{ restaurant.name }}</span>
          </div>
          <div class="wheel-center">LF<span>SPIN</span></div>
        </div>
        <div class="winner-panel">
          <div class="winner-label">{{ spinning ? 'THE WHEEL IS TURNING' : winner ? 'TEAM PICK' : 'READY TO PICK' }}</div>
          <h3>{{ spinning ? 'Following the field…' : winner?.name || 'A little serendipity, by design.' }}</h3>
          <p>{{ winner ? `${winner.cuisine} · HK$${winner.priceHKD} · ${winner.walkMins} min walk` : 'The result is selected locally from these five options.' }}</p>
          <button v-if="!spinning" class="button primary spin-button" :disabled="!restaurants.length" @click="spin">{{ winner ? 'Spin again' : 'Spin the wheel' }} <span>⤾</span></button>
          <div v-if="winner && canSave" class="archive-status">{{ lastSaved ? '✓ Saved to this Field Log' : 'Ready to save to this Field Log' }}</div>
        </div>
      </div>
      <div class="restaurant-grid">
        <button v-for="(restaurant, index) in restaurants" :key="restaurant.id" class="restaurant-card" :class="{ selected: selectedId === restaurant.id, winner: winnerId === restaurant.id }" @click="selectRestaurant(restaurant.id)">
          <span class="restaurant-index">0{{ index + 1 }}</span><span v-if="winnerId === restaurant.id" class="winner-stamp">PICK</span>
          <strong>{{ restaurant.name }}</strong><span>{{ restaurant.cuisine || 'Cuisine not specified' }}</span>
          <span class="restaurant-detail"><span>HK${{ restaurant.priceHKD }}</span><span>{{ restaurant.walkMins }} min walk</span></span>
          <span class="restaurant-dish">{{ restaurant.signatureDish }}</span>
        </button>
      </div>

      <div class="verification-drawer">
        <div class="verification-title"><div><div class="activity-kicker">CHECK THE EVIDENCE</div><h3>Grounding & route notes</h3></div><button class="button secondary compact" @click="mapOpen = !mapOpen">{{ mapOpen ? 'Hide map' : 'Field map' }} <span>⌖</span></button></div>
        <FieldMap v-if="mapOpen" :restaurants="restaurants" :winner-id="winnerId" :selected-id="selectedId" @select="selectRestaurant" />
        <div class="citation-columns">
          <div><h4>Google Maps <span>{{ pool.mapSources.length }}</span></h4><a v-for="source in mapsSources(pool.mapSources)" :key="source.uri" :href="source.uri" target="_blank" rel="noopener noreferrer">{{ source.title }} <span>↗</span></a><p v-if="!pool.mapSources.length" class="empty-inline">No Maps citations returned.</p></div>
          <div><h4>Google Search <span>{{ pool.webSources.length }}</span></h4><a v-for="source in mapsSources(pool.webSources)" :key="source.uri" :href="source.uri" target="_blank" rel="noopener noreferrer">{{ source.title }} <span>↗</span></a><p v-if="!pool.webSources.length" class="empty-inline">No Search citations returned.</p></div>
        </div>
        <div v-if="pool.searchQueries.length" class="query-line"><strong>Search queries</strong><span v-for="query in pool.searchQueries" :key="query">{{ query }}</span></div>
        <p class="evidence-disclaimer">Grounding citations are starting points for verification, not a guarantee of live hours, route accessibility, prices, or availability. {{ pool.sourceMode === 'demo' ? 'Demo data is fictional and has no source citations.' : 'Coordinates appear only when the endpoint returned them with Maps grounding.' }}</p>
      </div>
    </section>
  </div>
</template>
