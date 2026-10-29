<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import type { Restaurant } from '@lightfield/shared';
import { restaurantsWithVerifiedCoordinates } from '../lib/map';

const props = defineProps<{ restaurants: Restaurant[]; winnerId: string; selectedId: string }>();
const emit = defineEmits<{ select: [restaurantId: string] }>();
const element = ref<HTMLDivElement | null>(null);
const locations = computed(() => restaurantsWithVerifiedCoordinates(props.restaurants));
let map: L.Map | undefined;
let markers: L.LayerGroup | undefined;

function refreshMarkers(): void {
  if (!map || !markers) return;
  markers.clearLayers();
  for (const restaurant of locations.value) {
    const point = restaurant.coordinates!;
    const marker = L.circleMarker([point.latitude, point.longitude], {
      radius: restaurant.id === props.winnerId ? 10 : restaurant.id === props.selectedId ? 9 : 7,
      color: restaurant.id === props.winnerId ? '#b7f26a' : '#f5f1e8',
      fillColor: restaurant.id === props.winnerId ? '#b7f26a' : '#667a60',
      fillOpacity: 0.95,
      weight: 2,
    }).addTo(markers!);
    marker.bindTooltip(restaurant.name, { direction: 'top', offset: [0, -8] });
    const popup = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = restaurant.name;
    const meta = document.createElement('p');
    meta.textContent = `HK$${restaurant.priceHKD} · ${restaurant.walkMins} min walk`;
    popup.append(title, meta);
    marker.bindPopup(popup);
    marker.on('click', () => emit('select', restaurant.id));
  }
  if (locations.value.length === 1) {
    const only = locations.value[0].coordinates!;
    map.setView([only.latitude, only.longitude], 16);
  } else if (locations.value.length > 1) {
    const bounds = L.latLngBounds(locations.value.map((restaurant) => [restaurant.coordinates!.latitude, restaurant.coordinates!.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
  }
  void nextTick(() => map?.invalidateSize());
}

onMounted(async () => {
  await nextTick();
  if (!element.value || !locations.value.length) return;
  const first = locations.value[0].coordinates!;
  map = L.map(element.value, { scrollWheelZoom: false }).setView([first.latitude, first.longitude], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  }).addTo(map);
  markers = L.layerGroup().addTo(map);
  refreshMarkers();
});
watch(() => [props.restaurants, props.winnerId, props.selectedId], () => refreshMarkers(), { deep: true });
onBeforeUnmount(() => { map?.remove(); map = undefined; markers = undefined; });
</script>

<template>
  <div v-if="locations.length" ref="element" class="field-map" role="application" aria-label="Map of restaurants with coordinates supplied by grounding sources" />
  <div v-else class="map-empty"><span class="map-empty-icon">◎</span><strong>No verified coordinates were returned</strong><p>Map markers are hidden until grounding includes usable restaurant coordinates. No locations are estimated.</p></div>
</template>
