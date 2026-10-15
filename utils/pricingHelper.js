/**
 * WanderStay Dynamic Pricing Engine
 * Calculates predictable, secure nightly and extra-guest pricing on the backend.
 * Never trusts client-provided totals.
 */

/**
 * Sanitizes host-submitted pricing configuration
 * @param {Object} rawPricing
 * @returns {Object} clean pricing object
 */
function sanitizePricing(rawPricing) {
  if (!rawPricing || typeof rawPricing !== 'object') {
    return {
      weekendPrice: null,
      baseGuests: 2,
      extraGuestFee: 0,
      seasonalPricing: [],
      holidayPricing: []
    };
  }

  const weekendPrice = (rawPricing.weekendPrice !== '' && rawPricing.weekendPrice !== null && !isNaN(rawPricing.weekendPrice) && Number(rawPricing.weekendPrice) > 0)
    ? Number(rawPricing.weekendPrice)
    : null;

  const baseGuests = (rawPricing.baseGuests !== '' && rawPricing.baseGuests !== null && !isNaN(rawPricing.baseGuests) && Number(rawPricing.baseGuests) >= 1)
    ? Math.max(1, parseInt(rawPricing.baseGuests, 10))
    : 2;

  const extraGuestFee = (rawPricing.extraGuestFee !== '' && rawPricing.extraGuestFee !== null && !isNaN(rawPricing.extraGuestFee) && Number(rawPricing.extraGuestFee) >= 0)
    ? Number(rawPricing.extraGuestFee)
    : 0;

  // Process seasonal pricing periods
  let seasonalPricing = [];
  const rawSeasonal = Array.isArray(rawPricing.seasonalPricing)
    ? rawPricing.seasonalPricing
    : (rawPricing.seasonalPricing && typeof rawPricing.seasonalPricing === 'object' ? Object.values(rawPricing.seasonalPricing) : []);

  if (rawSeasonal.length > 0) {
    seasonalPricing = rawSeasonal
      .filter(s => s && s.startDate && s.endDate && !isNaN(s.price) && Number(s.price) > 0)
      .map(s => ({
        name: (s.name || '').trim() || 'Seasonal Rate',
        startDate: new Date(s.startDate),
        endDate: new Date(s.endDate),
        price: Number(s.price)
      }))
      .filter(s => s.endDate >= s.startDate);
  }

  // Process holiday pricing periods
  let holidayPricing = [];
  const rawHoliday = Array.isArray(rawPricing.holidayPricing)
    ? rawPricing.holidayPricing
    : (rawPricing.holidayPricing && typeof rawPricing.holidayPricing === 'object' ? Object.values(rawPricing.holidayPricing) : []);

  if (rawHoliday.length > 0) {
    holidayPricing = rawHoliday
      .filter(h => h && h.startDate && h.endDate && !isNaN(h.price) && Number(h.price) > 0)
      .map(h => ({
        name: (h.name || '').trim() || 'Holiday Rate',
        startDate: new Date(h.startDate),
        endDate: new Date(h.endDate),
        price: Number(h.price)
      }))
      .filter(h => h.endDate >= h.startDate);
  }

  return {
    weekendPrice,
    baseGuests,
    extraGuestFee,
    seasonalPricing,
    holidayPricing
  };
}

/**
 * Calculates predictable, secure nightly and extra-guest pricing on the backend.
 *
 * @param {Object} params
 * @param {Object} params.listing
 * @param {Date|string} params.checkIn
 * @param {Date|string} params.checkOut
 * @param {number} [params.guests=1]
 * @returns {Object} itemized price breakdown and final totals
 */
