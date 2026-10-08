import { PHILIPPINE_LANDMARKS, type PhilippineLandmark } from "../data/philippineLandmarks";
import { haversineMeters } from "./philippinePlaceSearch";

export interface NearbyEstablishmentItem {
  name: string;
  category: "University" | "School" | "Hospital" | "Shopping Mall" | "Transit" | "Government" | "Church" | "Commercial" | "Establishment";
  icon: string;
  distanceKm?: number;
}

export interface DynamicCompetitorResult {
  locationName: string;
  detectedCity: string;
  directCompetitors: string[];
  otherCompetitors: string[];
  nearbyEstablishments: string[];
  nearbyEstablishmentItems?: NearbyEstablishmentItem[];
  source: "live_osm_map" | "local_landmark_db" | "location_intelligence";
  isLoading?: boolean;
}

export interface DynamicDemographicResult {
  hasDetectedProfile: boolean;
  detectedLabel: string;
  demographics: string[];
}

// Memory cache to prevent redundant queries
const cache = new Map<string, DynamicCompetitorResult>();

/**
 * Normalizes and extracts city / area name from address string
 */
export function extractCityOrArea(locationStr: string): string {
  if (!locationStr) return "Metro Manila";
  const clean = locationStr.trim();
  const lower = clean.toLowerCase();

  const PH_CITIES = [
    "Valenzuela",
    "Caloocan",
    "Quezon City",
    "Manila",
    "Makati",
    "Taguig",
    "Pasay",
    "Pasig",
    "Mandaluyong",
    "Marikina",
    "San Juan",
    "Malabon",
    "Navotas",
    "Parañaque",
    "Las Piñas",
    "Muntinlupa",
    "Antipolo",
    "Cebu City",
    "Davao City",
    "Baguio",
    "Angeles",
    "San Fernando",
    "Bulacan",
    "Cavite",
    "Laguna",
    "Rizal",
    "Pampanga",
  ];

  for (const city of PH_CITIES) {
    if (lower.includes(city.toLowerCase())) {
      return city;
    }
  }

  // Fallback to first non-empty segment
  const parts = clean.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2] || parts[0];
  }
  return parts[0] || "Metro Manila";
}

/**
 * Classifies business archetype based on name, type, and products
 */
export function classifyBusinessArchetype(
  businessName: string,
  businessType: string,
  products: any[] = []
): "bakery" | "cafe" | "restaurant" | "retail" | "laundry" | "general" {
  const prodNames = Array.isArray(products)
    ? products.map((p) => (typeof p === "string" ? p : p?.name || "")).join(" ")
    : "";
  const combined = `${businessName} ${businessType} ${prodNames}`.toLowerCase();

  if (
    combined.includes("pan") ||
    combined.includes("baker") ||
    combined.includes("bread") ||
    combined.includes("pastr") ||
    combined.includes("cake") ||
    combined.includes("cookie") ||
    combined.includes("pandesal") ||
    combined.includes("ensaymada") ||
    combined.includes("donut") ||
    combined.includes("doughnut") ||
    combined.includes("croissant")
  ) {
    return "bakery";
  }

  if (
    combined.includes("cafe") ||
    combined.includes("coffee") ||
    combined.includes("tea") ||
    combined.includes("boba") ||
    combined.includes("milk tea") ||
    combined.includes("milktea") ||
    combined.includes("frappe") ||
    combined.includes("latte") ||
    combined.includes("brew") ||
    combined.includes("beverage")
  ) {
    return "cafe";
  }

  if (
    combined.includes("food") ||
    combined.includes("restaurant") ||
    combined.includes("fast food") ||
    combined.includes("diner") ||
    combined.includes("grill") ||
    combined.includes("chicken") ||
    combined.includes("burger") ||
    combined.includes("silog") ||
    combined.includes("carinderia") ||
    combined.includes("eatery") ||
    combined.includes("kitchen") ||
    combined.includes("wings") ||
    combined.includes("bbq") ||
    combined.includes("pizza")
  ) {
    return "restaurant";
  }

  if (
    combined.includes("retail") ||
    combined.includes("grocery") ||
    combined.includes("minimart") ||
    combined.includes("market") ||
    combined.includes("store") ||
    combined.includes("apparel") ||
    combined.includes("boutique") ||
    combined.includes("clothes")
  ) {
    return "retail";
  }

  if (
    combined.includes("laundry") ||
    combined.includes("laundromat") ||
    combined.includes("wash") ||
    combined.includes("dry clean")
  ) {
    return "laundry";
  }

  return "general";
}

/**
 * Standard centroid coordinates for Philippine cities
 */
