const TripPlan = require('../models/tripPlan');
const Listing = require('../models/listing');

/**
 * Robust Google Gemini API caller
 * Uses existing GEMINI_API_KEY and GEMINI_MODEL configuration if set.
 * Never exposes API keys.
 */
async function generateWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  
  // Try modern generateContent endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
      responseMimeType: "application/json"
    }
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.warn(`⚠️ Gemini API returned status ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const textPart = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return textPart || null;
  } catch (err) {
    console.warn("⚠️ Gemini API error or timeout, falling back to smart itinerary engine:", err.message);
    return null;
  }
}

/**
 * Generates an intelligent, destination-tailored, multi-day itinerary
 * matching user destination, travel style, duration, group size, and interests.
 */
function generateTailoredPlan({ destination, days, travelStyle, travelers, budget, interests, startDate, endDate }) {
  const destName = destination.trim();
  const numDays = Math.max(1, Math.min(14, Number(days) || 3));
  const numTravelers = Math.max(1, Number(travelers) || 2);
  const totalBudget = Math.max(1000, Number(budget) || 25000);
  const style = travelStyle || 'Adventure';
  const interestList = Array.isArray(interests) && interests.length > 0 ? interests : ['Nature', 'Food', 'Culture'];

  // Calculate budget breakdown
  const stayEst = Math.round(totalBudget * 0.45);
  const foodEst = Math.round(totalBudget * 0.25);
  const actEst = Math.round(totalBudget * 0.15);
  const transEst = Math.round(totalBudget * 0.10);
  const bufferEst = totalBudget - (stayEst + foodEst + actEst + transEst);

  // Curated activity pools by travel style & interests
  const styleThemes = {
    Adventure: {
      morningAction: `Early morning outdoor trek or scenic bike tour across ${destName}'s most picturesque ridgelines.`,
      afternoonAction: `Adrenaline-packed guided exploration: water-sports, off-road excursion, or zip-lining through natural canopy.`,
      eveningAction: `Campfire or terrace gathering at a panoramic viewpoint, celebrating the day's thrills under the stars.`
    },
    Luxury: {
      morningAction: `Champagne breakfast or artisanal cafe tasting, followed by a private chauffeured tour of ${destName}'s premier spots.`,
      afternoonAction: `Exclusive private yacht charter, luxury wellness spa session, or curated boutique shopping experience.`,
      eveningAction: `Candlelit fine dining at a celebrated award-winning restaurant with sommelier wine pairings.`
    },
    Budget: {
      morningAction: `Self-guided walking heritage tour exploring local hidden alleys, historic clock towers, and scenic parks.`,
      afternoonAction: `Discover free community art centers, public lookout terraces, and scenic photography viewpoints.`,
      eveningAction: `Immerse in the bustling energy of ${destName}'s famous night street food bazaar with affordable regional delicacies.`
    },
    Family: {
      morningAction: `Family-friendly discovery tour: interactive nature exhibits, animal sanctuaries, or calm scenic bays.`,
      afternoonAction: `Picnic in spacious botanical gardens followed by kid-friendly interactive workshops and safe boat rides.`,
      eveningAction: `Relaxed family dinner at a spacious garden restaurant followed by artisanal ice cream and a sunset promenade.`
    },
    Couples: {
      morningAction: `Peaceful sunrise stroll along secluded viewpoints followed by coffee at an intimate hillside cafe.`,
      afternoonAction: `Private couple's spa session, scenic vineyard tour, or quiet catamaran cruise along the shoreline.`,
      eveningAction: `Romantic rooftop candlelight dinner overlooking the glittering lights of ${destName}.`
    },
    Nature: {
      morningAction: `Dawn birdwatching and guided botanical hike through lush forest reserves and misty valleys.`,
      afternoonAction: `Visit tranquil waterfalls, natural springs, and protected conservation reserves with a local naturalist.`,
      eveningAction: `Golden hour landscape photography at an elevated lookout followed by farm-to-table organic dining.`
    },
    Food: {
      morningAction: `Guided morning spice and artisan bakery crawl, sampling hot freshly prepared regional breakfast favorites.`,
      afternoonAction: `Hands-on culinary masterclass with a master home-chef learning secret spice blends and heritage recipes.`,
      eveningAction: `Multi-stop evening street food and dessert safari exploring ${destName}'s most iconic foodie alleys.`
    },
    History: {
      morningAction: `In-depth exploration of ${destName}'s ancient forts, royal palaces, and landmark archaeological ruins.`,
      afternoonAction: `Curated museum district visit and walk through well-preserved colonial or historic old quarters.`,
      eveningAction: `Classical cultural performance, sound & light historic show, followed by dinner at a restored heritage haveli.`
    }
  };

  const currentTheme = styleThemes[style] || styleThemes.Adventure;

  // Build Day by Day Itinerary with Morning / Afternoon / Evening
  const itinerary = [];
  for (let d = 1; d <= numDays; d++) {
    let dayTitle = '';
    let mAct = '';
    let mHigh = '';
    let aAct = '';
    let aHigh = '';
    let eAct = '';
    let eHigh = '';

    if (d === 1) {
      dayTitle = `Arrival, Orientation & Historic Heart of ${destName}`;
      mAct = `Check into your stay, unpack and take an easy morning walk around the central square or historic district.`;
      mHigh = `First glimpses of ${destName}'s signature architecture`;
      aAct = `Visit the primary landmark or iconic cultural hub, getting a feel for the local rhythm and vibrant atmosphere.`;
      aHigh = `Iconic landmark exploration & photo session`;
      eAct = `Enjoy a welcome dinner savoring signature dishes, followed by an evening stroll along the illuminated promenade.`;
      eHigh = `Panoramic sunset viewpoint & welcome feast`;
    } else if (d === 2) {
      dayTitle = `Deep Dive into ${interestList[0] || style} & Scenic Wonders`;
      mAct = currentTheme.morningAction;
      mHigh = `Misty morning views & fresh local roast coffee`;
      aAct = currentTheme.afternoonAction;
      aHigh = `Highlight experience tailored for ${style} enthusiasts`;
      eAct = currentTheme.eveningAction;
      eHigh = `Atmospheric evening dinner with local music`;
    } else if (d === 3) {
      dayTitle = `Local Culture, Hidden Gems & Artisan Markets`;
      mAct = `Explore off-the-beaten-path neighborhoods, artisan studios, and quaint handicraft bazaars.`;
      mHigh = `Meeting local artisans and discovering handmade treasures`;
      aAct = `Relax at a scenic cafe, visit a secluded viewpoint or join an interactive local experience (${interestList[1] || 'Culture'}).`;
      aHigh = `Hidden scenic overlook far away from crowds`;
      eAct = `Sunset dinner at a renowned local eatery, celebrating regional ingredients and culinary heritage.`;
      eHigh = `Golden hour vistas & craft beverages`;
    } else if (d === numDays) {
      dayTitle = `Farewell Escapade & Lasting Memories of ${destName}`;
      mAct = `Sunrise photo walk and relaxed final breakfast at your favorite corner cafe.`;
      mHigh = `Final panoramic photo opportunities`;
      aAct = `Pick up authentic local spices, souvenirs, and gifts from traditional markets.`;
      aHigh = `Artisanal market shopping & souvenir collection`;
      eAct = `Unwind with a memorable celebratory farewell dinner reminiscing over the trip's best moments.`;
      eHigh = `Celebratory grand dinner under the night sky`;
    } else {
      dayTitle = `Excursion to Surrounding Countryside & Coastal Serenity`;
      mAct = `Day trip to scenic outskirts of ${destName}, discovering serene trails or neighboring tranquil hamlets.`;
      mHigh = `Breathtaking valley views and fresh breeze`;
      aAct = `Outdoor picnic lunch surrounded by pristine nature, followed by leisure exploration.`;
      aHigh = `Authentic countryside hospitality & tranquility`;
      eAct = `Return for an easygoing evening dining by the waterfront or rooftop lounge.`;
      eHigh = `Stargazing and relaxing terrace conversations`;
    }

    itinerary.push({
      day: d,
      title: dayTitle,
      morning: {
        time: '08:30 AM – 12:00 PM',
        activity: mAct,
        highlight: mHigh
      },
      afternoon: {
        time: '12:30 PM – 04:30 PM',
        activity: aAct,
        highlight: aHigh
      },
      evening: {
        time: '05:00 PM – 09:30 PM',
        activity: eAct,
        highlight: eHigh
      }
    });
  }

  // Curated Attractions
  const attractions = [
    {
      name: `${destName} Old Town & Heritage Quarter`,
      category: 'Historic / Culture',
      description: `Wander through ancient cobblestone pathways, historic arches, and century-old landmarks rich with local stories.`
    },
    {
      name: `${destName} Grand Scenic Vista Lookout`,
      category: 'Scenic Viewpoint',
      description: `Offers an awe-inspiring 360-degree panoramic view of the entire valley and surrounding horizon.`
    },
    {
      name: `${destName} Artisan & Craft Bazaar`,
      category: 'Culture & Shopping',
      description: `Vibrant marketplace celebrated for authentic handmade textiles, local crafts, and fragrant spices.`
    },
    {
      name: `${destName} Waterfront / Valley Promenade`,
      category: 'Leisure & Nature',
      description: `Idyllic walkway perfect for evening strolls, catching spectacular sunset hues, and relaxing by the water.`
    }
  ];

  // Curated Activities
  const activities = [
    {
      name: `Signature ${style} Discovery Trail`,
      type: `${style} Experience`,
      tip: `Book morning slots early to experience crisp air and golden photography light without lines.`
    },
    {
      name: `Heritage Architectural Walk`,
      type: `Cultural Insight`,
      tip: `Engage with local guides who share fascinating folklore passed down across generations.`
    },
    {
      name: `Sunset Boat Cruise or Lookout Trek`,
      type: `Sightseeing & Leisure`,
      tip: `Arrive 30 minutes before twilight to secure the best seats for the golden-hour transition.`
    }
  ];

  // Food suggestions
  const food = [
    {
      meal: 'Breakfast',
      dish: 'Freshly baked regional pastries, local roast coffee, and warm heritage breakfast bowls',
      spot: 'Artisan Cafe Quarter & Historic Bakeries'
    },
    {
      meal: 'Lunch',
      dish: 'Authentic regional thali or fresh catch platter prepared with organic local herbs',
      spot: 'Garden Bistros & Traditional Family Eateries'
    },
    {
      meal: 'Dinner',
      dish: 'Slow-cooked signature curries or wood-fired flatbreads paired with botanical beverages',
      spot: 'Rooftop Terrace & Fine Heritage Courtyards'
    },
    {
      meal: 'Street Food',
      dish: 'Hot crispy savory fritters, sweet artisan delicacies, and spiced chai',
      spot: 'Evening Night Bazaar & Central Market Lanes'
    }
  ];

  // Travel Tips
  const travelTips = [
    `Best Transit: Mix local tuk-tuks/cabs for longer legs with leisurely walks in the central quarter.`,
    `Optimal Timing: Start your mornings by 8:30 AM to beat midday warmth and enjoy peaceful sightseeing.`,
    `Currency & Payments: Carry a modest amount of cash for local street vendors and artisan stalls; digital UPI/cards work for stays.`,
    `Packing Essentials: Breathable layers, sturdy walking shoes, SPF protection, and a lightweight rain shell.`,
    `Respect Local Customs: Dress respectfully when visiting religious monuments and sacred historic sites.`
  ];

  return {
    summary: `A bespoke ${numDays}-day ${style.toLowerCase()} itinerary for ${numTravelers} traveler${numTravelers > 1 ? 's' : ''} in ${destName}, balanced across ${interestList.join(', ')} with hand-selected dining and sightseeing highlights.`,
    itinerary,
    attractions,
    activities,
    food,
    budgetBreakdown: {
      stayEstimate: stayEst,
      foodAndDining: foodEst,
      activitiesAndTickets: actEst,
      localTransport: transEst,
      buffer: bufferEst,
      total: totalBudget
    },
    travelTips
  };
}