function calculateListingPricing({ listing, checkIn, checkOut, guests = 1 }) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  checkInDate.setHours(0, 0, 0, 0);
  checkOutDate.setHours(0, 0, 0, 0);

  const nights = Math.max(1, Math.round((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));
  const numGuests = Math.max(1, parseInt(guests, 10) || 1);
  const baseRate = Number(listing.price) || 0;
  const pricing = listing.pricing || {};

  const weekendPrice = (pricing.weekendPrice !== null && pricing.weekendPrice !== undefined && Number(pricing.weekendPrice) > 0)
    ? Number(pricing.weekendPrice)
    : null;

  const seasonalRules = (pricing.seasonalPricing || []).filter(s => s && s.startDate && s.endDate && Number(s.price) > 0);
  const holidayRules = (pricing.holidayPricing || []).filter(h => h && h.startDate && h.endDate && Number(h.price) > 0);

  const baseGuests = (pricing.baseGuests && Number(pricing.baseGuests) >= 1)
    ? Number(pricing.baseGuests)
    : (listing.guests && Number(listing.guests) >= 1 ? Number(listing.guests) : 2);

  const extraGuestFeePerNight = (pricing.extraGuestFee !== null && pricing.extraGuestFee !== undefined && Number(pricing.extraGuestFee) > 0)
    ? Number(pricing.extraGuestFee)
    : 0;

  const nightlyDetails = [];
  let weekdayNights = 0;
  let weekdayTotal = 0;

  let weekendNights = 0;
  let weekendTotal = 0;

  let seasonalNights = 0;
  let seasonalTotal = 0;
  const seasonalNames = new Set();

  let holidayNights = 0;
  let holidayTotal = 0;
  const holidayNames = new Set();

  let roomSubtotal = 0;

  // Day-by-day (night-by-night) iteration
  for (let i = 0; i < nights; i++) {
    const curNight = new Date(checkInDate.getTime() + i * 24 * 60 * 60 * 1000);
    curNight.setHours(12, 0, 0, 0); // midday for safe date boundary matching
    const dayOfWeek = curNight.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat

    // 1. Check Holiday rules (highest priority for special dates)
    const activeHoliday = holidayRules.find(h => {
      const hStart = new Date(h.startDate);
      hStart.setHours(0, 0, 0, 0);
      const hEnd = new Date(h.endDate);
      hEnd.setHours(23, 59, 59, 999);
      return curNight >= hStart && curNight <= hEnd;
    });

    if (activeHoliday) {
      const rate = Number(activeHoliday.price);
      holidayNights++;
      holidayTotal += rate;
      roomSubtotal += rate;
      if (activeHoliday.name) holidayNames.add(activeHoliday.name);

      nightlyDetails.push({
        date: new Date(curNight),
        rate,
        type: 'holiday',
        label: activeHoliday.name || 'Holiday Rate'
      });
      continue;
    }

    // 2. Check Seasonal rules
    const activeSeason = seasonalRules.find(s => {
      const sStart = new Date(s.startDate);
      sStart.setHours(0, 0, 0, 0);
      const sEnd = new Date(s.endDate);
      sEnd.setHours(23, 59, 59, 999);
      return curNight >= sStart && curNight <= sEnd;
    });

    if (activeSeason) {
      const rate = Number(activeSeason.price);
      seasonalNights++;
      seasonalTotal += rate;
      roomSubtotal += rate;
      if (activeSeason.name) seasonalNames.add(activeSeason.name);

      nightlyDetails.push({
        date: new Date(curNight),
        rate,
        type: 'seasonal',
        label: activeSeason.name || 'Seasonal Rate'
      });
      continue;
    }

    // 3. Check Weekend price (universal Friday & Saturday nights)
    const isWeekendNight = (dayOfWeek === 5 || dayOfWeek === 6);
    if (isWeekendNight && weekendPrice !== null) {
      const rate = weekendPrice;
      weekendNights++;
      weekendTotal += rate;
      roomSubtotal += rate;

      nightlyDetails.push({
        date: new Date(curNight),
        rate,
        type: 'weekend',
        label: 'Weekend Rate'
      });
      continue;
    }

    // 4. Default Base / Weekday Rate
    const rate = baseRate;
    weekdayNights++;
    weekdayTotal += rate;
    roomSubtotal += rate;

    nightlyDetails.push({
      date: new Date(curNight),
      rate,
      type: 'weekday',
      label: 'Standard Weekday Rate'
    });
  }

  // 5. Extra Guest Fee
  const extraGuests = Math.max(0, numGuests - baseGuests);
  const extraGuestTotal = extraGuests * extraGuestFeePerNight * nights;

  // 6. Fixed fees
  const cleaningFee = 500;
  const serviceFee = 750;
  const totalPrice = roomSubtotal + extraGuestTotal + cleaningFee + serviceFee;
  const averageNightlyRate = Math.round(roomSubtotal / nights);

  // Check if any dynamic pricing applied
  const isDynamicPricingActive = (
    (weekendPrice !== null && weekendNights > 0) ||
    seasonalNights > 0 ||
    holidayNights > 0 ||
    extraGuestTotal > 0
  );

  return {
    nights,
    numGuests,
    baseRate,
    averageNightlyRate,
    isDynamicPricingActive,
    roomSubtotal,

    weekdayNights,
    weekdayRate: baseRate,
    weekdayTotal,

    weekendNights,
    weekendRate: weekendPrice || baseRate,
    weekendTotal,

    seasonalNights,
    seasonalRate: seasonalNights > 0 ? Math.round(seasonalTotal / seasonalNights) : 0,
    seasonalTotal,
    seasonalName: Array.from(seasonalNames).join(', ') || 'Seasonal Rate',

    holidayNights,
    holidayRate: holidayNights > 0 ? Math.round(holidayTotal / holidayNights) : 0,
    holidayTotal,
    holidayName: Array.from(holidayNames).join(', ') || 'Holiday Rate',

    baseGuests,
    extraGuests,
    extraGuestFeePerNight,
    extraGuestTotal,

    cleaningFee,
    serviceFee,
    totalPrice,

    nightlyDetails
  };
}

module.exports = {
  calculateListingPricing,
  sanitizePricing
};