export const PHILIPPINE_CITY_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  "Quezon City": { lat: 14.6760, lon: 121.0437 },
  "Manila": { lat: 14.5995, lon: 120.9842 },
  "Valenzuela": { lat: 14.6980, lon: 120.9788 },
  "Caloocan": { lat: 14.6488, lon: 120.9680 },
  "Makati": { lat: 14.5547, lon: 121.0244 },
  "Taguig": { lat: 14.5176, lon: 121.0509 },
  "Pasig": { lat: 14.5764, lon: 121.0851 },
  "Mandaluyong": { lat: 14.5794, lon: 121.0359 },
  "Marikina": { lat: 14.6507, lon: 121.1029 },
  "Pasay": { lat: 14.5378, lon: 120.9996 },
  "Parañaque": { lat: 14.4793, lon: 121.0198 },
  "Las Piñas": { lat: 14.4445, lon: 120.9939 },
  "Muntinlupa": { lat: 14.4081, lon: 121.0415 },
  "San Juan": { lat: 14.6019, lon: 121.0355 },
  "Malabon": { lat: 14.6625, lon: 120.9566 },
  "Navotas": { lat: 14.6667, lon: 120.9417 },
  "Pateros": { lat: 14.5454, lon: 121.0687 },
  "Antipolo": { lat: 14.5842, lon: 121.1763 },
  "Cebu City": { lat: 10.3157, lon: 123.8854 },
  "Davao City": { lat: 7.1907, lon: 125.4553 },
  "Baguio": { lat: 16.4023, lon: 120.5960 },
  "Angeles": { lat: 15.1450, lon: 120.5887 },
  "San Fernando": { lat: 15.0285, lon: 120.6897 },
  "Bulacan": { lat: 14.7943, lon: 120.8799 },
  "Cavite": { lat: 14.4791, lon: 120.8964 },
  "Laguna": { lat: 14.2691, lon: 121.3653 },
  "Rizal": { lat: 14.5547, lon: 121.2422 },
  "Pampanga": { lat: 15.0794, lon: 120.6200 },
};

/**
 * Searches local Philippine landmarks database for coordinates.
 * Evaluates specific name, display name, barangay, and aliases using word boundaries.
 * Strictly avoids generic city name matches so addresses in Metro Manila / Quezon City never get snapped to Manila.
 */
function findCoordinatesInLocalLandmarks(locationStr: string): { lat: number; lon: number } | null {
  if (!locationStr) return null;
  const lower = locationStr.toLowerCase();

  const matchScore = (text: string, query?: string): number => {
    if (!query) return 0;
    const q = query.trim().toLowerCase();
    if (q.length < 3) return 0; // Avoid short acronyms like 'ue' falsely matching inside 'avenue'
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
    if (regex.test(text)) {
      return q.length; // More specific names receive higher priority
    }
    return 0;
  };

  let bestMatch: PhilippineLandmark | null = null;
  let highestScore = 0;

  for (const lm of PHILIPPINE_LANDMARKS) {
    const cleanBarangay = lm.barangay ? lm.barangay.replace(/^(brgy\.?|barangay)\s*/i, "") : "";
    const scores = [
      matchScore(lower, lm.name),
      lm.displayName ? matchScore(lower, lm.displayName) : 0,
      cleanBarangay ? matchScore(lower, cleanBarangay) : 0,
      ...(lm.aliases || []).map((a) => matchScore(lower, a)),
    ];
    const maxScore = Math.max(...scores);
    if (maxScore > 0) {
      // Specific landmarks, malls, hospitals, and highways take priority over broad city boundaries
      const totalScore = maxScore + (lm.category === "City" ? 0 : 50);
      if (totalScore > highestScore) {
        highestScore = totalScore;
        bestMatch = lm;
      }
    }
  }

  if (bestMatch && highestScore > 0) {
    return { lat: bestMatch.latitude, lon: bestMatch.longitude };
  }

  return null;
}

/**
 * Safe fetch with a self-contained timeout that never leaks unhandled AbortErrors
 */
