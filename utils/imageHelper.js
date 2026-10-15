/**
 * WanderStay Image Optimization & Gallery Helper
 * Manages Cloudinary dynamic responsive transformations, deduplication, and graceful fallbacks.
 */

const FALLBACK_HERO_URL = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=85';
const FALLBACK_THUMB_URL = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=75';

/**
 * Optimizes an image URL for specific responsive contexts (thumbnail, hero, full screen)
 */
function optimizeImageUrl(url, preset = 'hero') {
  if (!url || typeof url !== 'string') return FALLBACK_HERO_URL;
  const cleanUrl = url.trim();

  // Cloudinary Optimization
  if (cleanUrl.includes('cloudinary.com') && cleanUrl.includes('/upload/')) {
    const transformationMap = {
      thumb: 'c_fill,w_360,h_240,q_auto,f_auto',
      card: 'c_fill,w_600,h_450,q_auto,f_auto',
      hero: 'c_fill,w_1200,h_750,q_auto,f_auto',
      full: 'w_1920,q_auto,f_auto'
    };
    const transform = transformationMap[preset] || transformationMap.hero;

    // Check if the transformation is already present
    if (cleanUrl.includes(`/upload/${transform}/`)) {
      return cleanUrl;
    }

    // If there is an existing transformation segment (starts with c_, w_, h_, q_, etc. and has comma or param), replace it
    const existingTransformRegex = /\/upload\/(?:[a-z0-9_,:]*(?:[cwhqfe]_[a-z0-9_]+|q_auto|f_auto)[a-z0-9_,:]*\/)/i;
    if (existingTransformRegex.test(cleanUrl)) {
      return cleanUrl.replace(existingTransformRegex, `/upload/${transform}/`);
    }

    // Otherwise, insert transform right after /upload/
    return cleanUrl.replace('/upload/', `/upload/${transform}/`);
  }

  // Unsplash Optimization
  if (cleanUrl.includes('images.unsplash.com')) {
    const baseUrl = cleanUrl.split('?')[0];
    if (preset === 'thumb') {
      return `${baseUrl}?auto=format&fit=crop&w=360&h=240&q=75`;
    } else if (preset === 'card') {
      return `${baseUrl}?auto=format&fit=crop&w=600&h=450&q=80`;
    } else if (preset === 'hero') {
      return `${baseUrl}?auto=format&fit=crop&w=1200&h=750&q=85`;
    } else if (preset === 'full') {
      return `${baseUrl}?auto=format&fit=crop&w=1920&q=90`;
    }
  }

  return cleanUrl;
}

/**
 * Collects and deduplicates all unique images from a listing object.
 * Returns an array of standardized image objects with optimized URLs.
 */
function getListingGallery(listing) {
  if (!listing) {
    return [{
      original: FALLBACK_HERO_URL,
      hero: FALLBACK_HERO_URL,
      thumb: FALLBACK_THUMB_URL,
      full: FALLBACK_HERO_URL
    }];
  }

  const rawUrls = [];
  const addUrl = (u) => {
    if (u && typeof u === 'string') {
      const trimmed = u.trim();
      if (trimmed && !rawUrls.includes(trimmed)) {
        rawUrls.push(trimmed);
      }
    }
  };

  // Primary image
  if (listing.image && listing.image.url) {
    addUrl(listing.image.url);
  }

  // Additional photos
  if (Array.isArray(listing.photos)) {
    listing.photos.forEach(p => {
      if (p && p.url) addUrl(p.url);
      else if (typeof p === 'string') addUrl(p);
    });
  }

  if (rawUrls.length === 0) {
    rawUrls.push(FALLBACK_HERO_URL);
  }

  return rawUrls.map(url => ({
    original: url,
    hero: optimizeImageUrl(url, 'hero'),
    thumb: optimizeImageUrl(url, 'thumb'),
    full: optimizeImageUrl(url, 'full')
  }));
}

module.exports = {
  FALLBACK_HERO_URL,
  FALLBACK_THUMB_URL,
  optimizeImageUrl,
  getListingGallery
};