/**
 * Builds Gemini Prompt requesting clean JSON
 */
function buildGeminiPrompt({ destination, budget, days, travelStyle, travelers, interests, startDate, endDate }) {
  return `You are WanderStay's expert travel concierge.
Create a structured vacation itinerary in strict JSON format for:
- Destination: ${destination}
- Duration: ${days} days
- Group Size: ${travelers} travelers
- Total Budget: INR ${budget}
- Travel Style: ${travelStyle}
- Interests: ${(interests || []).join(', ')}
${startDate && endDate ? `- Dates: ${startDate} to ${endDate}` : ''}

Respond with ONLY valid JSON (no markdown formatting, no commentary) matching this schema:
{
  "summary": "String",
  "itinerary": [
    {
      "day": 1,
      "title": "String",
      "morning": { "time": "08:30 AM - 12:00 PM", "activity": "String", "highlight": "String" },
      "afternoon": { "time": "12:30 PM - 04:30 PM", "activity": "String", "highlight": "String" },
      "evening": { "time": "05:00 PM - 09:30 PM", "activity": "String", "highlight": "String" }
    }
  ],
  "attractions": [
    { "name": "String", "category": "String", "description": "String" }
  ],
  "activities": [
    { "name": "String", "type": "String", "tip": "String" }
  ],
  "food": [
    { "meal": "String", "dish": "String", "spot": "String" }
  ],
  "budgetBreakdown": {
    "stayEstimate": 10000,
    "foodAndDining": 5000,
    "activitiesAndTickets": 3000,
    "localTransport": 2000,
    "buffer": 1000,
    "total": ${budget}
  },
  "travelTips": [
    "String"
  ]
}`;
}