async function safeFetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 6000
): Promise<Response | null> {
  const controller = new AbortController();
  let timer: any = null;

  try {
    const fetchPromise = fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const timeoutPromise = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        try {
          controller.abort();
        } catch {
          // ignore
        }
        resolve(null);
      }, timeoutMs);
    });

    const res = await Promise.race([fetchPromise, timeoutPromise]);
    return res as Response | null;
  } catch {
    // Specifically catch and swallow AbortError or network failure
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Geocodes an address via local landmarks, OpenStreetMap Nominatim, or City Centroid fallback
 */
async function geocodeLocation(locationStr: string): Promise<{ lat: number; lon: number } | null> {
  // 1. Try local Philippine landmark coordinates first for instant, high-accuracy match
  const localCoord = findCoordinatesInLocalLandmarks(locationStr);
  if (localCoord) return localCoord;

  // 2. Query Nominatim safely with 4.5s timeout
  try {
    const res = await safeFetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        locationStr
      )}&countrycodes=ph&limit=1`,
      {
        headers: { "User-Agent": "Feasify-Map-Competitor-Engine/1.0" },
      },
      4500
    );
    if (res && res.ok) {
      const data = (await res.json().catch(() => null)) as any[];
      if (data && data[0]) {
        return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
      }
    }
  } catch {
    // Ignore network/abort errors
  }

  // 3. City centroid fallback if specific landmark was not found
  const city = extractCityOrArea(locationStr);
  if (PHILIPPINE_CITY_CENTROIDS[city]) {
    return PHILIPPINE_CITY_CENTROIDS[city];
  }

  return null;
}

/**
 * Queries OpenStreetMap Overpass API for POIs around coordinates
 */
async function queryOverpassPOIs(
  lat: number,
  lon: number,
  radiusMeters = 2000
): Promise<Array<{ name: string; shop?: string; amenity?: string; brand?: string; lat?: number; lon?: number }>> {
  const query = `[out:json][timeout:6];(
    node["shop"~"bakery|convenience|supermarket|mall|clothes|laundry|beverages|coffee"](around:${radiusMeters},${lat},${lon});
    node["amenity"~"fast_food|cafe|restaurant|school|college|university|hospital|clinic|townhall|community_centre|place_of_worship|bus_station"](around:${radiusMeters},${lat},${lon});
    way["shop"~"bakery|convenience|supermarket|mall|clothes|laundry|beverages|coffee"](around:${radiusMeters},${lat},${lon});
    way["amenity"~"fast_food|cafe|restaurant|school|college|university|hospital|clinic|townhall|community_centre|place_of_worship|bus_station"](around:${radiusMeters},${lat},${lon});
  );out center 40;`;

  try {
    const res = await safeFetchWithTimeout(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      {
        headers: { "User-Agent": "Feasify-Map-Competitor-Engine/1.0" },
      },
      5500
    );
    if (!res || !res.ok) return [];
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.elements)) return [];

    const items: Array<{ name: string; shop?: string; amenity?: string; brand?: string; lat?: number; lon?: number }> = [];
    const seenNames = new Set<string>();

    for (const elem of data.elements) {
      const tags = elem.tags || {};
      const name = (tags.name || tags.brand || "").trim();
      if (!name || seenNames.has(name.toLowerCase())) continue;
      seenNames.add(name.toLowerCase());

      const elemLat = elem.lat || elem.center?.lat;
      const elemLon = elem.lon || elem.center?.lon;

      items.push({
        name,
        shop: tags.shop,
        amenity: tags.amenity,
        brand: tags.brand,
        lat: elemLat,
        lon: elemLon,
      });
    }

    return items;
  } catch {
    return [];
  }
}

/**
 * Intelligent location-aware competitor generator tailored to Philippine cities
 */
function generateLocationAwareCompetitors(
  city: string,
  archetype: "bakery" | "cafe" | "restaurant" | "retail" | "laundry" | "general"
): { direct: string[]; other: string[] } {
  const cleanCity = city || "Metro Manila";

  const genericBakeryDirect = [
    `Bakers' Fair (${cleanCity})`,
    `Pan de Manila (${cleanCity})`,
    `Goldilocks (${cleanCity})`,
    `Red Ribbon (${cleanCity})`,
    `Julie's Bakeshop (${cleanCity})`,
    `Balai Pandesal (${cleanCity})`,
  ];
  const genericBakeryOther = [
    `7-Eleven (${cleanCity})`,
    `Uncle John's (${cleanCity})`,
    `McDonald's (${cleanCity})`,
    `Dunkin' (${cleanCity})`,
    `Savemore / Puregold (${cleanCity})`,
    `Mister Donut Stand`,
  ];

  const genericCafeDirect = [
    `Starbucks (${cleanCity})`,
    `Pickup Coffee (${cleanCity})`,
    `The Coffee Bean & Tea Leaf (${cleanCity})`,
    `Bo's Coffee (${cleanCity})`,
    `Macao Imperial Tea (${cleanCity})`,
    `CoCo Fresh Tea & Juice (${cleanCity})`,
  ];
  const genericCafeOther = [
    `7-Eleven City Blends (${cleanCity})`,
    `Uncle John's Chillz (${cleanCity})`,
    `McDonald's McCafe (${cleanCity})`,
    `Dunkin' Iced Coffee (${cleanCity})`,
    `Lawson / Alfamart Cafe`,
  ];

  const genericRestaurantDirect = [
    `Jollibee (${cleanCity})`,
    `McDonald's (${cleanCity})`,
    `Mang Inasal (${cleanCity})`,
    `Chowking (${cleanCity})`,
    `KFC (${cleanCity})`,
    `Local Carinderia / Diner Hub`,
  ];
  const genericRestaurantOther = [
    `7-Eleven Hot Meals (${cleanCity})`,
    `Uncle John's Fried Chicken (${cleanCity})`,
    `Andok's / Baliwag Lechon Manok`,
    `Turks Shawarma (${cleanCity})`,
    `Supermarket Food Hall (${cleanCity})`,
  ];

  const genericRetailDirect = [
    `SM Supermarket / Savemore (${cleanCity})`,
    `Puregold (${cleanCity})`,
    `Robinsons Supermarket (${cleanCity})`,
    `Local Commercial Boutique`,
    `Department Store Annex`,
  ];
  const genericRetailOther = [
    `7-Eleven Convenience (${cleanCity})`,
    `Alfamart Neighborhood Mart`,
    `Daiso / Japan Home Centre`,
    `Watsons Personal Care`,
    `Online Shopping & Delivery`,
  ];

  const genericLaundryDirect = [
    `Quickleen Laundromat (${cleanCity})`,
    `Wash & Dry Self-Service (${cleanCity})`,
    `Sud's Laundry Services (${cleanCity})`,
    `Express Wash Laundry Shop`,
  ];
  const genericLaundryOther = [
    `Dry Cleaning Specialists`,
    `Home Wash & Fold Pickup`,
    `Condo Basement Laundry Station`,
    `Neighborhood Ironing / Pressing`,
  ];

  switch (archetype) {
    case "bakery":
      return { direct: genericBakeryDirect, other: genericBakeryOther };
    case "cafe":
      return { direct: genericCafeDirect, other: genericCafeOther };
    case "restaurant":
      return { direct: genericRestaurantDirect, other: genericRestaurantOther };
    case "retail":
      return { direct: genericRetailDirect, other: genericRetailOther };
    case "laundry":
      return { direct: genericLaundryDirect, other: genericLaundryOther };
    default:
      return { direct: genericRestaurantDirect, other: genericRestaurantOther };
  }
}

