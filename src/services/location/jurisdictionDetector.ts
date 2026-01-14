import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

// Type for state boundary data
interface StateBoundary {
  code: string;
  name: string;
  feature: Feature<Polygon | MultiPolygon>;
}

// Cache for loaded boundaries
let stateBoundaries: StateBoundary[] = [];
let boundariesLoaded = false;

// Cache for last known state (optimization)
let lastKnownState: string | null = null;

// Neighboring states map for faster lookups
const neighboringStates: Record<string, string[]> = {
  AL: ['FL', 'GA', 'TN', 'MS'],
  AK: [],
  AZ: ['CA', 'NV', 'UT', 'CO', 'NM'],
  AR: ['MO', 'TN', 'MS', 'LA', 'TX', 'OK'],
  CA: ['OR', 'NV', 'AZ'],
  CO: ['WY', 'NE', 'KS', 'OK', 'NM', 'AZ', 'UT'],
  CT: ['NY', 'MA', 'RI'],
  DE: ['PA', 'MD', 'NJ'],
  FL: ['GA', 'AL'],
  GA: ['FL', 'AL', 'TN', 'NC', 'SC'],
  HI: [],
  ID: ['MT', 'WY', 'UT', 'NV', 'OR', 'WA'],
  IL: ['WI', 'IA', 'MO', 'KY', 'IN'],
  IN: ['MI', 'OH', 'KY', 'IL'],
  IA: ['MN', 'SD', 'NE', 'MO', 'IL', 'WI'],
  KS: ['NE', 'CO', 'OK', 'MO'],
  KY: ['OH', 'WV', 'VA', 'TN', 'MO', 'IL', 'IN'],
  LA: ['TX', 'AR', 'MS'],
  ME: ['NH'],
  MD: ['PA', 'DE', 'VA', 'WV', 'DC'],
  MA: ['NH', 'VT', 'NY', 'CT', 'RI'],
  MI: ['OH', 'IN', 'WI'],
  MN: ['WI', 'IA', 'SD', 'ND'],
  MS: ['TN', 'AL', 'LA', 'AR'],
  MO: ['IA', 'IL', 'KY', 'TN', 'AR', 'OK', 'KS', 'NE'],
  MT: ['ND', 'SD', 'WY', 'ID'],
  NE: ['SD', 'WY', 'CO', 'KS', 'MO', 'IA'],
  NV: ['OR', 'ID', 'UT', 'AZ', 'CA'],
  NH: ['ME', 'MA', 'VT'],
  NJ: ['NY', 'PA', 'DE'],
  NM: ['CO', 'OK', 'TX', 'AZ'],
  NY: ['VT', 'MA', 'CT', 'NJ', 'PA'],
  NC: ['VA', 'TN', 'GA', 'SC'],
  ND: ['MT', 'SD', 'MN'],
  OH: ['MI', 'PA', 'WV', 'KY', 'IN'],
  OK: ['KS', 'MO', 'AR', 'TX', 'NM', 'CO'],
  OR: ['WA', 'ID', 'NV', 'CA'],
  PA: ['NY', 'NJ', 'DE', 'MD', 'WV', 'OH'],
  RI: ['MA', 'CT'],
  SC: ['NC', 'GA'],
  SD: ['ND', 'MT', 'WY', 'NE', 'IA', 'MN'],
  TN: ['KY', 'VA', 'NC', 'GA', 'AL', 'MS', 'AR', 'MO'],
  TX: ['NM', 'OK', 'AR', 'LA'],
  UT: ['ID', 'WY', 'CO', 'NM', 'AZ', 'NV'],
  VT: ['NH', 'MA', 'NY'],
  VA: ['MD', 'WV', 'KY', 'TN', 'NC', 'DC'],
  WA: ['ID', 'OR'],
  WV: ['PA', 'MD', 'VA', 'KY', 'OH'],
  WI: ['MN', 'IA', 'IL', 'MI'],
  WY: ['MT', 'SD', 'NE', 'CO', 'UT', 'ID'],
  DC: ['MD', 'VA'],
};

