/**
 * WanderStay Countries & Location Resolution Data
 * Maintained mapping for countries, ISO codes, currencies, languages, and cities.
 */

const COUNTRIES_LIST = [
  { name: 'India', code: 'IN', currency: 'INR', defaultLang: 'en' },
  { name: 'United States', code: 'US', currency: 'USD', defaultLang: 'en' },
  { name: 'United Kingdom', code: 'GB', currency: 'GBP', defaultLang: 'en' },
  { name: 'France', code: 'FR', currency: 'EUR', defaultLang: 'en' },
  { name: 'Germany', code: 'DE', currency: 'EUR', defaultLang: 'en' },
  { name: 'Italy', code: 'IT', currency: 'EUR', defaultLang: 'en' },
  { name: 'Japan', code: 'JP', currency: 'JPY', defaultLang: 'en' },
  { name: 'United Arab Emirates', code: 'AE', currency: 'AED', defaultLang: 'en' },
  { name: 'Switzerland', code: 'CH', currency: 'CHF', defaultLang: 'en' },
  { name: 'Canada', code: 'CA', currency: 'CAD', defaultLang: 'en' },
  { name: 'Australia', code: 'AU', currency: 'AUD', defaultLang: 'en' },
  { name: 'Indonesia', code: 'ID', currency: 'IDR', defaultLang: 'en' },
  { name: 'Thailand', code: 'TH', currency: 'THB', defaultLang: 'en' },
  { name: 'Mexico', code: 'MX', currency: 'MXN', defaultLang: 'en' },
  { name: 'Spain', code: 'ES', currency: 'EUR', defaultLang: 'en' },
  { name: 'Netherlands', code: 'NL', currency: 'EUR', defaultLang: 'en' },
  { name: 'Greece', code: 'GR', currency: 'EUR', defaultLang: 'en' },
  { name: 'Portugal', code: 'PT', currency: 'EUR', defaultLang: 'en' },
  { name: 'Austria', code: 'AT', currency: 'EUR', defaultLang: 'en' },
  { name: 'Belgium', code: 'BE', currency: 'EUR', defaultLang: 'en' },
  { name: 'Ireland', code: 'IE', currency: 'EUR', defaultLang: 'en' },
  { name: 'Singapore', code: 'SG', currency: 'USD', defaultLang: 'en' },
  { name: 'New Zealand', code: 'NZ', currency: 'AUD', defaultLang: 'en' },
  { name: 'Tanzania', code: 'TZ', currency: 'USD', defaultLang: 'en' },
  { name: 'Fiji', code: 'FJ', currency: 'USD', defaultLang: 'en' },
  { name: 'Saudi Arabia', code: 'SA', currency: 'AED', defaultLang: 'en' },
  { name: 'South Africa', code: 'ZA', currency: 'USD', defaultLang: 'en' },
  { name: 'Sweden', code: 'SE', currency: 'EUR', defaultLang: 'en' },
  { name: 'Norway', code: 'NO', currency: 'EUR', defaultLang: 'en' },
  { name: 'Denmark', code: 'DK', currency: 'EUR', defaultLang: 'en' },
  { name: 'Finland', code: 'FI', currency: 'EUR', defaultLang: 'en' },
  { name: 'Poland', code: 'PL', currency: 'EUR', defaultLang: 'en' },
  { name: 'Turkey', code: 'TR', currency: 'EUR', defaultLang: 'en' },
  { name: 'Malaysia', code: 'MY', currency: 'USD', defaultLang: 'en' },
  { name: 'Philippines', code: 'PH', currency: 'USD', defaultLang: 'en' },
  { name: 'Vietnam', code: 'VN', currency: 'USD', defaultLang: 'en' },
  { name: 'South Korea', code: 'KR', currency: 'USD', defaultLang: 'en' },
  { name: 'Brazil', code: 'BR', currency: 'USD', defaultLang: 'en' },
  { name: 'Argentina', code: 'AR', currency: 'USD', defaultLang: 'en' },
  { name: 'Chile', code: 'CL', currency: 'USD', defaultLang: 'en' },
  { name: 'Colombia', code: 'CO', currency: 'USD', defaultLang: 'en' },
  { name: 'Egypt', code: 'EG', currency: 'USD', defaultLang: 'en' },
  { name: 'Czech Republic', code: 'CZ', currency: 'EUR', defaultLang: 'en' },
  { name: 'Hungary', code: 'HU', currency: 'EUR', defaultLang: 'en' },
  { name: 'Iceland', code: 'IS', currency: 'EUR', defaultLang: 'en' },
  { name: 'Croatia', code: 'HR', currency: 'EUR', defaultLang: 'en' },
  { name: 'Maldives', code: 'MV', currency: 'USD', defaultLang: 'en' },
  { name: 'Sri Lanka', code: 'LK', currency: 'INR', defaultLang: 'en' },
  { name: 'Nepal', code: 'NP', currency: 'INR', defaultLang: 'en' },
  { name: 'Bhutan', code: 'BT', currency: 'INR', defaultLang: 'en' }
];