/**
 * Intelligent location-aware establishment generator:
 * Identifies high-traffic schools, hospitals, commercial centers, transit stations, and churches
 * within walking or commuting distance (<= 5 km) based on live spatial coordinates and Philippine landmark records.
 */
export function generateLocationAwareEstablishments(
  city: string,
  coords?: { lat: number; lon: number } | null
): NearbyEstablishmentItem[] {
  const cleanCity = city || "Metro Manila";
  const iconMap: Record<string, string> = {
    University: "🏫",
    Hospital: "🏥",
    "Shopping Mall": "🛍️",
    Transit: "🚌",
    Government: "🏛️",
    Church: "⛪",
    Park: "🌳",
    "Sports / Arena": "🏟️",
    Commercial: "🏢",
    School: "🏫",
    Establishment: "📍",
  };

  // 1. Spatial proximity if coordinates are known - strictly maximum 3km
  if (coords) {
    const nearbySpatial = PHILIPPINE_LANDMARKS
      .filter((lm) => !["Street", "Highway", "City"].includes(lm.category))
      .map((lm) => {
        const distM = haversineMeters(coords.lat, coords.lon, lm.latitude, lm.longitude);
        return {
          name: lm.name,
          category: lm.category as any,
          icon: iconMap[lm.category] || "📍",
          distanceKm: parseFloat((distM / 1000).toFixed(1)),
        };
      })
      .filter((lm) => (lm.distanceKm || 0) <= 3.0)
      .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

    if (nearbySpatial.length > 0) {
      return nearbySpatial.slice(0, 12);
    }
  }

  // 2. City-based landmark matching from Philippine database
  const cityMatches = PHILIPPINE_LANDMARKS
    .filter(
      (lm) =>
        !["Street", "Highway", "City"].includes(lm.category) &&
        (cleanCity.toLowerCase() === "quezon city"
          ? lm.city.toLowerCase() === "quezon city"
          : lm.city.toLowerCase() === cleanCity.toLowerCase())
    )
    .map((lm) => ({
      name: lm.name,
      category: lm.category as any,
      icon: iconMap[lm.category] || "📍",
    }));

  if (cityMatches.length >= 3) {
    return cityMatches.slice(0, 10);
  }

  // 3. Fallback standard high-impact landmark hubs
  return [
    { name: `Local High Schools & Colleges (${cleanCity})`, category: "University", icon: "🏫" },
    { name: `Public & Private Hospitals (${cleanCity})`, category: "Hospital", icon: "🏥" },
    { name: `Shopping Malls & Supermarkets (${cleanCity})`, category: "Shopping Mall", icon: "🛍️" },
    { name: `Public Market & Retail Hub (${cleanCity})`, category: "Commercial", icon: "🛍️" },
    { name: `Jeepney, Bus & Transit Terminals (${cleanCity})`, category: "Transit", icon: "🚌" },
    { name: `Municipal / City Hall Complex (${cleanCity})`, category: "Government", icon: "🏛️" },
    { name: `Parish Church & Worship Centers (${cleanCity})`, category: "Church", icon: "⛪" },
    { name: `Corporate & BPO Offices (${cleanCity})`, category: "Commercial", icon: "🏢" },
  ];
}

