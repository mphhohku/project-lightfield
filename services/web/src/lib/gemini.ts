import { restaurantSchema, rotatorConfigSchema, type RotatorConfig, type Restaurant, type SourceCitation } from '@lightfield/shared';

export const GEMINI_ENDPOINT = 'https://apidev.hku.hk/vertexai-gemini/gemini-3.8-flash:generateContent';

type UnknownRecord = Record<string, unknown>;
export interface GroundedPool {
  restaurants: Restaurant[];
  mapSources: SourceCitation[];
  webSources: SourceCitation[];
  searchQueries: string[];
  sourceMode: 'grounded' | 'unverified' | 'demo';
}

export function buildGeminiRequest(config: RotatorConfig): UnknownRecord {
  const filters = rotatorConfigSchema.parse(config);
  const prompt = [
    `Find exactly 5 distinct, currently operating lunch restaurants near HKU campus origin ${filters.campusOrigin}.`,
    `Maximum meal budget: HK$${filters.maxBudgetHKD}. Maximum walking time: ${filters.maxWalkMins} minutes.`,
    `Route preference: ${filters.weatherRoute}. Team vibe: ${filters.vibeInstruction}.`,
    'Use Google Maps grounding to verify the real place and location; use Google Search grounding for current menu or price context when available.',
    'Return only a JSON array of exactly five objects with keys name, cuisine, priceHKD (number), walkMins (number), signatureDish, pitch, and optional coordinates { latitude, longitude }. Include coordinates only when the corresponding Google Maps result provides exact coordinates; otherwise omit them. Never estimate or invent coordinates or other facts.'
  ].join('\n');
  return {
    system_instruction: { parts: [{ text: 'You are a careful HKU lunch research assistant. Follow user constraints, avoid unsupported claims, and return concise JSON. Ground claims in available sources.' }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { thinkingConfig: { thinkingLevel: 'medium' } },
    tools: [{ google_search: {} }, { googleMaps: {} }],
  };
}

function record(value: unknown): UnknownRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown, fallback = ''): string { return typeof value === 'string' ? value.trim() : fallback; }
function number(value: unknown): number | undefined {
  const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/[^\d.]/g, '')) : NaN;
  return Number.isFinite(result) ? result : undefined;
}
function safeCitation(value: unknown): SourceCitation | undefined {
  const item = record(value);
  const uri = text(item.uri);
  const title = text(item.title, 'Source');
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== 'https:') return undefined;
    return { title: title.slice(0, 300), uri: parsed.toString().slice(0, 2048) };
  } catch { return undefined; }
}
function normalizedName(value: string): string { return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
function stableId(name: string, index: number): string {
  let hash = 2166136261;
  for (const char of name) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `grounded-${(hash >>> 0).toString(36)}-${index}`;
}
function parseText(raw: string): unknown[] {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const decoded: unknown = JSON.parse(trimmed);
    if (Array.isArray(decoded)) return decoded;
    const nested = record(decoded).restaurants;
    return Array.isArray(nested) ? nested : [];
  } catch {
    const start = trimmed.indexOf('[');
    const end = trimmed.lastIndexOf(']');
    if (start < 0 || end <= start) throw new Error('The response did not contain a restaurant list.');
    try {
      const decoded: unknown = JSON.parse(trimmed.slice(start, end + 1));
      return Array.isArray(decoded) ? decoded : [];
    } catch { throw new Error('The response could not be parsed as a restaurant list.'); }
  }
}
function readResponseText(data: UnknownRecord): string {
  if (typeof data.text === 'string') return data.text;
  const first = record(array(data.candidates)[0]);
  const content = record(first.content);
  const parts = array(content.parts).map((part) => text(record(part).text)).filter(Boolean);
  if (!parts.length) throw new Error('No text was returned.');
  return parts.join('\n');
}
function readChunks(data: UnknownRecord): unknown[] {
  const candidate = record(array(data.candidates)[0]);
  const metadata = record(candidate.groundingMetadata ?? candidate.grounding_metadata);
  return array(metadata.groundingChunks ?? metadata.grounding_chunks);
}
function coordinatesFor(mapData: UnknownRecord): { latitude: number; longitude: number } | undefined {
  const possible = [mapData.coordinates, mapData.location, mapData.latLng, mapData.lat_lng, mapData.geoCoordinates];
  for (const entry of possible) {
    const item = record(entry);
    const latitude = number(item.latitude ?? item.lat);
    const longitude = number(item.longitude ?? item.lng ?? item.lon);
    if (latitude !== undefined && longitude !== undefined && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) return { latitude, longitude };
  }
  return undefined;
}

