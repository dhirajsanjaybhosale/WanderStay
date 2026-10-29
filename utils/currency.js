/**
 * WanderStay Currency & Exchange Rate System
 * 
 * Manages automatic country-based currency determination, multi-currency display,
 * and reliable exchange rate conversions.
 * - BASE CURRENCY is strictly INR (₹) across listings, bookings, coupons, and payments.
 * - Payment gateway processes payments securely in the supported base currency (INR).
 * - Automatic destination-aware display currency:
 *   1. Destination search query -> local accommodation currency
 *   2. User saved currency preference
 *   3. User country of residence currency
 *   4. Anonymous visitor locale/country signal -> default INR
 */

const https = require('https');
const {
  resolveDestinationCountry,
  getCurrencyForCountry,
  detectVisitorCountryAndCurrency,
  COUNTRIES_LIST
} = require('./countries');

const BASE_CURRENCY = 'INR';
const BASE_SYMBOL = '₹';

const SUPPORTED_CURRENCIES = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    flag: '🇮🇳',
    locale: 'en-IN',
    decimalPlaces: 0
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    flag: '🇺🇸',
    locale: 'en-US',
    decimalPlaces: 2
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    flag: '🇪🇺',
    locale: 'de-DE',
    decimalPlaces: 2
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    flag: '🇬🇧',
    locale: 'en-GB',
    decimalPlaces: 2
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    flag: '🇯🇵',
    locale: 'ja-JP',
    decimalPlaces: 0
  },
  AED: {
    code: 'AED',
    symbol: 'AED ',
    name: 'UAE Dirham',
    flag: '🇦🇪',
    locale: 'en-AE',
    decimalPlaces: 2
  },
  CAD: {
    code: 'CAD',
    symbol: 'CA$',
    name: 'Canadian Dollar',
    flag: '🇨🇦',
    locale: 'en-CA',
    decimalPlaces: 2
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    flag: '🇦🇺',
    locale: 'en-AU',
    decimalPlaces: 2
  },
  CHF: {
    code: 'CHF',
    symbol: 'CHF ',
    name: 'Swiss Franc',
    flag: '🇨🇭',
    locale: 'de-CH',
    decimalPlaces: 2
  },
  IDR: {
    code: 'IDR',
    symbol: 'Rp ',
    name: 'Indonesian Rupiah',
    flag: '🇮🇩',
    locale: 'id-ID',
    decimalPlaces: 0
  },
  THB: {
    code: 'THB',
    symbol: '฿',
    name: 'Thai Baht',
    flag: '🇹🇭',
    locale: 'th-TH',
    decimalPlaces: 0
  },
  MXN: {
    code: 'MXN',
    symbol: 'MX$',
    name: 'Mexican Peso',
    flag: '🇲🇽',
    locale: 'es-MX',
    decimalPlaces: 2
  }
};

/**
 * Default fallback exchange rates (1 INR = X target currency)
 */
function getInitialConfiguredRates() {
  const defaults = {
    INR: 1.0,
    USD: 0.0116,
    EUR: 0.0108,
    GBP: 0.0092,
    JPY: 1.82,
    AED: 0.0425,
    CAD: 0.0162,
    AUD: 0.0180,
    CHF: 0.0105,
    IDR: 188.5,
    THB: 0.42,
    MXN: 0.23
  };

  // 1. Check custom JSON in environment
  if (process.env.EXCHANGE_RATES_JSON) {
    try {
      const parsed = JSON.parse(process.env.EXCHANGE_RATES_JSON);
      Object.assign(defaults, parsed);
    } catch (e) {
      console.warn("⚠️ Could not parse EXCHANGE_RATES_JSON:", e.message);
    }
  }

  // 2. Check individual environment overrides
  if (process.env.RATE_INR_TO_USD) defaults.USD = parseFloat(process.env.RATE_INR_TO_USD);
  if (process.env.RATE_INR_TO_EUR) defaults.EUR = parseFloat(process.env.RATE_INR_TO_EUR);
  if (process.env.RATE_INR_TO_GBP) defaults.GBP = parseFloat(process.env.RATE_INR_TO_GBP);
  if (process.env.RATE_INR_TO_JPY) defaults.JPY = parseFloat(process.env.RATE_INR_TO_JPY);
  if (process.env.RATE_INR_TO_AED) defaults.AED = parseFloat(process.env.RATE_INR_TO_AED);

  return defaults;
}

// In-memory exchange rate cache
let currentExchangeRates = getInitialConfiguredRates();
let lastRatesFetchTime = null;

/**
 * Refresh live rates in the background from a public exchange-rate API
 * Falls back safely to configured rates on any network or parsing error.
 */
