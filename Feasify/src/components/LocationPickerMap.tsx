import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Search,
  MapPin,
  Crosshair,
  Loader2,
  X,
  Check,
  Navigation,
  Compass,
  Building,
  Sparkles,
} from "lucide-react";
import {
  searchPlacesPH,
  getInstantLocalPlaces,
  formatCleanAddressFromPlace,
  DEFAULT_POPULAR_PLACES,
  type PlaceSuggestion,
} from "../services/philippinePlaceSearch";

interface LocationPickerMapProps {
  value: string;
  onChange: (address: string) => void;
  disabled?: boolean;
}

// Clean custom pin with location title badge (adapted from BantayBaha / Alerto PH)
// Built with transform: translate(-50%, -100%) so the needle tip is at exact [0, 0] coordinates
const createCustomPinIcon = (placeName?: string) => {
  const shortName = placeName
    ? placeName.length > 26
      ? placeName.slice(0, 24) + "..."
      : placeName
    : null;

  const badgeHtml = shortName
    ? `<div style="background: #122244; color: #ffffff; padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.35); border: 1.5px solid #c9a654; white-space: nowrap; margin-bottom: 2px; display: inline-flex; align-items: center; gap: 4px; pointer-events: none;">
         <span style="color: #c9a654;">📍</span>
         <span>${shortName}</span>
       </div>`
    : "";

  const html = `
    <div style="position: relative; width: 0; height: 0; pointer-events: none;">
      <div style="position: absolute; bottom: 0; left: 0; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; pointer-events: auto;">
        ${badgeHtml}
        <div style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35)); display: flex; flex-direction: column; align-items: center;">
          <svg width="34" height="42" viewBox="0 0 24 24" fill="#e11d48" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3" fill="#ffffff" stroke="#e11d48" stroke-width="1.5"></circle>
          </svg>
          <div style="width: 8px; height: 3px; background: rgba(0,0,0,0.3); border-radius: 50%; margin-top: -2px;"></div>
        </div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "feasify-map-pin",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -50],
  });
};

// Formats Nominatim address components into a clean, human-readable address (strictly NO raw coordinates)
const formatCleanAddress = (data: any): string => {
  if (!data) return "";
  const addr = data.address || {};

  const parts: string[] = [];

  const mainPlace =
    addr.amenity ||
    addr.building ||
    addr.shop ||
    addr.tourism ||
    addr.leisure ||
    addr.office ||
    addr.commercial ||
    "";
  if (mainPlace && !parts.includes(mainPlace)) parts.push(mainPlace);

  const road = addr.road || addr.street || addr.pedestrian || "";
  if (road && !parts.includes(road)) parts.push(road);

  const barangayOrDistrict =
    addr.suburb ||
    addr.neighbourhood ||
    addr.quarter ||
    addr.village ||
    addr.hamlet ||
    "";
  if (barangayOrDistrict && !parts.includes(barangayOrDistrict)) parts.push(barangayOrDistrict);

  const city = addr.city || addr.town || addr.municipality || "";
  if (city && !parts.includes(city)) parts.push(city);

  const provinceOrState = addr.province || addr.state || addr.region || "";
  if (provinceOrState && !parts.includes(provinceOrState) && provinceOrState !== city)
    parts.push(provinceOrState);

  const country = addr.country || "Philippines";
  if (country && !parts.includes(country)) parts.push(country);

  if (parts.length > 0) {
    return parts.join(", ");
  }

  if (data.display_name) {
    const rawParts = data.display_name.split(",").map((s: string) => s.trim());
    const filtered = rawParts.filter((p: string) => !/^\d{4,5}$/.test(p));
    return filtered.slice(0, 5).join(", ");
  }

  return "";
};

// BantayBaha text highlighter for query matching
const renderHighlightedText = (text: string, query: string) => {
  if (!query.trim()) return <span>{text}</span>;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.substring(0, idx)}
      <strong className="text-[#122244] font-black underline decoration-[#c9a654]">
        {text.substring(idx, idx + q.length)}
      </strong>
      {text.substring(idx + q.length)}
    </span>
  );
};

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep latest onChange in ref to prevent map destruction on parent re-render
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Keep latest disabled in ref
  const disabledRef = useRef(disabled);
  useEffect(() => {
    disabledRef.current = disabled;
    if (markerRef.current) {
      if (disabled) {
        markerRef.current.dragging?.disable();
      } else {
        markerRef.current.dragging?.enable();
      }
    }
  }, [disabled]);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  // Philippines default center (Metro Manila / Rizal junction)
  const DEFAULT_LAT = 14.5995;
  const DEFAULT_LNG = 120.9842;
  const DEFAULT_ZOOM = 13;

  // Drops or moves the pin on the map with custom badge & interactive popup
  const placePinOnMap = useCallback(
    (lat: number, lng: number, placeName: string, subtitle?: string) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      // 1. Remove previous marker if exists
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }

      // 2. Create high-visibility pin
      const icon = createCustomPinIcon(placeName);
      const marker = L.marker([lat, lng], {
        icon,
        draggable: !disabledRef.current,
        zIndexOffset: 1000,
      }).addTo(map);

      // 3. Popup with place info
      const popupHtml = `
        <div style="font-family: inherit; padding: 4px 6px; min-width: 170px;">
          <div style="font-size: 10px; font-weight: 800; color: #c9a654; text-transform: uppercase; letter-spacing: 0.05em;">
            📍 Selected Location
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #122244; margin-top: 3px;">
            ${placeName}
          </div>
          ${
            subtitle
              ? `<div style="font-size: 11px; color: #64748b; margin-top: 3px; border-top: 1px solid #f1f5f9; padding-top: 3px;">${subtitle}</div>`
              : ""
          }
        </div>
      `;
      marker.bindPopup(popupHtml, { autoPan: true });

      // 4. Handle marker drag
      marker.on("dragend", async (e: any) => {
        const pos = e.target.getLatLng();
        handleReverseGeocode(pos.lat, pos.lng);
      });

      markerRef.current = marker;

      // 5. Invalidate size and center map view
      map.invalidateSize();
      map.setView([lat, lng], 16, { animate: true });
      setTimeout(() => {
        if (markerRef.current) {
          markerRef.current.openPopup();
        }
      }, 150);
    },
    []
  );

  // Reverse geocodes coordinates to a clean address string
  const handleReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      setIsReverseGeocoding(true);
      setStatusNote("Resolving street address...");
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
          {
            headers: {
              "Accept-Language": "en,fil",
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          const cleanAddr = formatCleanAddress(data);
          if (cleanAddr) {
            onChangeRef.current(cleanAddr);
            placePinOnMap(lat, lng, cleanAddr.split(",")[0] || "Pinned Location", cleanAddr);
            setStatusNote(`Pinned: ${cleanAddr}`);
            setTimeout(() => setStatusNote(null), 4000);
          } else {
            setStatusNote("Location pinned.");
          }
        } else {
          setStatusNote("Could not retrieve street name. You may edit the address manually.");
        }
      } catch (err) {
        console.error("Reverse geocoding error:", err);
        setStatusNote("Network slow or offline. You can edit the address directly in the box.");
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [placePinOnMap]
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestionsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initialize Leaflet Map (Runs ONCE on mount)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [DEFAULT_LAT, DEFAULT_LNG],
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Handle Map Clicks to set pin
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (disabledRef.current) return;
      const { lat, lng } = e.latlng;
      placePinOnMap(lat, lng, "Pinned Location", "Resolving exact address...");
      handleReverseGeocode(lat, lng);
    });

    // ResizeObserver ensures map tiles are never distorted or cut off
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []); // Strictly empty dependency array so map is NEVER destroyed on re-renders!

  // Geocode initial value once on mount if non-empty
  const initialValueGeocodedRef = useRef(false);
  useEffect(() => {
    if (!value || initialValueGeocodedRef.current || !mapInstanceRef.current) return;
    initialValueGeocodedRef.current = true;

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            value
          )}&countrycodes=ph&limit=1`,
          {
            headers: { "Accept-Language": "en,fil" },
          }
        );
        if (res.ok) {
          const results = await res.json();
          if (results && results.length > 0 && mapInstanceRef.current) {
            const lat = parseFloat(results[0].lat);
            const lon = parseFloat(results[0].lon);
            placePinOnMap(lat, lon, value.split(",")[0] || "Saved Location", value);
          }
        }
      } catch {
        // Silently skip if offline
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [value, placePinOnMap]);

  // BantayBaha Place Search Handler: Instant local match + debounced online lookup
  const handleQueryChange = (val: string) => {
    setSearchQuery(val);
    setShowSuggestionsDropdown(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = val.trim();
    if (!trimmed) {
      setSuggestions(DEFAULT_POPULAR_PLACES.slice(0, 8));
      setIsSearching(false);
      return;
    }

    // 1. Instant local search from BantayBaha 150+ Philippine landmarks dataset (0ms latency)
    const instantLocal = getInstantLocalPlaces(trimmed, 8);
    setSuggestions(instantLocal);

    // 2. Debounced online lookup via OpenStreetMap Nominatim with Philippine language parameters
    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const merged = await searchPlacesPH(trimmed, 10, controller.signal);
        setSuggestions(merged);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Search error:", err);
        }
      } finally {
        setIsSearching(false);
      }
    }, 220);
  };

  // When a place is selected from the suggestions dropdown
  const handleSelectPlace = (place: PlaceSuggestion) => {
    const lat = place.latitude;
    const lng = place.longitude;
    const cleanAddress = formatCleanAddressFromPlace(place);

    // Place pin on map immediately with name badge & popup
    placePinOnMap(lat, lng, place.name, place.displayName);

    // Update parent proposal state (strictly no coordinates)
    onChangeRef.current(cleanAddress);

    // UI feedback
    setShowSuggestionsDropdown(false);
    setSearchQuery("");
    setStatusNote(`Pinned: ${place.name}`);
    setTimeout(() => setStatusNote(null), 4000);
  };

  // Submit / enter search
  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    try {
      const results = await searchPlacesPH(q, 10);
      setSuggestions(results);
      if (results.length > 0) {
        handleSelectPlace(results[0]);
      } else {
        setStatusNote("No places found. Try another landmark or street name.");
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Quick chips selection
  const handleSelectQuickChip = (chipQuery: string) => {
    const local = getInstantLocalPlaces(chipQuery, 1);
    if (local.length > 0) {
      handleSelectPlace(local[0]);
    } else {
      handleQueryChange(chipQuery);
    }
  };

  // GPS Device locator
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setStatusNote("Acquiring GPS location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        placePinOnMap(latitude, longitude, "My Current Location", "Acquired via GPS");
        handleReverseGeocode(latitude, longitude);
      },
      (err) => {
        console.warn("Geolocation denied or unavailable:", err);
        setStatusNote("Could not detect device location. You can search or tap on the map.");
        setTimeout(() => setStatusNote(null), 4000);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-3">
      {/* Search Bar & Controls (BantayBaha / Alerto PH style) */}
      {!disabled && (
        <div ref={dropdownRef} className="relative">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search landmark, street, barangay, or mall (e.g. MOA, BGC, PLV, SM North, Ayala)..."
                value={searchQuery}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => {
                  if (suggestions.length === 0) {
                    setSuggestions(
                      searchQuery.trim()
                        ? getInstantLocalPlaces(searchQuery.trim(), 8)
                        : DEFAULT_POPULAR_PLACES.slice(0, 8)
                    );
                  }
                  setShowSuggestionsDropdown(true);
                }}
                className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-200 focus:border-[#c9a654] focus:ring-2 focus:ring-[#c9a654]/20 rounded-xl text-xs sm:text-sm font-medium outline-none transition-all shadow-xs"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSuggestions(DEFAULT_POPULAR_PLACES.slice(0, 8));
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-4 py-2.5 bg-[#122244] hover:bg-[#1a2f55] text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Search</span>
            </button>

            <button
              type="button"
              onClick={handleLocateMe}
              title="Detect my GPS location"
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors shadow-xs flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Crosshair className="w-4 h-4 text-gray-600" />
            </button>
          </form>

          {/* Quick Popular Philippine Landmarks Chips */}
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 no-scrollbar text-[11px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#c9a654]" /> Quick:
            </span>
            {[
              { label: "BGC Taguig", q: "Bonifacio Global City" },
              { label: "SM MOA", q: "SM Mall of Asia" },
              { label: "Ayala Makati", q: "Ayala Center Makati" },
              { label: "PLV Valenzuela", q: "PLV" },
              { label: "SM North EDSA", q: "SM North EDSA" },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleSelectQuickChip(chip.q)}
                className="px-2.5 py-1 bg-amber-50/70 hover:bg-amber-100 text-[#122244] font-medium rounded-lg border border-amber-200/60 whitespace-nowrap transition-colors cursor-pointer text-[11px]"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* BantayBaha Style Autocomplete Dropdown with High Z-Index */}
          {showSuggestionsDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-2xl z-[2000] max-h-72 overflow-y-auto divide-y divide-gray-100 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="p-2.5 bg-gray-50/90 text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#c9a654]" />
                  <span>
                    {!searchQuery.trim()
                      ? "Popular Philippine Hubs & Landmarks"
                      : `Search Suggestions (${suggestions.length})`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSuggestionsDropdown(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {suggestions.length > 0 ? (
                suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectPlace(item)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectPlace(item);
                    }}
                    className="w-full text-left p-3 hover:bg-amber-50/50 flex items-start gap-3 transition-colors cursor-pointer group"
                  >
                    <div className="p-1.5 rounded-lg bg-orange-50 text-[#c9a654] border border-orange-100 mt-0.5 group-hover:scale-105 transition-transform shrink-0">
                      {item.category === "University" || item.category === "Hospital" ? (
                        <Building className="w-3.5 h-3.5" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-[#122244] truncate">
                          {renderHighlightedText(item.name, searchQuery)}
                        </p>
                        {item.category && (
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-gray-100 text-gray-600 rounded border border-gray-200 shrink-0">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">
                        {item.displayName || `${item.barangay ? `${item.barangay}, ` : ""}${item.city}`}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-gray-500">
                  {isSearching ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c9a654]" />
                      <span>Searching across Philippine places...</span>
                    </div>
                  ) : (
                    <span>No places found. Try typing a landmark or street name.</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Map Container */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-100">
        <div
          ref={mapContainerRef}
          className="w-full h-64 sm:h-72 z-10"
          style={{ minHeight: "260px" }}
        />

        {/* Loading Overlay */}
        {(isReverseGeocoding || isSearching) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-xs px-3.5 py-1.5 rounded-full shadow-md border border-gray-200 flex items-center gap-2 text-xs font-bold text-[#122244] animate-in fade-in">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c9a654]" />
            <span>{isReverseGeocoding ? "Resolving Street Address..." : "Searching Places..."}</span>
          </div>
        )}

        {/* Bottom Helper Badge */}
        {!disabled && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 pointer-events-none flex items-center justify-between">
            <span className="bg-[#122244]/85 backdrop-blur-xs text-white text-[10px] font-semibold px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1.5">
              <Navigation className="w-3 h-3 text-[#c9a654]" />
              Tap map or drag pin to adjust exact location
            </span>
          </div>
        )}
      </div>

      {/* Status Note Feedback */}
      {statusNote && (
        <div className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5 animate-in fade-in">
          <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
          <span className="truncate">{statusNote}</span>
        </div>
      )}
    </div>
  );
};
