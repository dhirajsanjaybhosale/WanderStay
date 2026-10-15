/**
 * WanderStay Currency & Exchange Rate System
 * 
 * Manages currency preferences, multi-currency display, and reliable exchange rate conversions.
 * - BASE CURRENCY is strictly INR (₹) across listings, bookings, coupons, and payments.
 * - Displays converted prices in USD ($), EUR (€), and GBP (£).
 * - Supported currencies can be configured and updated via environment variables or live API.
 * - Preserves exact stored database pricing and processes all actual payments in the supported payment currency (INR).
 */

const https = require('https');

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
  }
};

/**
 * Default Exchange Rates (1 INR = X target currency)
 * Can be overridden via environment variables:
 * - EXCHANGE_RATES_JSON='{"USD":0.0116,"EUR":0.0108,"GBP":0.0092}'
 * - or individual: RATE_INR_TO_USD, RATE_INR_TO_EUR, RATE_INR_TO_GBP
 */
function getInitialConfiguredRates() {
  const defaults = {
    INR: 1.0,
    USD: 0.0116, // ~86.20 INR per USD
    EUR: 0.0108, // ~92.59 INR per EUR
    GBP: 0.0092  // ~108.70 INR per GBP
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

  return defaults;
}

// In-memory exchange rate cache
let currentExchangeRates = getInitialConfiguredRates();
let lastRatesFetchTime = null;

/**
 * Optionally refresh live rates from an exchange-rate provider if configured,
 * or from open public exchange rates. Falls back gracefully to configured rates.
 */
function fetchLiveRatesIfAvailable() {
  const apiUrl = process.env.EXCHANGE_RATE_API_URL || 'https://open.er-api.com/v6/latest/INR';
  
  if (process.env.DISABLE_LIVE_EXCHANGE_RATES === 'true') {
    return;
  }

  try {
    const req = https.get(apiUrl, { timeout: 3000 }, (res) => {
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
            if (rates.USD) currentExchangeRates.USD = Number(rates.USD);
            if (rates.EUR) currentExchangeRates.EUR = Number(rates.EUR);
            if (rates.GBP) currentExchangeRates.GBP = Number(rates.GBP);
            currentExchangeRates.INR = 1.0;
            lastRatesFetchTime = new Date();
          }
        } catch (err) {
          // Keep configured fallback rates
        }
      });
    });

    req.on('error', () => {
      // Graceful fallback to configured rates
    });
    req.on('timeout', () => {
      req.destroy();
    });
  } catch (err) {
    // Non-blocking
  }
}

// Initial background attempt and periodic 6-hour refresh
fetchLiveRatesIfAvailable();
setInterval(fetchLiveRatesIfAvailable, 6 * 60 * 60 * 1000);

/**
 * Returns the exchange rate for a given currency code relative to base INR.
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
 * Example:
 * formatCurrency(2500, 'INR') => "₹2,500"
 * formatCurrency(2500, 'USD') => "$29"
 * formatCurrency(2500, 'EUR') => "€27"
 */
function formatCurrency(amountInINR, targetCurrency = 'INR', options = {}) {
  const code = (targetCurrency || 'INR').toUpperCase();
  const config = SUPPORTED_CURRENCIES[code] || SUPPORTED_CURRENCIES.INR;
  const converted = convertFromINR(amountInINR, code);

  if (code === 'INR') {
    return `${config.symbol}${Math.round(converted).toLocaleString('en-IN')}`;
  }

  // For foreign currencies, format nicely (if exact integer or show 2 decimals if requested)
  const isFractional = converted % 1 !== 0;
  const formattedNum = isFractional
    ? converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(converted).toLocaleString('en-US');

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
 * Resolves user's currency preference (Query -> Cookie -> Session -> User profile -> Default INR).
 * Sets res.locals helpers for all EJS templates.
 */
function currencyMiddleware(req, res, next) {
  let selected = null;

  // 1. Query parameter override (?currency=USD or ?curr=USD)
  const queryCurr = (req.query.currency || req.query.curr || '').toString().toUpperCase();
  if (queryCurr && SUPPORTED_CURRENCIES[queryCurr]) {
    selected = queryCurr;
    // Persist to cookie and session
    res.cookie('wanderstay_currency', selected, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: 'lax'
    });
    if (req.session) {
      req.session.currency = selected;
    }
  }

  // 2. Persistent Cookie
  if (!selected && req.cookies && req.cookies.wanderstay_currency) {
    const cookieCurr = req.cookies.wanderstay_currency.toUpperCase();
    if (SUPPORTED_CURRENCIES[cookieCurr]) {
      selected = cookieCurr;
    }
  }

  // 3. Session
  if (!selected && req.session && req.session.currency) {
    const sessionCurr = req.session.currency.toUpperCase();
    if (SUPPORTED_CURRENCIES[sessionCurr]) {
      selected = sessionCurr;
    }
  }

  // 4. Authenticated user profile preference
  if (!selected && req.user && req.user.preferredCurrency) {
    const userCurr = req.user.preferredCurrency.toUpperCase();
    if (SUPPORTED_CURRENCIES[userCurr]) {
      selected = userCurr;
    }
  }

  // 5. Default fallback: INR
  if (!selected) {
    selected = BASE_CURRENCY;
  }

  // Attach to req & res.locals
  req.currency = selected;
  res.locals.currentCurrency = selected;
  res.locals.currentCurrencyConfig = SUPPORTED_CURRENCIES[selected];
  res.locals.supportedCurrencies = SUPPORTED_CURRENCIES;
  res.locals.baseCurrency = BASE_CURRENCY;
  res.locals.baseSymbol = BASE_SYMBOL;

  // Template helper functions
  res.locals.formatCurrency = (amt, customCurr) => formatCurrency(amt, customCurr || selected);
  res.locals.convertCurrency = (amt, customCurr) => convertFromINR(amt, customCurr || selected);
  res.locals.getPriceDisplay = (amt, customCurr) => getPriceDisplay(amt, customCurr || selected);
  res.locals.exchangeRates = currentExchangeRates;

  next();
}

/**
 * Route handler to set currency preference and redirect back safely.
 */
async function setCurrencyHandler(req, res) {
  const chosenCurrency = (req.body?.currency || req.query?.currency || req.query?.curr || 'INR').toString().toUpperCase();
  const validCurrency = SUPPORTED_CURRENCIES[chosenCurrency] ? chosenCurrency : BASE_CURRENCY;

  // Set 1-year persistent cookie
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
  // Avoid open redirects
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
  setCurrencyHandler
};