function fetchLiveRatesIfAvailable() {
  if (process.env.DISABLE_LIVE_EXCHANGE_RATES === 'true') {
    return;
  }

  const apiUrl = process.env.EXCHANGE_RATE_API_URL || 'https://open.er-api.com/v6/latest/INR';

  try {
    const req = https.get(apiUrl, { timeout: 3500 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return;
      }

      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(rawData);
          const rates = data.rates || data.conversion_rates;
          if (rates) {
            for (const code of Object.keys(SUPPORTED_CURRENCIES)) {
              if (code !== 'INR' && rates[code]) {
                currentExchangeRates[code] = Number(rates[code]);
              }
            }
            currentExchangeRates.INR = 1.0;
            lastRatesFetchTime = new Date();
          }
        } catch (err) {
          // Keep cached/default rates
        }
      });
    });

    req.on('error', () => {
      // Graceful fallback to cached rates
    });
    req.on('timeout', () => {
      req.destroy();
    });
  } catch (err) {
    // Non-blocking
  }
}

// Initial background refresh attempt and periodic 6-hour refresh
fetchLiveRatesIfAvailable();
setInterval(fetchLiveRatesIfAvailable, 6 * 60 * 60 * 1000);

/**
 * Returns exchange rate relative to base INR
 */
function getExchangeRate(targetCurrency = 'INR') {
  const code = (targetCurrency || 'INR').toUpperCase();
  return currentExchangeRates[code] || 1.0;
}

/**
 * Converts an INR amount to target currency.
 */
function convertFromINR(amountInINR, targetCurrency = 'INR') {
  const num = Number(amountInINR) || 0;
  const code = (targetCurrency || 'INR').toUpperCase();
  if (code === 'INR') return num;
  const rate = getExchangeRate(code);
  return num * rate;
}

/**
 * Formats a given INR amount into the target currency string.
 */
