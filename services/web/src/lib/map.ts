import type { Restaurant } from '@lightfield/shared';

export function restaurantsWithVerifiedCoordinates(restaurants: Restaurant[]): Restaurant[] {
  return restaurants.filter((restaurant) => {
    const point = restaurant.coordinates;
    return Boolean(point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
      && point.latitude >= -90 && point.latitude <= 90 && point.longitude >= -180 && point.longitude <= 180);
  });
}