// Simplified US state boundaries (bounding boxes for initial filtering)
// This is a simplified approach - in production, you'd load actual GeoJSON
const stateBoundingBoxes: Record<string, [number, number, number, number]> = {
  // [minLng, minLat, maxLng, maxLat]
  AL: [-88.473227, 30.223334, -84.888246, 35.008028],
  AK: [-179.148909, 51.214183, 179.77847, 71.365162],
  AZ: [-114.81651, 31.332177, -109.045223, 37.00426],
  AR: [-94.617919, 33.004106, -89.644395, 36.4996],
  CA: [-124.409591, 32.534156, -114.131211, 42.009518],
  CO: [-109.060253, 36.992426, -102.041524, 41.003444],
  CT: [-73.727775, 40.980144, -71.786994, 42.050587],
  DE: [-75.788658, 38.451013, -75.048939, 39.839007],
  FL: [-87.634938, 24.523096, -80.031362, 31.000888],
  GA: [-85.605165, 30.357851, -80.839729, 35.000659],
  HI: [-160.073654, 18.910361, -154.806773, 22.235394],
  ID: [-117.243027, 41.988057, -111.043564, 49.001146],
  IL: [-91.513079, 36.970298, -87.494756, 42.508481],
  IN: [-88.09776, 37.771742, -84.784579, 41.760592],
  IA: [-96.639704, 40.375501, -90.140061, 43.501196],
  KS: [-102.051744, 36.993016, -94.588413, 40.003162],
  KY: [-89.571509, 36.497129, -81.964971, 39.147458],
  LA: [-94.043147, 28.928609, -88.817017, 33.019457],
  ME: [-71.083924, 42.977764, -66.949895, 47.459686],
  MD: [-79.487651, 37.911717, -75.048939, 39.723043],
  MA: [-73.508142, 41.237964, -69.928393, 42.886589],
  MI: [-90.418136, 41.696118, -82.413474, 48.2388],
  MN: [-97.239209, 43.499356, -89.491739, 49.384358],
  MS: [-91.655009, 30.173943, -88.097888, 34.996052],
  MO: [-95.774704, 35.995683, -89.098843, 40.61364],
  MT: [-116.050003, 44.358221, -104.039138, 49.00139],
  NE: [-104.053514, 40.001626, -95.30829, 43.001708],
  NV: [-120.005746, 35.001857, -114.039648, 42.002207],
  NH: [-72.557247, 42.69699, -70.610621, 45.305476],
  NJ: [-75.559614, 38.928519, -73.893979, 41.357423],
  NM: [-109.050173, 31.332301, -103.001964, 37.000232],
  NY: [-79.762152, 40.496103, -71.856214, 45.01585],
  NC: [-84.321869, 33.842316, -75.460621, 36.588117],
  ND: [-104.0489, 45.935054, -96.554507, 49.000574],
  OH: [-84.820159, 38.403202, -80.518693, 41.977523],
  OK: [-103.002565, 33.615833, -94.430662, 37.002206],
  OR: [-124.566244, 41.991794, -116.463504, 46.292035],
  PA: [-80.519891, 39.7198, -74.689516, 42.26986],
  RI: [-71.862772, 41.146339, -71.12057, 42.018798],
  SC: [-83.35391, 32.0346, -78.54203, 35.215402],
  SD: [-104.057698, 42.479635, -96.436589, 45.94545],
  TN: [-90.310298, 34.982972, -81.6469, 36.678118],
  TX: [-106.645646, 25.837377, -93.508292, 36.500704],
  UT: [-114.052962, 36.997968, -109.041058, 42.001567],
  VT: [-73.43774, 42.726853, -71.464555, 45.016659],
  VA: [-83.675395, 36.540738, -75.242266, 39.466012],
  WA: [-124.733174, 45.543541, -116.915989, 49.002494],
  WV: [-82.644739, 37.201483, -77.719519, 40.638801],
  WI: [-92.888114, 42.491983, -86.805415, 47.080621],
  WY: [-111.056888, 40.994746, -104.05216, 45.005904],
  DC: [-77.119759, 38.791645, -76.909395, 38.99511],
};