/**
 * Clear in-memory competitor cache
 */
export function clearCompetitorCache(): void {
  cache.clear();
}

/**
 * Main detection engine: Combines live map POIs, Philippine landmark records,
 * and location-based business intelligence into dynamic competitor tags.
 */
export async function getDynamicCompetitorsFromLocation(
  proposedLocation: string,
  businessName: string,
  businessType: string,
  products: any[] = [],
  forceRefresh = false
): Promise<DynamicCompetitorResult> {
  const cleanLoc = (proposedLocation || "").trim();
  const city = extractCityOrArea(cleanLoc);
  const archetype = classifyBusinessArchetype(businessName, businessType, products);
  const CACHE_VERSION = "v5_max_3km_strict";
  const cacheKey = `${CACHE_VERSION}__${cleanLoc.toLowerCase()}__${archetype}__${businessName.toLowerCase()}`;

  if (!forceRefresh && cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // Set default fallback first
  const fallback = generateLocationAwareCompetitors(city, archetype);
  const fallbackEst = generateLocationAwareEstablishments(city, null);
  let result: DynamicCompetitorResult = {
    locationName: cleanLoc || city,
    detectedCity: city,
    directCompetitors: fallback.direct,
    otherCompetitors: fallback.other,
    nearbyEstablishments: fallbackEst.map((e) => e.name),
    nearbyEstablishmentItems: fallbackEst,
    source: "location_intelligence",
  };

  // If no location provided, return location intelligence
  if (!cleanLoc) {
    cache.set(cacheKey, result);
    return result;
  }

  try {
    const coords = await geocodeLocation(cleanLoc);
    if (coords) {
      const spatialEst = generateLocationAwareEstablishments(city, coords);
      const pois = await queryOverpassPOIs(coords.lat, coords.lon, 3000);

      const liveDirect: string[] = [];
      const liveOther: string[] = [];
      const liveEstItems: NearbyEstablishmentItem[] = [];

      if (pois && pois.length > 0) {
        for (const poi of pois) {
          const name = poi.name;
          const shop = (poi.shop || "").toLowerCase();
          const amenity = (poi.amenity || "").toLowerCase();
          const lowerName = name.toLowerCase();

          // Classify into Direct vs Other based on archetype
          if (archetype === "bakery") {
            if (
              shop === "bakery" ||
              lowerName.includes("bakery") ||
              lowerName.includes("bakeshop") ||
              lowerName.includes("pan") ||
              lowerName.includes("bread") ||
              lowerName.includes("goldilocks") ||
              lowerName.includes("red ribbon")
            ) {
              if (!liveDirect.includes(name)) liveDirect.push(name);
            } else if (
              shop === "convenience" ||
              lowerName.includes("7-eleven") ||
              lowerName.includes("uncle john") ||
              lowerName.includes("lawson") ||
              lowerName.includes("alfamart") ||
              amenity === "fast_food" ||
              shop === "supermarket"
            ) {
              if (!liveOther.includes(name)) liveOther.push(name);
            }
          } else if (archetype === "cafe") {
            if (
              amenity === "cafe" ||
              shop === "coffee" ||
              shop === "tea" ||
              lowerName.includes("coffee") ||
              lowerName.includes("cafe") ||
              lowerName.includes("tea") ||
              lowerName.includes("starbucks")
            ) {
              if (!liveDirect.includes(name)) liveDirect.push(name);
            } else if (
              shop === "convenience" ||
              amenity === "fast_food" ||
              shop === "bakery"
            ) {
              if (!liveOther.includes(name)) liveOther.push(name);
            }
          } else if (archetype === "restaurant") {
            if (
              amenity === "fast_food" ||
              amenity === "restaurant" ||
              lowerName.includes("grill") ||
              lowerName.includes("chicken")
            ) {
              if (!liveDirect.includes(name)) liveDirect.push(name);
            } else if (
              shop === "convenience" ||
              shop === "supermarket" ||
              shop === "bakery" ||
              amenity === "cafe"
            ) {
              if (!liveOther.includes(name)) liveOther.push(name);
            }
          } else if (archetype === "retail") {
            if (shop === "supermarket" || shop === "clothes" || shop === "mall") {
              if (!liveDirect.includes(name)) liveDirect.push(name);
            } else if (shop === "convenience" || amenity === "fast_food") {
              if (!liveOther.includes(name)) liveOther.push(name);
            }
          } else if (archetype === "laundry") {
            if (shop === "laundry" || lowerName.includes("wash") || lowerName.includes("laundry")) {
              if (!liveDirect.includes(name)) liveDirect.push(name);
            } else {
              if (!liveOther.includes(name)) liveOther.push(name);
            }
          } else {
            // General
            if (amenity === "restaurant" || amenity === "fast_food" || shop === "bakery") {
              if (!liveDirect.includes(name)) liveDirect.push(name);
            } else {
              if (!liveOther.includes(name)) liveOther.push(name);
            }
          }

          const poiLat = poi.lat;
          const poiLon = poi.lon;
          const distM = poiLat && poiLon ? haversineMeters(coords.lat, coords.lon, poiLat, poiLon) : undefined;
          const distKm = distM !== undefined ? parseFloat((distM / 1000).toFixed(1)) : undefined;

          // Strictly filter live establishments to max 3.0 km
          if (distKm !== undefined && distKm > 3.0) continue;

          if (amenity === "school" || amenity === "college" || amenity === "university") {
            liveEstItems.push({ name, category: "University", icon: "🏫", distanceKm: distKm });
          } else if (amenity === "hospital" || amenity === "clinic") {
            liveEstItems.push({ name, category: "Hospital", icon: "🏥", distanceKm: distKm });
          } else if (shop === "mall" || shop === "supermarket") {
            liveEstItems.push({ name, category: "Shopping Mall", icon: "🛍️", distanceKm: distKm });
          } else if (amenity === "bus_station") {
            liveEstItems.push({ name, category: "Transit", icon: "🚌", distanceKm: distKm });
          } else if (amenity === "townhall" || amenity === "community_centre") {
            liveEstItems.push({ name, category: "Government", icon: "🏛️", distanceKm: distKm });
          } else if (amenity === "place_of_worship") {
            liveEstItems.push({ name, category: "Church", icon: "⛪", distanceKm: distKm });
          }
        }
      }

      // Merge live results with sensible fallbacks to ensure rich clickable variety
      const mergedDirect = Array.from(new Set([...liveDirect, ...fallback.direct])).slice(0, 8);
      const mergedOther = Array.from(new Set([...liveOther, ...fallback.other])).slice(0, 8);

      // Merge spatial and live landmarks, strictly filtering to maximum 3km
      const validEstablishments: NearbyEstablishmentItem[] = [];
      const seenNames = new Set<string>();

      // 1. Spatial landmarks from DB (strictly <= 3km)
      for (const item of spatialEst) {
        if (item.distanceKm !== undefined && item.distanceKm > 3.0) continue;
        const key = item.name.toLowerCase().trim();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          validEstablishments.push(item);
        }
      }

      // 2. Live POIs from OSM (strictly <= 3km)
      for (const item of liveEstItems) {
        if (item.distanceKm !== undefined && item.distanceKm > 3.0) continue;
        const key = item.name.toLowerCase().trim();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          validEstablishments.push(item);
        }
      }

      validEstablishments.sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));

      const mergedEstItems = validEstablishments.length > 0
        ? validEstablishments.slice(0, 12)
        : fallbackEst.slice(0, 8);

      result = {
        locationName: cleanLoc,
        detectedCity: city,
        directCompetitors: mergedDirect,
        otherCompetitors: mergedOther,
        nearbyEstablishments: mergedEstItems.map((e) => e.name),
        nearbyEstablishmentItems: mergedEstItems,
        source: liveDirect.length > 0 || liveOther.length > 0 || liveEstItems.length > 0 ? "live_osm_map" : (spatialEst.length > 0 ? "local_landmark_db" : "location_intelligence"),
      };
    }
  } catch {
    // Retain fallback result on network or abort failure
  }

  cache.set(cacheKey, result);
  return result;
}

