// RoadLedger Fuel Optimizer
// Real-time fuel price optimization by state
// Helps owner-operators save money on every fill-up

import { supabase } from '@/lib/supabase';

export interface FuelPrice {
  state: string;
  stateCode: string;
  regularPrice: number;
  dieselPrice: number;
  updatedAt: string;
  trend: 'up' | 'down' | 'stable';
  savingsVsNational: number; // cents per gallon vs national average
}

export interface FuelStop {
  id: string;
  name: string;
  brand: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  dieselPrice: number;
  regularPrice: number;
  amenities: string[];
  truckParking: boolean;
  updatedAt: string;
  distanceFromRoute?: number;
}

export interface FuelOptimization {
  currentState: string;
  currentPrice: number;
  recommendation: 'fill_now' | 'wait' | 'fill_partial';
  reason: string;
  nextCheaperState?: string;
  nextCheaperPrice?: number;
  milesUntilCheaper?: number;
  potentialSavings?: number; // dollars saved by waiting
  nearbyStops: FuelStop[];
}

// State diesel tax rates (cents per gallon) - 2026 rates
const STATE_DIESEL_TAX: Record<string, number> = {
  AL: 29.0, AK: 8.0, AZ: 26.0, AR: 28.5, CA: 68.1,
  CO: 20.5, CT: 49.2, DE: 22.0, FL: 35.3, GA: 32.2,
  HI: 17.0, ID: 32.0, IL: 54.4, IN: 54.0, IA: 30.0,
  KS: 26.0, KY: 24.6, LA: 20.0, ME: 31.2, MD: 36.1,
  MA: 26.5, MI: 26.3, MN: 28.5, MS: 18.4, MO: 17.0,
  MT: 29.6, NE: 29.6, NV: 27.0, NH: 22.2, NJ: 49.4,
  NM: 21.0, NY: 34.0, NC: 38.5, ND: 23.0, OH: 47.0,
  OK: 19.0, OR: 38.0, PA: 78.5, RI: 34.0, SC: 28.8,
  SD: 28.0, TN: 27.0, TX: 20.0, UT: 32.0, VT: 32.0,
  VA: 27.6, WA: 49.4, WV: 35.7, WI: 32.9, WY: 24.0,
};

// States with typically lowest diesel prices (good places to fill up)
const LOW_PRICE_STATES = ['OK', 'TX', 'MO', 'MS', 'LA', 'AR', 'KS', 'NE'];

// States with typically highest diesel prices (avoid filling up)
const HIGH_PRICE_STATES = ['CA', 'PA', 'IL', 'IN', 'NY', 'WA', 'NJ', 'CT'];

class FuelOptimizerService {
  private priceCache: Map<string, FuelPrice> = new Map();
  private lastFetch: Date | null = null;
  private cacheDuration = 30 * 60 * 1000; // 30 minutes

  /**
   * Get optimized fueling recommendation based on current location and route
   */
  async getOptimization(
    currentState: string,
    tankLevel: number, // 0-100%
    tankCapacity: number, // gallons
    routeStates?: string[], // upcoming states on route
    milesPerGallon?: number
  ): Promise<FuelOptimization> {
    const prices = await this.getStatePrices();
    const currentPrice = prices.find(p => p.stateCode === currentState);

    if (!currentPrice) {
      return {
        currentState,
        currentPrice: 0,
        recommendation: 'fill_now',
        reason: 'Unable to fetch prices. Fill up when convenient.',
        nearbyStops: [],
      };
    }

    const mpg = milesPerGallon || 6.5; // Default for semi truck
    const gallonsRemaining = (tankLevel / 100) * tankCapacity;
    const milesRemaining = gallonsRemaining * mpg;

    // Check if any upcoming state has cheaper fuel
    let cheaperState: FuelPrice | null = null;
    let milesToCheaper = 0;

    if (routeStates && routeStates.length > 0) {
      for (let i = 0; i < routeStates.length; i++) {
        const upcomingPrice = prices.find(p => p.stateCode === routeStates[i]);
        if (upcomingPrice && upcomingPrice.dieselPrice < currentPrice.dieselPrice - 0.10) {
          cheaperState = upcomingPrice;
          // Rough estimate: 200 miles per state
          milesToCheaper = (i + 1) * 200;
          break;
        }
      }
    }

    // Decision logic
    let recommendation: 'fill_now' | 'wait' | 'fill_partial';
    let reason: string;
    let potentialSavings: number | undefined;

    if (tankLevel < 25) {
      // Low fuel - must fill
      if (cheaperState && milesToCheaper < milesRemaining - 50) {
        recommendation = 'fill_partial';
        reason = `Fill enough to reach ${cheaperState.stateCode} where diesel is $${cheaperState.dieselPrice.toFixed(2)}/gal`;
        potentialSavings = (currentPrice.dieselPrice - cheaperState.dieselPrice) * (tankCapacity * 0.5);
      } else {
        recommendation = 'fill_now';
        reason = 'Tank low. Fill up now for safety.';
      }
    } else if (LOW_PRICE_STATES.includes(currentState)) {
      recommendation = 'fill_now';
      reason = `${currentState} has some of the lowest diesel prices. Fill up completely!`;
    } else if (HIGH_PRICE_STATES.includes(currentState) && tankLevel > 40) {
      if (cheaperState && milesToCheaper < milesRemaining) {
        recommendation = 'wait';
        reason = `${currentState} has high prices. You can make it to ${cheaperState.stateCode} (${milesToCheaper} mi) at $${cheaperState.dieselPrice.toFixed(2)}/gal`;
        potentialSavings = (currentPrice.dieselPrice - cheaperState.dieselPrice) * tankCapacity;
      } else {
        recommendation = 'fill_partial';
        reason = `${currentState} has high prices. Only fill what you need.`;
      }
    } else if (cheaperState && milesToCheaper < milesRemaining - 100) {
      recommendation = 'wait';
      reason = `Save money in ${cheaperState.stateCode} (${milesToCheaper} mi ahead) at $${cheaperState.dieselPrice.toFixed(2)}/gal`;
      potentialSavings = (currentPrice.dieselPrice - cheaperState.dieselPrice) * tankCapacity;
    } else {
      recommendation = 'fill_now';
      reason = 'Good price for this area. Fill up when convenient.';
    }

    return {
      currentState,
      currentPrice: currentPrice.dieselPrice,
      recommendation,
      reason,
      nextCheaperState: cheaperState?.stateCode,
      nextCheaperPrice: cheaperState?.dieselPrice,
      milesUntilCheaper: cheaperState ? milesToCheaper : undefined,
      potentialSavings,
      nearbyStops: [], // Would be populated by actual API call
    };
  }