// Initialize boundaries (load GeoJSON)
export async function initializeBoundaries(): Promise<void> {
  if (boundariesLoaded) return;

  try {
    // In a real implementation, you would load actual GeoJSON boundaries
    // For now, we'll use the bounding boxes for approximate detection
    // The full GeoJSON file would be loaded from assets/geo/us-states.json

    // Create simplified polygon features from bounding boxes
    stateBoundaries = Object.entries(stateBoundingBoxes).map(([code, bbox]) => {
      const [minLng, minLat, maxLng, maxLat] = bbox;
      return {
        code,
        name: code, // In full implementation, map to full name
        feature: turf.bboxPolygon(bbox) as Feature<Polygon>,
      };
    });

    boundariesLoaded = true;
    console.log(`Loaded ${stateBoundaries.length} state boundaries`);
  } catch (error) {
    console.error('Failed to initialize boundaries:', error);
    throw error;
  }
}

// Detect jurisdiction from coordinates
export function detectJurisdiction(
  latitude: number,
  longitude: number
): string | null {
  if (!boundariesLoaded || stateBoundaries.length === 0) {
    console.warn('Boundaries not loaded, cannot detect jurisdiction');
    return null;
  }

  const point = turf.point([longitude, latitude]);

  // Optimization: Check last known state first
  if (lastKnownState) {
    const lastState = stateBoundaries.find((s) => s.code === lastKnownState);
    if (lastState && turf.booleanPointInPolygon(point, lastState.feature)) {
      return lastKnownState;
    }

    // Check neighboring states
    const neighbors = neighboringStates[lastKnownState] || [];
    for (const neighborCode of neighbors) {
      const neighbor = stateBoundaries.find((s) => s.code === neighborCode);
      if (neighbor && turf.booleanPointInPolygon(point, neighbor.feature)) {
        lastKnownState = neighborCode;
        return neighborCode;
      }
    }
  }

  // Fall back to checking all states
  for (const state of stateBoundaries) {
    if (turf.booleanPointInPolygon(point, state.feature)) {
      lastKnownState = state.code;
      return state.code;
    }
  }

  return null;
}

// Get jurisdiction with confidence score
export function detectJurisdictionWithConfidence(
  latitude: number,
  longitude: number
): { jurisdiction: string | null; confidence: number } {
  const jurisdiction = detectJurisdiction(latitude, longitude);

  if (!jurisdiction) {
    return { jurisdiction: null, confidence: 0 };
  }

  // Calculate confidence based on distance from boundary
  // Higher confidence when further from state borders
  const state = stateBoundaries.find((s) => s.code === jurisdiction);
  if (!state) {
    return { jurisdiction, confidence: 0.5 };
  }

  const point = turf.point([longitude, latitude]);

  // Get distance to nearest boundary edge
  // In a real implementation, you'd calculate actual distance to polygon edge
  // For now, use a simplified confidence based on being in the state
  const centroid = turf.centroid(state.feature);
  const distanceToCenter = turf.distance(point, centroid, { units: 'miles' });

  // Simple confidence: closer to center = higher confidence
  // This is a simplification - real implementation would use boundary distance
  const maxRadius = 200; // approximate max state radius
  const confidence = Math.max(0.5, 1 - distanceToCenter / maxRadius);

  return { jurisdiction, confidence: Math.min(confidence, 0.99) };
}

// Reset last known state (for new trip)
export function resetJurisdictionCache(): void {
  lastKnownState = null;
}

// Check if a jurisdiction is valid
export function isValidJurisdiction(code: string): boolean {
  return code in stateBoundingBoxes;
}

// Get all valid jurisdiction codes
export function getAllJurisdictionCodes(): string[] {
  return Object.keys(stateBoundingBoxes);
}