function formatCurrency(amountInINR, targetCurrency = 'INR', options = {}) {
  const code = (targetCurrency || 'INR').toUpperCase();
  const config = SUPPORTED_CURRENCIES[code] || SUPPORTED_CURRENCIES.INR;
  const converted = convertFromINR(amountInINR, code);

  if (code === 'INR') {
    return `${config.symbol}${Math.round(converted).toLocaleString('en-IN')}`;
  }

  // Integer currencies (JPY, IDR) format with 0 decimals
  if (config.decimalPlaces === 0) {
    return `${config.symbol}${Math.round(converted).toLocaleString(config.locale || 'en-US')}`;
  }

  // Decimal currencies
  const isFractional = converted % 1 !== 0;
  const formattedNum = isFractional
    ? converted.toLocaleString(config.locale || 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(converted).toLocaleString(config.locale || 'en-US');

  return `${config.symbol}${formattedNum}`;
}

/**
 * Returns a comprehensive pricing display object for templates
 * that clearly distinguishes the converted displayed price from the actual payable amount.
 */
function getPriceDisplay(amountInINR, targetCurrency = 'INR') {
  const baseNum = Number(amountInINR) || 0;
  const code = (targetCurrency || 'INR').toUpperCase();
  const isConverted = code !== 'INR' && Boolean(SUPPORTED_CURRENCIES[code]);
  const config = SUPPORTED_CURRENCIES[code] || SUPPORTED_CURRENCIES.INR;
  const convertedNum = convertFromINR(baseNum, code);
  const formattedConverted = formatCurrency(baseNum, code);
  const formattedBase = `₹${Math.round(baseNum).toLocaleString('en-IN')}`;

  return {
    baseAmount: baseNum,
    baseCurrency: BASE_CURRENCY,
    baseSymbol: BASE_SYMBOL,
    formattedBase,
    targetCurrency: code,
    targetSymbol: config.symbol,
    targetAmount: convertedNum,
    formattedTarget: formattedConverted,
    isConverted,
    rate: getExchangeRate(code),
    payableNotice: isConverted 
      ? `Actual payment is processed securely as ${formattedBase} INR via Razorpay.` 
      : ''
  };
}

/**
 * Express Middleware:
 * Automatically resolves display currency based on 4-tier priority:
 * 1. Destination in another country -> that destination's local currency
 * 2. Signed-in user's saved currency preference
 * 3. Default currency inferred from user's country of residence
 * 4. Anonymous visitor locale/country signal -> default INR
 */
function currencyMiddleware(req, res, next) {
  let resolvedCurrency = null;
  let destinationCountry = null;

  // 1. Check if the current request is searching for a destination in another country
  const searchDest = (req.query?.destination || req.query?.country || req.query?.location || req.query?.q || '').toString().trim();
  if (searchDest) {
    destinationCountry = resolveDestinationCountry(searchDest);
    if (destinationCountry) {
      resolvedCurrency = getCurrencyForCountry(destinationCountry);
    }
  }

  // 2. If destination is unknown, check signed-in user's saved currency preference
  if (!resolvedCurrency && req.user && req.user.preferredCurrency) {
    const userPref = req.user.preferredCurrency.toUpperCase();
    if (SUPPORTED_CURRENCIES[userPref]) {
      resolvedCurrency = userPref;
    }
  }

  // 3. Infer default currency from user's country of residence
  if (!resolvedCurrency && req.user && (req.user.country || req.user.countryCode)) {
    const countryToUse = req.user.countryCode || req.user.country;
    resolvedCurrency = getCurrencyForCountry(countryToUse);
  }

  // 4. For anonymous visitors, use reliable locale/country signal
  if (!resolvedCurrency) {
    // Check cached session or cookie first to avoid repeated parsing
    if (req.session && req.session.currency && SUPPORTED_CURRENCIES[req.session.currency]) {
      resolvedCurrency = req.session.currency;
    } else if (req.cookies && req.cookies.wanderstay_currency && SUPPORTED_CURRENCIES[req.cookies.wanderstay_currency.toUpperCase()]) {
      resolvedCurrency = req.cookies.wanderstay_currency.toUpperCase();
    } else {
      const visitor = detectVisitorCountryAndCurrency(req);
      resolvedCurrency = visitor.currency || BASE_CURRENCY;
      if (req.session) {
        req.session.currency = resolvedCurrency;
        req.session.visitorCountry = visitor.country;
        req.session.visitorCountryCode = visitor.countryCode;
      }
    }
  }

  // Fallback to INR if anything is invalid
  if (!resolvedCurrency || !SUPPORTED_CURRENCIES[resolvedCurrency]) {
    resolvedCurrency = BASE_CURRENCY;
  }

  // Attach to req & res.locals
  req.currency = resolvedCurrency;
  req.destinationCountry = destinationCountry;

  res.locals.currentCurrency = resolvedCurrency;
  res.locals.currentCurrencyConfig = SUPPORTED_CURRENCIES[resolvedCurrency];
  res.locals.supportedCurrencies = SUPPORTED_CURRENCIES;
  res.locals.baseCurrency = BASE_CURRENCY;
  res.locals.baseSymbol = BASE_SYMBOL;

  // Template helper functions
  res.locals.formatCurrency = (amt, customCurr) => formatCurrency(amt, customCurr || resolvedCurrency);
  res.locals.convertCurrency = (amt, customCurr) => convertFromINR(amt, customCurr || resolvedCurrency);
  res.locals.getPriceDisplay = (amt, customCurr) => getPriceDisplay(amt, customCurr || resolvedCurrency);
  res.locals.exchangeRates = currentExchangeRates;
  res.locals.getCurrencyForCountry = getCurrencyForCountry;
  res.locals.resolveDestinationCountry = resolveDestinationCountry;

  next();
}

/**
 * Route handler to set currency preference and redirect back safely.
 */
async function setCurrencyHandler(req, res) {
  const chosenCurrency = (req.body?.currency || req.query?.currency || req.query?.curr || 'INR').toString().toUpperCase();
  const validCurrency = SUPPORTED_CURRENCIES[chosenCurrency] ? chosenCurrency : BASE_CURRENCY;

  // Set persistent cookie
  res.cookie('wanderstay_currency', validCurrency, {
    maxAge: 365 * 24 * 60 * 60 * 1000,
    httpOnly: false,
    sameSite: 'lax'
  });

  // Update session
  if (req.session) {
    req.session.currency = validCurrency;
  }

  // Update database record if authenticated
  if (req.user && req.user._id) {
    try {
      const User = require('../models/user');
      await User.findByIdAndUpdate(req.user._id, { preferredCurrency: validCurrency });
      req.user.preferredCurrency = validCurrency;
    } catch (err) {
      console.error("Error saving user preferredCurrency:", err.message);
    }
  }

  // Determine redirect URL safely
  const returnUrl = req.body?.returnUrl || req.query?.returnUrl || req.get('Referrer') || '/';
  const safeRedirect = returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/';
  return res.redirect(safeRedirect);
}

module.exports = {
  BASE_CURRENCY,
  BASE_SYMBOL,
  SUPPORTED_CURRENCIES,
  getExchangeRate,
  convertFromINR,
  formatCurrency,
  getPriceDisplay,
  currencyMiddleware,
  setCurrencyHandler,
  resolveDestinationCountry,
  getCurrencyForCountry
};
