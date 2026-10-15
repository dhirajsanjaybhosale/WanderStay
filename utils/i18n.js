const path = require('path');
const fs = require('fs');

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
  { code: 'hi', label: 'हिंदी', short: 'हिंदी', flag: '🇮🇳' },
  { code: 'mr', label: 'मराठी', short: 'मराठी', flag: '🇮🇳' }
];

const DEFAULT_LANGUAGE = 'en';

// Load localization files synchronously on module boot
const translations = {};
SUPPORTED_LANGUAGES.forEach(lang => {
  const filePath = path.join(__dirname, '..', 'locales', `${lang.code}.json`);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    translations[lang.code] = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ Failed to load locale file for ${lang.code}:`, err.message);
    translations[lang.code] = {};
  }
});

/**
 * Translates a dot-notated key with optional variable replacement
 * @param {string} lang - 'en' | 'hi' | 'mr'
 * @param {string} key - e.g. 'nav.explore'
 * @param {Object} [params] - interpolation variables
 * @returns {string} translated string
 */
function translate(lang, key, params = {}) {
  const targetLang = (translations[lang]) ? lang : DEFAULT_LANGUAGE;
  
  function getNested(obj, pathStr) {
    if (!obj || typeof obj !== 'object') return undefined;
    const parts = pathStr.split('.');
    let cur = obj;
    for (const part of parts) {
      if (cur === undefined || cur === null) return undefined;
      cur = cur[part];
    }
    return cur;
  }

  // 1. Try requested language
  let text = getNested(translations[targetLang], key);

  // 2. Fallback to English
  if (text === undefined && targetLang !== DEFAULT_LANGUAGE) {
    text = getNested(translations[DEFAULT_LANGUAGE], key);
  }

  // 3. Fallback to key itself
  if (text === undefined) {
    return key;
  }

  // Parameter interpolation: {name} or %{name}
  if (params && typeof params === 'object') {
    Object.keys(params).forEach(k => {
      const val = params[k];
      text = text.replace(new RegExp(`%?\\{${k}\\}`, 'g'), val);
    });
  }

  return text;
}

/**
 * Express middleware to detect, persist, and expose i18n
 */
function i18nMiddleware(req, res, next) {
  let lang = DEFAULT_LANGUAGE;

  // 1. Check query parameter ?lang=
  if (req.query && req.query.lang && SUPPORTED_LANGUAGES.some(l => l.code === req.query.lang)) {
    lang = req.query.lang;
    // Persist to session and cookie
    if (req.session) req.session.lang = lang;
    res.cookie('wanderstay_lang', lang, { maxAge: 365 * 24 * 60 * 60 * 1000, path: '/' });
  }
  // 2. Check session
  else if (req.session && req.session.lang && SUPPORTED_LANGUAGES.some(l => l.code === req.session.lang)) {
    lang = req.session.lang;
  }
  // 3. Check persistent cookie
  else if (req.cookies && req.cookies.wanderstay_lang && SUPPORTED_LANGUAGES.some(l => l.code === req.cookies.wanderstay_lang)) {
    lang = req.cookies.wanderstay_lang;
  }
  // 4. Check authenticated user's saved preference
  else if (req.user && req.user.preferredLanguage && SUPPORTED_LANGUAGES.some(l => l.code === req.user.preferredLanguage)) {
    lang = req.user.preferredLanguage;
  }

  // Attach to request
  req.lang = lang;
  req.t = (key, params) => translate(lang, key, params);

  // Expose to all EJS templates
  res.locals.currentLang = lang;
  res.locals.t = (key, params) => translate(lang, key, params);
  res.locals.supportedLanguages = SUPPORTED_LANGUAGES;
  res.locals.getLanguageMeta = (code) => SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0];

  next();
}

/**
 * Controller handler to switch language
 */
async function setLanguageHandler(req, res) {
  const targetLang = (req.body && req.body.lang) || (req.query && req.query.lang) || DEFAULT_LANGUAGE;
  const User = require('../models/user');

  if (SUPPORTED_LANGUAGES.some(l => l.code === targetLang)) {
    // 1. Persist in cookie (1 year duration)
    res.cookie('wanderstay_lang', targetLang, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    // 2. Persist in session
    if (req.session) {
      req.session.lang = targetLang;
    }

    // 3. Persist in database if logged in
    if (req.user && req.user._id) {
      try {
        await User.findByIdAndUpdate(req.user._id, { preferredLanguage: targetLang });
        req.user.preferredLanguage = targetLang;
      } catch (err) {
        console.error('Error saving user preferred language:', err.message);
      }
    }
  }

  // Handle AJAX JSON requests
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.json({ success: true, lang: targetLang });
  }

  // Redirect back safely
  const returnUrl = (req.body && req.body.returnUrl) || (req.query && req.query.returnUrl) || req.get('Referrer') || '/';
  // Avoid redirection loops to /set-language
  const safeUrl = returnUrl.includes('/set-language') ? '/' : returnUrl;
  return res.redirect(safeUrl);
}

module.exports = {
  translate,
  t: translate,
  i18nMiddleware,
  setLanguageHandler,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
};
