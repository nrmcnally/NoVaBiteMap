import type { FishingLocation } from "./data";

export type TravelOrigin = {
  label: string;
  query: string;
  lat: number;
  lng: number;
};

export type TravelEstimate = {
  distanceMiles: number;
  driveMinutes: number;
  walkMinutes: number;
  personalized: boolean;
};

export function haversineMiles(
  from: Pick<TravelOrigin, "lat" | "lng">,
  to: Pick<FishingLocation, "lat" | "lng">,
) {
  const radiusMiles = 3958.8;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateTravel(
  location: FishingLocation,
  origin: TravelOrigin | null,
): TravelEstimate {
  if (!origin) {
    return {
      distanceMiles: location.distanceMiles,
      driveMinutes: location.travelMinutes,
      walkMinutes: Math.round((location.distanceMiles / 3) * 60),
      personalized: false,
    };
  }

  const directMiles = haversineMiles(origin, location);
  const roadMiles = Math.max(0.2, directMiles * 1.22);
  const walkingMiles = Math.max(0.1, directMiles * 1.08);

  return {
    distanceMiles: Math.round(roadMiles * 10) / 10,
    driveMinutes: Math.max(3, Math.round((roadMiles / 38) * 60 + 4)),
    walkMinutes: Math.max(2, Math.round((walkingMiles / 3) * 60)),
    personalized: true,
  };
}

export function googleDirectionsUrl(
  location: FishingLocation,
  origin?: TravelOrigin | null,
  travelMode: "driving" | "walking" = "driving",
) {
  const params = new URLSearchParams({
    api: "1",
    destination: `${location.lat},${location.lng}`,
    travelmode: travelMode,
    dir_action: "navigate",
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
