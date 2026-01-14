// RoadLedger Load Profitability Calculator
// Know if a load is worth taking BEFORE you accept it
// The #1 feature owner-operators need

export interface LoadDetails {
  // Basic info
  origin: string;
  originState: string;
  destination: string;
  destinationState: string;

  // Miles
  loadedMiles: number;
  deadheadMilesToPickup: number;

  // Payment
  rate: number; // Total payment for load
  fuelSurcharge?: number;
  detention?: number;

  // Optional details
  weight?: number; // lbs
  commodity?: string;
  broker?: string;
  pickupDate?: string;
  deliveryDate?: string;
}

export interface OperatingCosts {
  // Per-mile costs
  fuelCostPerMile: number; // Based on MPG and fuel price
  maintenancePerMile: number;
  tiresPerMile: number;

  // Fixed costs (daily)
  insurancePerDay: number;
  truckPaymentPerDay: number;
  trailerPaymentPerDay: number;
  permitsFees: number;

  // Variable
  mpg: number;
  fuelPricePerGallon: number;
}

export interface LoadProfitability {
  // Revenue
  totalRevenue: number;
  ratePerMile: number; // Loaded miles only
  ratePerAllMiles: number; // Including deadhead

  // Costs
  totalFuelCost: number;
  totalMaintenanceCost: number;
  totalTiresCost: number;
  totalFixedCosts: number;
  totalCosts: number;
  costPerMile: number;

  // Profit
  grossProfit: number;
  netProfit: number;
  profitPerMile: number;
  profitPerHour: number;
  profitMargin: number; // percentage

  // Verdict
  verdict: 'excellent' | 'good' | 'marginal' | 'bad' | 'loss';
  verdictReason: string;
  recommendation: string;

  // Benchmarks
  industryAvgRPM: number;
  percentVsAverage: number;

  // Breakdown
  breakdown: {
    category: string;
    amount: number;
    perMile: number;
  }[];
}

// Default operating costs for a typical owner-operator
const DEFAULT_COSTS: OperatingCosts = {
  fuelCostPerMile: 0.65, // At 6.5 MPG and $4.20/gal
  maintenancePerMile: 0.15,
  tiresPerMile: 0.04,
  insurancePerDay: 40,
  truckPaymentPerDay: 60,
  trailerPaymentPerDay: 25,
  permitsFees: 10,
  mpg: 6.5,
  fuelPricePerGallon: 4.00,
};

// Industry benchmarks (2026)
const INDUSTRY_BENCHMARKS = {
  dryVan: {
    avgRPM: 2.45,
    minAcceptable: 2.00,
  },
  reefer: {
    avgRPM: 2.85,
    minAcceptable: 2.40,
  },
  flatbed: {
    avgRPM: 3.00,
    minAcceptable: 2.50,
  },
  default: {
    avgRPM: 2.50,
    minAcceptable: 2.00,
  },
};

class LoadCalculatorService {
  private userCosts: OperatingCosts = DEFAULT_COSTS;

  /**
   * Set custom operating costs for the user
   */
  setOperatingCosts(costs: Partial<OperatingCosts>): void {
    this.userCosts = { ...this.userCosts, ...costs };

    // Recalculate fuel cost per mile
    if (costs.mpg || costs.fuelPricePerGallon) {
      this.userCosts.fuelCostPerMile =
        this.userCosts.fuelPricePerGallon / this.userCosts.mpg;
    }
  }