// ISO Code to Currency
const CODE_TO_CURRENCY = {};
// Country Name (lowercase) to Currency
const NAME_TO_CURRENCY = {};
// Country Name (lowercase) to Canonical Name
const NAME_TO_CANONICAL = {};
// Code to Canonical Name
const CODE_TO_CANONICAL = {};

COUNTRIES_LIST.forEach(item => {
  CODE_TO_CURRENCY[item.code.toUpperCase()] = item.currency;
  NAME_TO_CURRENCY[item.name.toLowerCase()] = item.currency;
  NAME_TO_CANONICAL[item.name.toLowerCase()] = item.name;
  CODE_TO_CANONICAL[item.code.toUpperCase()] = item.name;
});

// Synonyms / common variations
NAME_TO_CURRENCY['usa'] = 'USD';
NAME_TO_CANONICAL['usa'] = 'United States';
NAME_TO_CURRENCY['uk'] = 'GBP';
NAME_TO_CANONICAL['uk'] = 'United Kingdom';
NAME_TO_CURRENCY['great britain'] = 'GBP';
NAME_TO_CANONICAL['great britain'] = 'United Kingdom';
NAME_TO_CURRENCY['england'] = 'GBP';
NAME_TO_CANONICAL['england'] = 'United Kingdom';
NAME_TO_CURRENCY['scotland'] = 'GBP';
NAME_TO_CANONICAL['scotland'] = 'United Kingdom';
NAME_TO_CURRENCY['uae'] = 'AED';
NAME_TO_CANONICAL['uae'] = 'United Arab Emirates';
NAME_TO_CURRENCY['dubai'] = 'AED';
NAME_TO_CANONICAL['dubai'] = 'United Arab Emirates';
NAME_TO_CURRENCY['bali'] = 'IDR';
NAME_TO_CANONICAL['bali'] = 'Indonesia';
NAME_TO_CURRENCY['holland'] = 'EUR';
NAME_TO_CANONICAL['holland'] = 'Netherlands';
NAME_TO_CURRENCY['swiss'] = 'CHF';
NAME_TO_CANONICAL['swiss'] = 'Switzerland';