/**
 * Dynamic Target Demographics Parser:
 * Analyzes the student proposal's target market statement.
 * If age boundaries or specific customer groups are detected (e.g. "18-24", "teens 13-17", "60+"),
 * generates relevant age-bound demographic tags.
 * Falls back to standard common presets if the target market is general or unparsed.
 */
export function parseTargetMarketDemographics(targetMarket?: string): DynamicDemographicResult {
  const text = (targetMarket || "").trim();
  const defaultPresets = [
    "Students & Youth",
    "Office & BPO Workers",
    "Local Families & Residents",
    "Daily Commuters",
    "Health & Fitness Enthusiasts",
    "Young Working Professionals",
  ];

  if (!text) {
    return {
      hasDetectedProfile: false,
      detectedLabel: "Common Presets",
      demographics: defaultPresets,
    };
  }

  const lower = text.toLowerCase();

  // 1. Age range regex checks: e.g. "18-25", "18 to 25", "18 - 22 years old", "ages 15-24"
  const rangeMatch = lower.match(/(?:ages?|aged?)?\s*(\d{1,2})\s*(?:-|to|–|and)\s*(\d{1,2})(?:\s*(?:years?\s*old|y\/?o|yrs?))?/);
  const plusMatch = lower.match(/(?:ages?|aged?)?\s*(\d{1,2})\s*(?:\+|plus|and\s*above|and\s*older|above|and\s*up)/);
  const belowMatch = lower.match(/(?:below|under|less\s*than)\s*(\d{1,2})/);

  let minAge: number | null = null;
  let maxAge: number | null = null;

  if (rangeMatch) {
    minAge = parseInt(rangeMatch[1], 10);
    maxAge = parseInt(rangeMatch[2], 10);
    if (minAge > maxAge) {
      const temp = minAge;
      minAge = maxAge;
      maxAge = temp;
    }
  } else if (plusMatch) {
    minAge = parseInt(plusMatch[1], 10);
    maxAge = 99;
  } else if (belowMatch) {
    minAge = 0;
    maxAge = parseInt(belowMatch[1], 10);
  }

  const suggestions: string[] = [];

  // Age-based mapping
  if (minAge !== null && maxAge !== null) {
    const ageLabel = maxAge >= 90 ? `${minAge}+ years old` : `${minAge}–${maxAge} years old`;

    // Children & Elementary: <= 12
    if (minAge < 13 && maxAge <= 13) {
      const lo = Math.max(5, minAge);
      const hi = Math.min(12, maxAge);
      suggestions.push(
        `Elementary Students & Kids (${lo}–${hi})`,
        `Parents Buying for Children`,
        `After-School Snackers & Pupils (${lo}–${hi})`,
        `Young Children & Early Learners (${lo}–${hi})`
      );
    }

    // Teenagers & High School: 13 - 18 (only if minAge < 18)
    if (minAge < 18 && maxAge >= 13) {
      const lo = Math.max(13, minAge);
      const hi = Math.min(18, maxAge);
      suggestions.push(
        `Junior & Senior High Students (${lo}–${hi})`,
        `Gen Z Teens & Barkadas (${lo}–${hi})`,
        `School Allowance Budget Spenders (${lo}–${hi})`,
        `Youth Gamers & Snackers (${lo}–${hi})`
      );
    }

    // College & Young Adults: 18 - 25
    if (maxAge >= 18 && minAge <= 25) {
      const lo = Math.max(18, minAge);
      const hi = Math.min(25, maxAge);
      suggestions.push(
        `College & University Students (${lo}–${hi})`,
        `Campus Dormers & Boarders (${lo}–${hi})`,
        `Young Adult Budget Spenders (${lo}–${hi})`,
        `Gen Z Digital Natives (${lo}–${hi})`
      );
      if (maxAge >= 21) {
        suggestions.push(`Fresh Graduates & Entry Job Seekers (${Math.max(21, lo)}–${hi})`);
      }
    }

    // Young Working Professionals & BPO: 21 - 35
    if (maxAge >= 21 && minAge <= 35) {
      const lo = Math.max(21, minAge);
      const hi = Math.min(35, maxAge);
      suggestions.push(
        `Young Corporate & Office Staff (${lo}–${hi})`,
        `BPO & Night Shift Employees (${lo}–${hi})`,
        `Solo Living Urban Renters (${lo}–${hi})`,
        `Freelancers & Digital Nomads (${lo}–${hi})`
      );
    }

    // Adults, Parents & Families: 28 - 55
    if (maxAge >= 28 && minAge <= 55) {
      const lo = Math.max(28, minAge);
      const hi = Math.min(55, maxAge);
      suggestions.push(
        `Working Adults & Household Heads (${lo}–${hi})`,
        `Mothers & Family Budget Managers (${lo}–${hi})`,
        `Family Grocery & Bulk Buyers (${lo}–${hi})`,
        `Corporate Supervisors & SME Owners (${Math.max(30, lo)}–${hi})`
      );
    }

    // Seniors & Retirees: >= 55
    if (maxAge >= 55) {
      const lo = Math.max(55, minAge);
      suggestions.push(
        `Senior Citizens & Pensioners (${Math.max(60, lo)}+)`,
        `Health-Conscious Elders (${lo}+)`,
        `Retirees & Morning Walkers (${lo}+)`,
        `Grandparents & Senior Homemakers (${lo}+)`
      );
    }

    if (suggestions.length >= 2) {
      return {
        hasDetectedProfile: true,
        detectedLabel: `Ages ${ageLabel}`,
        demographics: Array.from(new Set(suggestions)).slice(0, 6),
      };
    }
  }

  // 2. Keyword-based matching if no explicit age numbers
  const keywordDemos: string[] = [];

  if (
    lower.includes("student") ||
    lower.includes("school") ||
    lower.includes("campus") ||
    lower.includes("university") ||
    lower.includes("college")
  ) {
    keywordDemos.push(
      "College & University Students (18–23)",
      "High School Students & Teens (13–18)",
      "Daily Campus Commuters",
      "Study Groups & Barkadas",
      "Allowance-Conscious Students"
    );
  }

  if (
    lower.includes("bpo") ||
    lower.includes("call center") ||
    lower.includes("night shift") ||
    lower.includes("office") ||
    lower.includes("worker") ||
    lower.includes("employee") ||
    lower.includes("corporate")
  ) {
    keywordDemos.push(
      "Office & Corporate Employees (22–38)",
      "BPO & Night Shift Agents (21–35)",
      "Young Working Professionals (22–32)",
      "Quick Lunch & Coffee Spenders",
      "Weekday Commuting Staff"
    );
  }

  if (
    lower.includes("family") ||
    lower.includes("families") ||
    lower.includes("parent") ||
    lower.includes("mother") ||
    lower.includes("father") ||
    lower.includes("resident") ||
    lower.includes("household")
  ) {
    keywordDemos.push(
      "Local Household Families (25–50)",
      "Mothers & Family Budget Decision Makers",
      "Subdivision Residents & Homeowners",
      "Weekend Family Diners & Shoppers",
      "Bulk Household Shoppers"
    );
  }

  if (
    lower.includes("senior") ||
    lower.includes("retiree") ||
    lower.includes("elder") ||
    lower.includes("pension")
  ) {
    keywordDemos.push(
      "Senior Citizens & Pensioners (60+)",
      "Active Retirees & Grandparents (55+)",
      "Health & Wellness Conscious Seniors (60+)",
      "Morning Walkers & Elders"
    );
  }

  if (
    lower.includes("kid") ||
    lower.includes("child") ||
    lower.includes("toddler") ||
    lower.includes("elementary")
  ) {
    keywordDemos.push(
      "Elementary School Children (6–12)",
      "Parents Purchasing for Kids",
      "Snack & Sweet-Loving Children",
      "Family Weekend Outing Kids"
    );
  }

  if (
    lower.includes("gym") ||
    lower.includes("fitness") ||
    lower.includes("athlete") ||
    lower.includes("health")
  ) {
    keywordDemos.push(
      "Fitness Enthusiasts & Gym Goers",
      "Diet & Health-Conscious Consumers",
      "Active Lifestyle Individuals",
      "High-Protein / Clean Eaters"
    );
  }

  if (
    lower.includes("commuter") ||
    lower.includes("passenger") ||
    lower.includes("driver")
  ) {
    keywordDemos.push(
      "Daily Transit Commuters",
      "Transport Drivers & Messengers",
      "On-the-Go Grab-and-Go Customers",
      "Station Walk-ins & Riders"
    );
  }

  if (keywordDemos.length >= 2) {
    return {
      hasDetectedProfile: true,
      detectedLabel: "Proposal Target Profile",
      demographics: Array.from(new Set(keywordDemos)).slice(0, 6),
    };
  }

  // Fallback to standard presets
  return {
    hasDetectedProfile: false,
    detectedLabel: "Common Presets",
    demographics: defaultPresets,
  };
}