  /**
   * Get current fuel prices by state
   */
  async getStatePrices(): Promise<FuelPrice[]> {
    // Check cache
    if (this.lastFetch && Date.now() - this.lastFetch.getTime() < this.cacheDuration) {
      return Array.from(this.priceCache.values());
    }

    try {
      // In production, this would call EIA API or fuel price aggregator
      // For now, return realistic mock data based on tax rates
      const nationalAverage = 3.89; // Current national diesel average

      const prices: FuelPrice[] = Object.entries(STATE_DIESEL_TAX).map(([state, tax]) => {
        // Estimate price based on tax + regional factors
        const basePrice = nationalAverage - 0.50; // Pre-tax average
        const estimatedPrice = basePrice + (tax / 100);
        const variance = (Math.random() - 0.5) * 0.20; // +/- 10 cents variance
        const finalPrice = Math.round((estimatedPrice + variance) * 100) / 100;

        return {
          state: this.getStateName(state),
          stateCode: state,
          regularPrice: finalPrice - 0.50,
          dieselPrice: finalPrice,
          updatedAt: new Date().toISOString(),
          trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable',
          savingsVsNational: Math.round((nationalAverage - finalPrice) * 100),
        };
      });

      // Update cache
      this.priceCache.clear();
      prices.forEach(p => this.priceCache.set(p.stateCode, p));
      this.lastFetch = new Date();

      return prices;
    } catch (error) {
      console.error('Failed to fetch fuel prices:', error);
      return [];
    }
  }

  /**
   * Calculate fuel cost for a route
   */
  calculateRouteFuelCost(
    totalMiles: number,
    stateBreakdown: { state: string; miles: number }[],
    mpg: number = 6.5
  ): {
    totalGallons: number;
    totalCost: number;
    byState: { state: string; gallons: number; cost: number }[];
    cheapestFillState: string;
  } {
    const prices = Array.from(this.priceCache.values());
    const totalGallons = totalMiles / mpg;

    let totalCost = 0;
    let cheapestState = '';
    let cheapestPrice = Infinity;

    const byState = stateBreakdown.map(({ state, miles }) => {
      const statePrice = prices.find(p => p.stateCode === state);
      const gallons = miles / mpg;
      const price = statePrice?.dieselPrice || 3.89;
      const cost = gallons * price;

      if (price < cheapestPrice) {
        cheapestPrice = price;
        cheapestState = state;
      }

      totalCost += cost;

      return { state, gallons: Math.round(gallons * 10) / 10, cost: Math.round(cost * 100) / 100 };
    });

    return {
      totalGallons: Math.round(totalGallons * 10) / 10,
      totalCost: Math.round(totalCost * 100) / 100,
      byState,
      cheapestFillState: cheapestState,
    };
  }

  /**
   * Get state name from code
   */
  private getStateName(code: string): string {
    const names: Record<string, string> = {
      AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
      CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
      HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
      KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
      MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
      MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
      NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
      OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
      SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
      VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
    };
    return names[code] || code;
  }
}

export const fuelOptimizer = new FuelOptimizerService();