export function parseGroundedResponse(input: unknown): GroundedPool {
  const data = record(input);
  const rawText = readResponseText(data);
  const rows = parseText(rawText);
  const chunks = readChunks(data);
  const mapSources: SourceCitation[] = [];
  const webSources: SourceCitation[] = [];
  const mapDetails: Array<{ title: string; coordinates?: { latitude: number; longitude: number } }> = [];
  for (const chunk of chunks) {
    const entry = record(chunk);
    const maps = record(entry.maps);
    const web = record(entry.web);
    const mapCitation = safeCitation(maps);
    const webCitation = safeCitation(web);
    if (mapCitation && !mapSources.some((item) => item.uri === mapCitation.uri)) mapSources.push(mapCitation);
    if (webCitation && !webSources.some((item) => item.uri === webCitation.uri)) webSources.push(webCitation);
    if (Object.keys(maps).length) mapDetails.push({ title: text(maps.title), coordinates: coordinatesFor(maps) });
  }
  const metadata = record(record(array(data.candidates)[0]).groundingMetadata ?? record(array(data.candidates)[0]).grounding_metadata);
  const queries = array(metadata.webSearchQueries ?? metadata.web_search_queries).map((item) => text(item)).filter(Boolean).slice(0, 30);
  const names = new Set<string>();
  const restaurants = rows.slice(0, 10).map((row, index) => {
    const item = record(row);
    const name = text(item.name);
    if (!name || names.has(normalizedName(name))) return undefined;
    names.add(normalizedName(name));
    const mapMatch = mapDetails.find((entry) => entry.title && (normalizedName(name).includes(normalizedName(entry.title)) || normalizedName(entry.title).includes(normalizedName(name))));
    const verifiedCoordinates = mapMatch ? mapMatch.coordinates ?? coordinatesFor(item) : undefined;
    const validated = restaurantSchema.parse({
      id: stableId(name, index), name,
      cuisine: text(item.cuisine), priceHKD: number(item.priceHKD) ?? number(item.price_hkd) ?? 0,
      walkMins: number(item.walkMins) ?? number(item.walk_mins) ?? 0,
      signatureDish: text(item.signatureDish ?? item.signature_dish), pitch: text(item.pitch),
      ...(verifiedCoordinates ? { coordinates: verifiedCoordinates } : {}),
    });
    return validated;
  }).filter((item): item is Restaurant => Boolean(item));
  if (restaurants.length < 5) throw new Error('The response contained fewer than five distinct suggestions.');
  return { restaurants: restaurants.slice(0, 5), mapSources, webSources, searchQueries: queries, sourceMode: mapSources.length || webSources.length ? 'grounded' : 'unverified' };
}

export async function requestGroundedPool(apiKey: string, config: RotatorConfig): Promise<GroundedPool> {
  const key = apiKey.trim();
  if (!key) throw new Error('Enter your API key to request live grounding.');
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 70_000);
  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(buildGeminiRequest(config)),
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const data: unknown = await response.json();
    return parseGroundedResponse(data);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('The response')) throw error;
    if (error instanceof Error && error.message.includes('five distinct')) throw error;
    if (error instanceof Error && error.message.includes('not contain')) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('The grounded request timed out. Check your connection and try again.');
    // Do not include provider response text or exception details: either can echo the BYOK value.
    throw new Error('The grounded request failed. Check the key, endpoint access, and network connection.');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
