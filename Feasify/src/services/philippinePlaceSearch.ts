import {
  PHILIPPINE_LANDMARKS,
  searchPhilippineLandmarks,
  type PhilippineLandmark,
} from "../data/philippineLandmarks";

export interface PlaceSuggestion {
  id: string;
  name: string;
  displayName: string;
  barangay: string;
  city: string;
  province?: string;
  latitude: number;
  longitude: number;
  category?: string;
  isPopular?: boolean;
  isRemote?: boolean;
}

// Distance calculation to eliminate duplicate nearby landmarks
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Clean and normalize OpenStreetMap Nominatim places (adapted from BantayBaha / Alerto PH)
export function formatToGoogleMapsPlace(item: any, idx: number): PlaceSuggestion {
  const namedetails = item.namedetails || {};
  let name =
    namedetails["name:tl"] ||
    namedetails["name:fil"] ||
    namedetails.name ||
    item.name ||
    (item.display_name ? item.display_name.split(",")[0] : "Location");

  const lower = name.toLowerCase();

  // Standard Philippine institution and landmark naming conventions (from BantayBaha)
  if (
    lower.includes("university of the city of valenzuela") ||
    lower.includes("pamantasan ng lungsod ng valenzuela")
  ) {
    name = "Pamantasan ng Lungsod ng Valenzuela (PLV)";
  } else if (
    lower.includes("university of the city of manila") ||
    lower.includes("pamantasan ng lungsod ng maynila")
  ) {
    name = "Pamantasan ng Lungsod ng Maynila (PLM)";
  } else if (lower.includes("pamantasan ng lungsod ng marikina")) {
    name = "Pamantasan ng Lungsod ng Marikina (PLMar)";
  } else if (lower.includes("pamantasan ng lungsod ng pasig")) {
    name = "Pamantasan ng Lungsod ng Pasig (PLP)";
  } else if (lower.includes("polytechnic university of the philippines")) {
    name = "Polytechnic University of the Philippines (PUP)";
  } else if (lower.includes("technological university of the philippines")) {
    name = "Technological University of the Philippines (TUP)";
  } else if (lower.includes("philippine normal university")) {
    name = "Philippine Normal University (PNU)";
  } else if (lower.includes("our lady of fatima university") || lower.includes("fatima university")) {
    name = "Our Lady of Fatima University (OLFU)";
  } else if (lower.includes("valenzuela city science high school")) {
    name = "Valenzuela City Science High School (ValMaSci)";
  } else if (lower.includes("valenzuela city general hospital")) {
    name = "Valenzuela City General Hospital (VCGH)";
  } else if (lower.includes("valenzuela city emergency hospital")) {
    name = "Valenzuela City Emergency Hospital";
  } else if (lower.includes("valenzuela people's park") || lower.includes("valenzuela peoples park")) {
    name = "Valenzuela People's Park";
  } else if (lower.includes("city of valenzuela")) {
    name = "Valenzuela City";
  } else if (
    lower.includes("camp general rafael t. crame") ||
    lower.includes("camp rafael t. crame") ||
    lower.includes("camp crame")
  ) {
    name = "Camp Crame - PNP National Headquarters";
  } else if (lower.includes("bonifacio monument") || lower.includes("monumento")) {
    name = "Monumento Circle (Bonifacio Monument)";
  } else if (lower.includes("mall of asia")) {
    name = "SM Mall of Asia (MOA)";
  } else {
    const shortName = (namedetails.short_name || "").trim();
    if (shortName && !name.toUpperCase().includes(shortName.toUpperCase())) {
      name = `${name} (${shortName.toUpperCase()})`;
    }
  }

  // Clean address subtitle
  const addr = item.address || {};
  let road = addr.road || addr.street || addr.pedestrian || addr.highway || "";
  road = road
    .replace(/\bBrigadier General\b/gi, "BGen")
    .replace(/\bStreet\b/gi, "St")
    .replace(/\bAvenue\b/gi, "Ave")
    .replace(/\bBoulevard\b/gi, "Blvd")
    .replace(/\bHighway\b/gi, "Hwy")
    .replace(/\bRoad\b/gi, "Rd")
    .replace(/\bExtension\b/gi, "Ext");

  const rawB = addr.quarter || addr.suburb || addr.neighbourhood || addr.village || addr.residential || "";
  const b = rawB.replace(/^(Barangay|Brgy\.?)\s*/i, "").trim();

  let city = addr.city || addr.municipality || addr.town || "";
  if (city.toLowerCase().includes("district")) city = "";

  let province = addr.province || addr.state || "";
  if (
    province.toLowerCase().includes("district") ||
    province.toLowerCase().includes("ncr") ||
    addr.region === "Kalakhang Maynila"
  ) {
    province = "Metro Manila";
  }

  const parts: string[] = [];
  const lowerName = name.toLowerCase();
  if (road && !lowerName.includes(road.toLowerCase())) parts.push(road);
  if (b && !lowerName.includes(b.toLowerCase())) parts.push(b.startsWith("Brgy.") ? b : `Brgy. ${b}`);
  if (city && !lowerName.includes(city.toLowerCase())) parts.push(city);
  if (
    province &&
    !parts.some((p) => p.toLowerCase() === province.toLowerCase()) &&
    parts.length < 3
  ) {
    parts.push(province);
  }

  const cleanSubtitle = parts.length > 0 ? parts.join(", ") : (city || province || "Philippines");

  return {
    id: `nom_${item.place_id || idx}`,
    name,
    displayName: cleanSubtitle,
    barangay: b ? (b.startsWith("Brgy.") ? b : `Brgy. ${b}`) : "",
    city: city || province || "Philippines",
    province: province || undefined,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    category: item.type ? item.type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Location",
    isRemote: true,
  };
}