// Maintained city/region to country mapping for search queries
const CITY_TO_COUNTRY_MAP = {
  // India
  goa: 'India',
  manali: 'India',
  kashmir: 'India',
  mumbai: 'India',
  delhi: 'India',
  'new delhi': 'India',
  bengaluru: 'India',
  bangalore: 'India',
  jaipur: 'India',
  kerala: 'India',
  udaipur: 'India',
  agra: 'India',
  varanasi: 'India',
  rishikesh: 'India',
  shimla: 'India',
  pune: 'India',
  lonavala: 'India',
  ooty: 'India',
  darjeeling: 'India',
  munnar: 'India',
  alleppey: 'India',
  ladakh: 'India',

  // France
  paris: 'France',
  nice: 'France',
  lyon: 'France',
  marseille: 'France',
  bordeaux: 'France',
  cannes: 'France',
  strasbourg: 'France',

  // United Kingdom
  london: 'United Kingdom',
  manchester: 'United Kingdom',
  edinburgh: 'United Kingdom',
  oxford: 'United Kingdom',
  cambridge: 'United Kingdom',
  bath: 'United Kingdom',
  liverpool: 'United Kingdom',
  birmingham: 'United Kingdom',

  // Japan
  tokyo: 'Japan',
  kyoto: 'Japan',
  osaka: 'Japan',
  sapporo: 'Japan',
  hiroshima: 'Japan',
  fukuoka: 'Japan',
  yokohama: 'Japan',

  // United States
  'new york': 'United States',
  'new york city': 'United States',
  nyc: 'United States',
  'los angeles': 'United States',
  la: 'United States',
  malibu: 'United States',
  aspen: 'United States',
  portland: 'United States',
  'lake tahoe': 'United States',
  tahoe: 'United States',
  miami: 'United States',
  'san francisco': 'United States',
  sf: 'United States',
  chicago: 'United States',
  'las vegas': 'United States',
  vegas: 'United States',
  hawaii: 'United States',
  orlando: 'United States',
  seattle: 'United States',
  boston: 'United States',
  austin: 'United States',
  denver: 'United States',

  // Italy
  rome: 'Italy',
  florence: 'Italy',
  venice: 'Italy',
  milan: 'Italy',
  tuscany: 'Italy',
  amalfi: 'Italy',
  'amalfi coast': 'Italy',
  naples: 'Italy',
  'lake como': 'Italy',
  como: 'Italy',
  sicily: 'Italy',

  // United Arab Emirates
  dubai: 'United Arab Emirates',
  'abu dhabi': 'United Arab Emirates',
  sharjah: 'United Arab Emirates',

  // Indonesia
  bali: 'Indonesia',
  jakarta: 'Indonesia',
  ubud: 'Indonesia',
  seminyak: 'Indonesia',
  canggu: 'Indonesia',
  lombok: 'Indonesia',

  // Switzerland
  'swiss alps': 'Switzerland',
  verbier: 'Switzerland',
  zermatt: 'Switzerland',
  zurich: 'Switzerland',
  geneva: 'Switzerland',
  lucerne: 'Switzerland',
  interlaken: 'Switzerland',
  matterhorn: 'Switzerland',

  // Netherlands
  amsterdam: 'Netherlands',
  rotterdam: 'Netherlands',
  'the hague': 'Netherlands',

  // Mexico
  cancun: 'Mexico',
  'mexico city': 'Mexico',
  tulum: 'Mexico',
  'playa del carmen': 'Mexico',
  cabo: 'Mexico',

  // Canada
  toronto: 'Canada',
  vancouver: 'Canada',
  montreal: 'Canada',
  banff: 'Canada',
  whistler: 'Canada',

  // Australia
  sydney: 'Australia',
  melbourne: 'Australia',
  brisbane: 'Australia',
  'gold coast': 'Australia',
  perth: 'Australia',

  // Thailand
  bangkok: 'Thailand',
  phuket: 'Thailand',
  'chiang mai': 'Thailand',
  'koh samui': 'Thailand',
  pattaya: 'Thailand',
  krabi: 'Thailand',

  // Germany
  berlin: 'Germany',
  munich: 'Germany',
  frankfurt: 'Germany',
  hamburg: 'Germany',

  // Spain
  barcelona: 'Spain',
  madrid: 'Spain',
  seville: 'Spain',
  ibiza: 'Spain',
  mallorca: 'Spain',

  // Greece
  santorini: 'Greece',
  mykonos: 'Greece',
  athens: 'Greece',
  crete: 'Greece',

  // Tanzania
  serengeti: 'Tanzania',
  'serengeti national park': 'Tanzania',
  zanzibar: 'Tanzania',
  kilimanjaro: 'Tanzania',

  // Fiji
  nadi: 'Fiji',
  suva: 'Fiji'
};

/**
 * Resolves a search query or location text to a country name.
 * @param {string} text - e.g. "Paris", "Goa", "Tokyo", "France", "Malibu, United States"
 * @returns {string|null} Canonical country name or null if unknown
 */
function resolveDestinationCountry(text) {
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();

  // 1. Exact match on country name
  if (NAME_TO_CANONICAL[lower]) {
    return NAME_TO_CANONICAL[lower];
  }

  // 2. Exact match on 2-letter ISO country code
  const upperCode = raw.toUpperCase();
  if (raw.length === 2 && CODE_TO_CANONICAL[upperCode]) {
    return CODE_TO_CANONICAL[upperCode];
  }

  // 3. Exact match on known city/destination
  if (CITY_TO_COUNTRY_MAP[lower]) {
    return CITY_TO_COUNTRY_MAP[lower];
  }

  // 4. Comma-separated check (e.g. "Malibu, United States" or "Paris, France")
  if (raw.includes(',')) {
    const parts = raw.split(',').map(p => p.trim());
    for (let i = parts.length - 1; i >= 0; i--) {
      const partLower = parts[i].toLowerCase();
      if (NAME_TO_CANONICAL[partLower]) return NAME_TO_CANONICAL[partLower];
      if (parts[i].length === 2 && CODE_TO_CANONICAL[parts[i].toUpperCase()]) {
        return CODE_TO_CANONICAL[parts[i].toUpperCase()];
      }
      if (CITY_TO_COUNTRY_MAP[partLower]) return CITY_TO_COUNTRY_MAP[partLower];
    }
  }

  // 5. Word-boundary token check for known cities or countries
  // e.g. "Stays in Paris", "Hotels in Tokyo"
  for (const [city, country] of Object.entries(CITY_TO_COUNTRY_MAP)) {
    const regex = new RegExp(`\\b${city}\\b`, 'i');
    if (regex.test(lower)) {
      return country;
    }
  }

  for (const [name, canonical] of Object.entries(NAME_TO_CANONICAL)) {
    if (name.length > 2) {
      const regex = new RegExp(`\\b${name}\\b`, 'i');
      if (regex.test(lower)) {
        return canonical;
      }
    }
  }

  return null;
}