// =======================
// CONTROLLER HANDLERS
// =======================

/**
 * Renders the AI Planner Form
 */
module.exports.showForm = async (req, res, next) => {
  try {
    let recentPlans = [];
    if (req.user) {
      recentPlans = await TripPlan.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(4);
    }

    // Default sample featured stays
    const featuredStays = await Listing.find({ isAvailable: true })
      .sort({ averageRating: -1 })
      .limit(3)
      .populate('owner');

    res.render('ai/planner', {
      plan: null,
      realListings: featuredStays,
      recentPlans,
      inputs: {
        destination: req.query.destination || '',
        travelStyle: req.query.style || 'Adventure',
        budget: req.query.budget || '',
        days: req.query.days || 3,
        travelers: req.query.travelers || 2,
        startDate: '',
        endDate: '',
        interests: []
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Generates and saves a new AI Itinerary
 */
module.exports.createPlan = async (req, res, next) => {
  try {
    let { destination, budget, days, travelStyle, travelers, interests, startDate, endDate } = req.body;

    if (!destination || !destination.trim()) {
      req.flash('error', 'Please provide a travel destination.');
      return res.redirect('/ai-planner');
    }

    // Process dates and calculate days if provided
    let numDays = Number(days) || 3;
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (!isNaN(s) && !isNaN(e) && e > s) {
        const diffDays = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
        if (diffDays >= 1 && diffDays <= 14) {
          numDays = diffDays;
        }
      }
    }
    numDays = Math.max(1, Math.min(14, numDays));

    const numTravelers = Math.max(1, Math.min(20, Number(travelers) || 2));
    const totalBudget = Math.max(1000, Number(budget) || (numDays * numTravelers * 4000));
    const selectedStyle = travelStyle || 'Adventure';

    // Normalize interests array
    let interestList = [];
    if (Array.isArray(interests)) {
      interestList = interests;
    } else if (typeof interests === 'string' && interests.trim()) {
      interestList = [interests.trim()];
    }

    // 1. Fetch Real Database WanderStay Listings matching Destination
    const searchRegex = new RegExp(destination.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    let realListings = await Listing.find({
      isAvailable: true,
      $or: [
        { location: searchRegex },
        { country: searchRegex },
        { title: searchRegex },
        { description: searchRegex }
      ]
    }).limit(4).populate('owner');

    // If fewer than 2 matched in destination, supplement with top WanderStay properties
    if (realListings.length < 2) {
      const topStays = await Listing.find({ isAvailable: true })
        .sort({ averageRating: -1, price: 1 })
        .limit(4 - realListings.length)
        .populate('owner');

      const existingIds = new Set(realListings.map(l => l._id.toString()));
      for (const stay of topStays) {
        if (!existingIds.has(stay._id.toString())) {
          realListings.push(stay);
        }
      }
    }

    // 2. Generate Plan using Gemini AI if configured, or smart built-in itinerary engine
    let structuredPlan = null;
    if (process.env.GEMINI_API_KEY) {
      const prompt = buildGeminiPrompt({
        destination,
        budget: totalBudget,
        days: numDays,
        travelStyle: selectedStyle,
        travelers: numTravelers,
        interests: interestList,
        startDate,
        endDate
      });

      const aiRawText = await generateWithGemini(prompt);
      if (aiRawText) {
        try {
          // Remove potential markdown code fences
          const cleaned = aiRawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          if (parsed && Array.isArray(parsed.itinerary) && parsed.itinerary.length > 0) {
            structuredPlan = parsed;
          }
        } catch (parseErr) {
          console.warn("⚠️ Could not parse raw Gemini response as JSON:", parseErr.message);
        }
      }
    }

    // Fallback to high-quality tailored itinerary generator
    if (!structuredPlan) {
      structuredPlan = generateTailoredPlan({
        destination,
        days: numDays,
        travelStyle: selectedStyle,
        travelers: numTravelers,
        budget: totalBudget,
        interests: interestList,
        startDate,
        endDate
      });
    }

    // 3. Save TripPlan to MongoDB
    const tripPlan = new TripPlan({
      user: req.user ? req.user._id : null,
      destination: destination.trim(),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      days: numDays,
      travelers: numTravelers,
      budget: totalBudget,
      travelStyle: selectedStyle,
      travelType: selectedStyle === 'Family' ? 'Family' : (numTravelers === 1 ? 'Solo' : (numTravelers === 2 ? 'Couple' : 'Friends')),
      interests: interestList,
      suggestedListings: realListings.map(l => l._id),
      itinerary: structuredPlan
    });

    await tripPlan.save();

    let recentPlans = [];
    if (req.user) {
      recentPlans = await TripPlan.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(4);
    }

    req.flash('success', `✨ AI Itinerary generated for ${destination}!`);
    res.render('ai/planner', {
      plan: tripPlan,
      realListings,
      recentPlans,
      inputs: {
        destination,
        budget: totalBudget,
        days: numDays,
        travelers: numTravelers,
        travelStyle: selectedStyle,
        startDate: startDate || '',
        endDate: endDate || '',
        interests: interestList
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * View a previously saved plan
 */
module.exports.viewPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const plan = await TripPlan.findById(id).populate({
      path: 'suggestedListings',
      populate: { path: 'owner' }
    });

    if (!plan) {
      req.flash('error', 'Trip plan not found.');
      return res.redirect('/ai-planner');
    }

    let realListings = plan.suggestedListings || [];
    if (realListings.length === 0) {
      realListings = await Listing.find({ isAvailable: true }).limit(3).populate('owner');
    }

    let recentPlans = [];
    if (req.user) {
      recentPlans = await TripPlan.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(4);
    }

    res.render('ai/planner', {
      plan,
      realListings,
      recentPlans,
      inputs: {
        destination: plan.destination,
        budget: plan.budget,
        days: plan.days,
        travelers: plan.travelers || 2,
        travelStyle: plan.travelStyle || 'Adventure',
        startDate: plan.startDate ? new Date(plan.startDate).toISOString().split('T')[0] : '',
        endDate: plan.endDate ? new Date(plan.endDate).toISOString().split('T')[0] : '',
        interests: plan.interests || []
      }
    });
  } catch (err) {
    next(err);
  }
};