// Convert PhilippineLandmark item to PlaceSuggestion
export function landmarkToSuggestion(l: PhilippineLandmark): PlaceSuggestion {
  return {
    id: l.id,
    name: l.name,
    displayName: l.displayName,
    barangay: l.barangay,
    city: l.city,
    province: l.province,
    latitude: l.latitude,
    longitude: l.longitude,
    category: l.category,
    isPopular: l.isPopular,
    isRemote: false,
  };
}

// Default popular locations for quick selection
export const DEFAULT_POPULAR_PLACES: PlaceSuggestion[] = PHILIPPINE_LANDMARKS
  .filter((l) => l.isPopular)
  .map(landmarkToSuggestion);

/**
 * Instant local matching + debounced remote search from BantayBaha / Alerto PH.
 * Instant local matches return immediately; remote matches can be awaited.
 */
export function getInstantLocalPlaces(query: string, limit = 8): PlaceSuggestion[] {
  const q = query.trim();
  if (!q) {
    return DEFAULT_POPULAR_PLACES.slice(0, limit);
  }
  const localMatches = searchPhilippineLandmarks(q, limit);
  return localMatches.map(landmarkToSuggestion);
}

/**
 * Searches places across the Philippines using BantayBaha / Alerto PH algorithm:
 * 1. Fast fuzzy search against 150+ Philippine landmarks and streets
 * 2. Online search fallback via OpenStreetMap Nominatim with Philippine language headers
 * 3. Spatial deduplication via Haversine (< 100 meters) and normalized name
 */
export async function searchPlacesPH(
  query: string,
  limit = 10,
  signal?: AbortSignal
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (!q) {
    return DEFAULT_POPULAR_PLACES.slice(0, limit);
  }

  // 1. Instant local matches from BantayBaha database
  const localMatches = searchPhilippineLandmarks(q, limit).map(landmarkToSuggestion);

  // 2. Fetch online places if query has multi-word or local matches has room
  let remoteMatches: PlaceSuggestion[] = [];
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q
      )}&countrycodes=ph&limit=8&addressdetails=1&namedetails=1`,
      {
        headers: {
          "Accept-Language": "fil,tl,en-PH;q=0.9,en;q=0.8",
        },
        signal,
      }
    );

    if (nomRes.ok) {
      const nomData = (await nomRes.json()) as any[];
      remoteMatches = nomData.map((item, idx) => formatToGoogleMapsPlace(item, idx));
    }
  } catch (err: any) {
    if (err.name !== "AbortError") {
      console.warn("Online place search skipped:", err.message);
    }
  }

  // 3. Merge & Deduplicate
  const combined: PlaceSuggestion[] = [...localMatches];
  for (const rem of remoteMatches) {
    const exists = combined.some(
      (c) =>
        haversineMeters(c.latitude, c.longitude, rem.latitude, rem.longitude) < 100 ||
        c.name.toLowerCase() === rem.name.toLowerCase()
    );
    if (!exists) {
      combined.push(rem);
    }
  }

  return combined.slice(0, limit);
}

/**
 * Compiles a clean, human-readable address for the proposal without raw coordinates.
 * e.g. "SM Mall of Asia, Seaside Blvd, Pasay, Metro Manila, Philippines"
 */
export function formatCleanAddressFromPlace(place: PlaceSuggestion): string {
  const parts: string[] = [];

  if (place.name && place.name !== "Location") {
    parts.push(place.name);
  }

  if (place.displayName) {
    const subParts = place.displayName.split(",").map((s) => s.trim());
    for (const sp of subParts) {
      if (sp && !parts.some((p) => p.toLowerCase() === sp.toLowerCase())) {
        parts.push(sp);
      }
    }
  }

  if (place.barangay && !parts.some((p) => p.toLowerCase().includes(place.barangay.toLowerCase()))) {
    parts.push(place.barangay);
  }

  if (place.city && !parts.some((p) => p.toLowerCase().includes(place.city.toLowerCase()))) {
    parts.push(place.city);
  }

  if (place.province && !parts.some((p) => p.toLowerCase().includes(place.province!.toLowerCase()))) {
    parts.push(place.province);
  }

  if (!parts.some((p) => p.toLowerCase().includes("philippines"))) {
    parts.push("Philippines");
  }

  return parts.join(", ");
}
