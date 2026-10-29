import { describe, expect, it } from 'vitest';
import { restaurantsWithVerifiedCoordinates } from './map';
import type { Restaurant } from '@lightfield/shared';

const restaurant = (id: string, coordinates?: Restaurant['coordinates']) => ({
  id, name: id, cuisine: '', priceHKD: 50, walkMins: 10, signatureDish: '', pitch: '', coordinates,
}) as Restaurant;

describe('field map coordinate gate', () => {
  it('only returns restaurants with valid, supplied coordinates', () => {
    const valid = restaurant('grounded-place', { latitude: 22.28, longitude: 114.13 });
    const missing = restaurant('no-coordinate');
    const invalid = restaurant('invalid-coordinate', { latitude: 123, longitude: 114 });
    expect(restaurantsWithVerifiedCoordinates([valid, missing, invalid])).toEqual([valid]);
  });
});
