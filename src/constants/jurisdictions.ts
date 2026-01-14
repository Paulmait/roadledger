// IFTA Jurisdictions - US States and Canadian Provinces
export const IFTA_JURISDICTIONS = {
  // US States
  AL: { name: 'Alabama', country: 'US' },
  AK: { name: 'Alaska', country: 'US' },
  AZ: { name: 'Arizona', country: 'US' },
  AR: { name: 'Arkansas', country: 'US' },
  CA: { name: 'California', country: 'US' },
  CO: { name: 'Colorado', country: 'US' },
  CT: { name: 'Connecticut', country: 'US' },
  DE: { name: 'Delaware', country: 'US' },
  FL: { name: 'Florida', country: 'US' },
  GA: { name: 'Georgia', country: 'US' },
  HI: { name: 'Hawaii', country: 'US' },
  ID: { name: 'Idaho', country: 'US' },
  IL: { name: 'Illinois', country: 'US' },
  IN: { name: 'Indiana', country: 'US' },
  IA: { name: 'Iowa', country: 'US' },
  KS: { name: 'Kansas', country: 'US' },
  KY: { name: 'Kentucky', country: 'US' },
  LA: { name: 'Louisiana', country: 'US' },
  ME: { name: 'Maine', country: 'US' },
  MD: { name: 'Maryland', country: 'US' },
  MA: { name: 'Massachusetts', country: 'US' },
  MI: { name: 'Michigan', country: 'US' },
  MN: { name: 'Minnesota', country: 'US' },
  MS: { name: 'Mississippi', country: 'US' },
  MO: { name: 'Missouri', country: 'US' },
  MT: { name: 'Montana', country: 'US' },
  NE: { name: 'Nebraska', country: 'US' },
  NV: { name: 'Nevada', country: 'US' },
  NH: { name: 'New Hampshire', country: 'US' },
  NJ: { name: 'New Jersey', country: 'US' },
  NM: { name: 'New Mexico', country: 'US' },
  NY: { name: 'New York', country: 'US' },
  NC: { name: 'North Carolina', country: 'US' },
  ND: { name: 'North Dakota', country: 'US' },
  OH: { name: 'Ohio', country: 'US' },
  OK: { name: 'Oklahoma', country: 'US' },
  OR: { name: 'Oregon', country: 'US' },
  PA: { name: 'Pennsylvania', country: 'US' },
  RI: { name: 'Rhode Island', country: 'US' },
  SC: { name: 'South Carolina', country: 'US' },
  SD: { name: 'South Dakota', country: 'US' },
  TN: { name: 'Tennessee', country: 'US' },
  TX: { name: 'Texas', country: 'US' },
  UT: { name: 'Utah', country: 'US' },
  VT: { name: 'Vermont', country: 'US' },
  VA: { name: 'Virginia', country: 'US' },
  WA: { name: 'Washington', country: 'US' },
  WV: { name: 'West Virginia', country: 'US' },
  WI: { name: 'Wisconsin', country: 'US' },
  WY: { name: 'Wyoming', country: 'US' },
  DC: { name: 'District of Columbia', country: 'US' },
  // Canadian Provinces
  AB: { name: 'Alberta', country: 'CA' },
  BC: { name: 'British Columbia', country: 'CA' },
  MB: { name: 'Manitoba', country: 'CA' },
  NB: { name: 'New Brunswick', country: 'CA' },
  NL: { name: 'Newfoundland and Labrador', country: 'CA' },
  NS: { name: 'Nova Scotia', country: 'CA' },
  NT: { name: 'Northwest Territories', country: 'CA' },
  NU: { name: 'Nunavut', country: 'CA' },
  ON: { name: 'Ontario', country: 'CA' },
  PE: { name: 'Prince Edward Island', country: 'CA' },
  QC: { name: 'Quebec', country: 'CA' },
  SK: { name: 'Saskatchewan', country: 'CA' },
  YT: { name: 'Yukon', country: 'CA' },
} as const;

export type JurisdictionCode = keyof typeof IFTA_JURISDICTIONS;

export const US_STATES = Object.entries(IFTA_JURISDICTIONS)
  .filter(([_, v]) => v.country === 'US')
  .map(([code, v]) => ({ code, ...v }));

export const CA_PROVINCES = Object.entries(IFTA_JURISDICTIONS)
  .filter(([_, v]) => v.country === 'CA')
  .map(([code, v]) => ({ code, ...v }));

export function getJurisdictionName(code: string): string {
  const jurisdiction = IFTA_JURISDICTIONS[code as JurisdictionCode];
  return jurisdiction?.name ?? code;
}

export function isValidJurisdiction(code: string): code is JurisdictionCode {
  return code in IFTA_JURISDICTIONS;
}
