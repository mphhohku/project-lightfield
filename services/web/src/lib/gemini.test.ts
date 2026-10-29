import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildGeminiRequest, parseGroundedResponse, requestGroundedPool } from './gemini';
import type { RotatorConfig } from '@lightfield/shared';

const filters: RotatorConfig = { campusOrigin: 'MAIN_BUILDING', maxBudgetHKD: 120, maxWalkMins: 30, weatherRoute: 'ANY', vibeInstruction: 'Relaxed lunch' };
const rows = Array.from({ length: 5 }, (_value, index) => ({ name: `HKU Sample ${index + 1}`, cuisine: 'Cantonese', priceHKD: 60 + index, walkMins: 8 + index, signatureDish: 'Seasonal bowl', pitch: 'A sample recommendation.' }));
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

describe('BYOK request and response handling', () => {
  it('serializes the requested plain-fetch schema and grounding tools', () => {
    const body = buildGeminiRequest(filters);
    expect(body).toMatchObject({
      system_instruction: { parts: [{ text: expect.any(String) }] },
      contents: [{ role: 'user', parts: [{ text: expect.stringContaining('HK$120') }] }],
      generationConfig: { thinkingConfig: { thinkingLevel: 'medium' } },
      tools: [{ google_search: {} }, { googleMaps: {} }],
    });
    expect(JSON.stringify(body)).not.toContain('apiKey');
  });

  it('parses five unique suggestions and only attaches coordinates present in Maps grounding', () => {
    const result = parseGroundedResponse({
      candidates: [{ content: { parts: [{ text: JSON.stringify(rows.map((row, index) => index === 0 ? { ...row, coordinates: { latitude: 22.28, longitude: 114.13 } } : row)) }] }, groundingMetadata: {
        groundingChunks: [
          { maps: { title: 'HKU Sample 1', uri: 'https://maps.example/one' } },
          { web: { title: 'Menu notes', uri: 'https://food.example/source' } },
        ], webSearchQueries: ['HKU lunch sample'],
      } }],
    });
    expect(result.restaurants).toHaveLength(5);
    expect(result.restaurants[0].coordinates).toEqual({ latitude: 22.28, longitude: 114.13 });
    expect(result.restaurants[1].coordinates).toBeUndefined();
    expect(result.sourceMode).toBe('grounded');
    expect(result.mapSources).toHaveLength(1);
    expect(result.webSources).toHaveLength(1);
    expect(result.searchQueries).toEqual(['HKU lunch sample']);
  });

  it('labels live responses without grounding citations as unverified', () => {
    const result = parseGroundedResponse({ candidates: [{ content: { parts: [{ text: JSON.stringify(rows) }] } }] });
    expect(result.sourceMode).toBe('unverified');
    expect(result.restaurants.every((restaurant) => !restaurant.coordinates)).toBe(true);
  });

  it('never reflects a BYOK value from a provider/network failure', async () => {
    const key = 'do-not-leak-this-test-key';
    globalThis.fetch = vi.fn(async () => { throw new Error(`provider echoed ${key}`); }) as unknown as typeof fetch;
    await expect(requestGroundedPool(key, filters)).rejects.toThrow('The grounded request failed.');
    await expect(requestGroundedPool(key, filters)).rejects.not.toThrow(key);
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('apidev.hku.hk'), expect.objectContaining({
      headers: expect.objectContaining({ 'x-goog-api-key': key }),
      credentials: 'omit', cache: 'no-store',
    }));
  });
});