  /**
   * Calculate load profitability
   */
  calculate(load: LoadDetails, trailerType: 'dryVan' | 'reefer' | 'flatbed' = 'dryVan'): LoadProfitability {
    const costs = this.userCosts;
    const benchmarks = INDUSTRY_BENCHMARKS[trailerType] || INDUSTRY_BENCHMARKS.default;

    // Total miles
    const totalMiles = load.loadedMiles + load.deadheadMilesToPickup;

    // Estimate trip duration (avg 500 miles/day)
    const tripDays = Math.max(1, Math.ceil(totalMiles / 500));

    // Revenue
    const totalRevenue = load.rate + (load.fuelSurcharge || 0) + (load.detention || 0);
    const ratePerMile = totalRevenue / load.loadedMiles;
    const ratePerAllMiles = totalRevenue / totalMiles;

    // Variable costs
    const totalFuelCost = totalMiles * costs.fuelCostPerMile;
    const totalMaintenanceCost = totalMiles * costs.maintenancePerMile;
    const totalTiresCost = totalMiles * costs.tiresPerMile;

    // Fixed costs (prorated for trip duration)
    const totalFixedCosts = tripDays * (
      costs.insurancePerDay +
      costs.truckPaymentPerDay +
      costs.trailerPaymentPerDay +
      costs.permitsFees
    );

    // Total costs
    const totalCosts = totalFuelCost + totalMaintenanceCost + totalTiresCost + totalFixedCosts;
    const costPerMile = totalCosts / totalMiles;

    // Profit calculations
    const grossProfit = totalRevenue - totalFuelCost;
    const netProfit = totalRevenue - totalCosts;
    const profitPerMile = netProfit / totalMiles;
    const profitPerHour = netProfit / (tripDays * 10); // Assume 10 driving hours/day
    const profitMargin = (netProfit / totalRevenue) * 100;

    // Comparison to industry
    const percentVsAverage = ((ratePerMile - benchmarks.avgRPM) / benchmarks.avgRPM) * 100;

    // Verdict
    let verdict: LoadProfitability['verdict'];
    let verdictReason: string;
    let recommendation: string;

    if (netProfit < 0) {
      verdict = 'loss';
      verdictReason = `This load loses $${Math.abs(netProfit).toFixed(2)}`;
      recommendation = 'DECLINE this load. You will lose money.';
    } else if (ratePerAllMiles < benchmarks.minAcceptable) {
      verdict = 'bad';
      verdictReason = `Rate per mile ($${ratePerAllMiles.toFixed(2)}) is below minimum ($${benchmarks.minAcceptable.toFixed(2)})`;
      recommendation = 'Negotiate higher rate or decline. Not worth your time.';
    } else if (profitMargin < 15) {
      verdict = 'marginal';
      verdictReason = `Profit margin of ${profitMargin.toFixed(1)}% is thin`;
      recommendation = 'Only take if you need the miles or have no better options.';
    } else if (ratePerMile >= benchmarks.avgRPM && profitMargin >= 25) {
      verdict = 'excellent';
      verdictReason = `${percentVsAverage.toFixed(0)}% above market rate with strong margin`;
      recommendation = 'TAKE IT! This is a great load.';
    } else {
      verdict = 'good';
      verdictReason = `Solid load at $${profitPerMile.toFixed(2)}/mile profit`;
      recommendation = 'Good load worth taking.';
    }

    // Cost breakdown
    const breakdown = [
      { category: 'Fuel', amount: totalFuelCost, perMile: costs.fuelCostPerMile },
      { category: 'Maintenance', amount: totalMaintenanceCost, perMile: costs.maintenancePerMile },
      { category: 'Tires', amount: totalTiresCost, perMile: costs.tiresPerMile },
      { category: 'Insurance', amount: tripDays * costs.insurancePerDay, perMile: (tripDays * costs.insurancePerDay) / totalMiles },
      { category: 'Truck Payment', amount: tripDays * costs.truckPaymentPerDay, perMile: (tripDays * costs.truckPaymentPerDay) / totalMiles },
      { category: 'Trailer', amount: tripDays * costs.trailerPaymentPerDay, perMile: (tripDays * costs.trailerPaymentPerDay) / totalMiles },
      { category: 'Permits/Fees', amount: tripDays * costs.permitsFees, perMile: (tripDays * costs.permitsFees) / totalMiles },
    ];

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      ratePerMile: Math.round(ratePerMile * 100) / 100,
      ratePerAllMiles: Math.round(ratePerAllMiles * 100) / 100,
      totalFuelCost: Math.round(totalFuelCost * 100) / 100,
      totalMaintenanceCost: Math.round(totalMaintenanceCost * 100) / 100,
      totalTiresCost: Math.round(totalTiresCost * 100) / 100,
      totalFixedCosts: Math.round(totalFixedCosts * 100) / 100,
      totalCosts: Math.round(totalCosts * 100) / 100,
      costPerMile: Math.round(costPerMile * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      profitPerMile: Math.round(profitPerMile * 100) / 100,
      profitPerHour: Math.round(profitPerHour * 100) / 100,
      profitMargin: Math.round(profitMargin * 10) / 10,
      verdict,
      verdictReason,
      recommendation,
      industryAvgRPM: benchmarks.avgRPM,
      percentVsAverage: Math.round(percentVsAverage),
      breakdown: breakdown.map(b => ({
        category: b.category,
        amount: Math.round(b.amount * 100) / 100,
        perMile: Math.round(b.perMile * 100) / 100,
      })),
    };
  }

  /**
   * Quick check - minimum acceptable rate for a load
   */
  getMinimumRate(loadedMiles: number, deadheadMiles: number = 0): number {
    const totalMiles = loadedMiles + deadheadMiles;
    const minRPM = 2.00; // Minimum $2.00/mile to be profitable
    const minRate = totalMiles * minRPM;
    return Math.round(minRate * 100) / 100;
  }

  /**
   * Compare multiple loads
   */
  compareLoads(loads: LoadDetails[]): {
    ranked: (LoadProfitability & { loadIndex: number })[];
    best: number;
    worst: number;
  } {
    const results = loads.map((load, index) => ({
      ...this.calculate(load),
      loadIndex: index,
    }));

    // Sort by profit per mile (descending)
    results.sort((a, b) => b.profitPerMile - a.profitPerMile);

    return {
      ranked: results,
      best: results[0]?.loadIndex ?? 0,
      worst: results[results.length - 1]?.loadIndex ?? 0,
    };
  }
}

export const loadCalculator = new LoadCalculatorService();