/**
 * Returns the primary currency code for a given country name or ISO code.
 * @param {string} countryOrCode
 * @returns {string} e.g. 'EUR', 'INR', 'USD', 'GBP', 'JPY'
 */
function getCurrencyForCountry(countryOrCode) {
  if (!countryOrCode || typeof countryOrCode !== 'string') return 'INR';
  const clean = countryOrCode.trim();
  if (!clean) return 'INR';

  // Check ISO code
  if (clean.length === 2) {
    const codeCurrency = CODE_TO_CURRENCY[clean.toUpperCase()];
    if (codeCurrency) return codeCurrency;
  }

  // Check country name
  const nameCurrency = NAME_TO_CURRENCY[clean.toLowerCase()];
  if (nameCurrency) return nameCurrency;

  // Check destination city mapping
  const cityCountry = CITY_TO_COUNTRY_MAP[clean.toLowerCase()];
  if (cityCountry) {
    const cityCurr = NAME_TO_CURRENCY[cityCountry.toLowerCase()];
    if (cityCurr) return cityCurr;
  }

  return 'INR';
}

/**
 * Resolves visitor country and currency from headers (Cloudflare, proxy, Accept-Language)
 * @param {Object} req - Express request
 * @returns {{ country: string, countryCode: string, currency: string }}
 */
function detectVisitorCountryAndCurrency(req) {
  if (!req) return { country: 'India', countryCode: 'IN', currency: 'INR' };

  // 1. Check CDN Geo-IP headers (Cloudflare / Render / AWS)
  const headerCountry = (req.headers['cf-ipcountry'] || req.headers['x-country-code'] || '').toString().trim().toUpperCase();
  if (headerCountry && headerCountry.length === 2 && headerCountry !== 'XX' && headerCountry !== 'T1') {
    const canonical = CODE_TO_CANONICAL[headerCountry] || 'India';
    const currency = CODE_TO_CURRENCY[headerCountry] || 'INR';
    return { country: canonical, countryCode: headerCountry, currency };
  }

  // 2. Parse Accept-Language header
  const acceptLang = (req.headers && req.headers['accept-language']) ? req.headers['accept-language'].toLowerCase() : '';
  if (acceptLang) {
    if (acceptLang.includes('en-us')) {
      return { country: 'United States', countryCode: 'US', currency: 'USD' };
    }
    if (acceptLang.includes('en-gb')) {
      return { country: 'United Kingdom', countryCode: 'GB', currency: 'GBP' };
    }
    if (acceptLang.includes('ja') || acceptLang.includes('ja-jp')) {
      return { country: 'Japan', countryCode: 'JP', currency: 'JPY' };
    }
    if (acceptLang.includes('fr-fr') || acceptLang.includes('fr')) {
      return { country: 'France', countryCode: 'FR', currency: 'EUR' };
    }
    if (acceptLang.includes('de-de') || acceptLang.includes('de')) {
      return { country: 'Germany', countryCode: 'DE', currency: 'EUR' };
    }
    if (acceptLang.includes('it-it') || acceptLang.includes('it')) {
      return { country: 'Italy', countryCode: 'IT', currency: 'EUR' };
    }
    if (acceptLang.includes('es-es') || acceptLang.includes('es')) {
      return { country: 'Spain', countryCode: 'ES', currency: 'EUR' };
    }
    if (acceptLang.includes('en-ca')) {
      return { country: 'Canada', countryCode: 'CA', currency: 'CAD' };
    }
    if (acceptLang.includes('en-au')) {
      return { country: 'Australia', countryCode: 'AU', currency: 'AUD' };
    }
    if (acceptLang.includes('hi') || acceptLang.includes('mr') || acceptLang.includes('en-in')) {
      return { country: 'India', countryCode: 'IN', currency: 'INR' };
    }
  }

  // Default fallback: India
  return { country: 'India', countryCode: 'IN', currency: 'INR' };
}

module.exports = {
  COUNTRIES_LIST,
  CODE_TO_CURRENCY,
  NAME_TO_CURRENCY,
  CITY_TO_COUNTRY_MAP,
  resolveDestinationCountry,
  getCurrencyForCountry,
  detectVisitorCountryAndCurrency
};
