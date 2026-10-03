const TripPlan = require('../models/tripPlan');

// Helper to call Google Gemini / Generative API
async function generateWithGemini(prompt) {
  const model = process.env.GEMINI_MODEL || 'text-bison-001';
  const apiKey = process.env.GEMINI_API_KEY;
  const baseUrl = `https://generative.googleapis.com/v1beta2/models/${model}:generateText`;

  // If no key provided, return a simple mocked itinerary for local testing
  if (!apiKey) {
    const days = 3;
    const itinerary = { itinerary: [] };
    for (let i = 1; i <= days; i++) {
      itinerary.itinerary.push({ day: i, activities: [`Sample activity ${i}`] });
    }
    itinerary.attractions = ['Sample Museum', 'Scenic Viewpoint'];
    itinerary.food = ['Local Bistro', 'Street Food Market'];
    itinerary.estimatedDailyBudget = 50;
    itinerary.travelTips = ['Carry water', 'Book tickets in advance'];
    return JSON.stringify(itinerary, null, 2);
  }

  const url = apiKey.startsWith('AIza') ? `${baseUrl}?key=${apiKey}` : baseUrl;
  const headers = { 'Content-Type': 'application/json' };
  if (!apiKey.startsWith('AIza')) headers['Authorization'] = `Bearer ${apiKey}`;

  const body = {
    prompt: { text: prompt },
    temperature: 0.2,
    maxOutputTokens: 800
  };

  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await resp.json();

  // text-bison returns candidates[0].output
  const text = (data?.candidates && data.candidates[0] && data.candidates[0].output) || JSON.stringify(data);
  return text;
}

function buildPrompt({ destination, budget, days, travelType }) {
  return `You are an expert travel planner. Given the input below, produce a JSON object with the following keys: itinerary (array of day objects with day number and activities), attractions (array), food (array), estimatedDailyBudget (number), travelTips (array). Respond ONLY with valid JSON, no extra commentary.\n\nInput:\nDestination: ${destination}\nBudget (total in local currency): ${budget}\nDays: ${days}\nTravel Type: ${travelType}\n\nOutput example:\n{\n  "itinerary": [{"day":1,"activities":["..."]},...],\n  "attractions": ["..."],\n  "food": ["..."],\n  "estimatedDailyBudget": 100,\n  "travelTips": ["..."]\n}`;
}

module.exports.showForm = async (req, res, next) => {
  try {
    res.render('ai/planner', { plan: null, generatedText: null });
  } catch (err) {
    next(err);
  }
};

module.exports.createPlan = async (req, res, next) => {
  try {
    const { destination, budget, days, travelType } = req.body;
    if (!destination || !budget || !days || !travelType) {
      req.flash('error', 'All fields are required');
      return res.redirect('/ai-planner');
    }

    const prompt = buildPrompt({ destination, budget, days, travelType });
    const aiText = await generateWithGemini(prompt);

    let parsed = null;
    try {
      parsed = JSON.parse(aiText);
    } catch (e) {
      // If model didn't return strict JSON, store raw text
      parsed = { raw: aiText };
    }

    const tripPlan = new TripPlan({
      user: req.user ? req.user._id : null,
      destination,
      budget: Number(budget),
      days: Number(days),
      travelType,
      itinerary: parsed
    });

    await tripPlan.save();

    res.render('ai/planner', { plan: tripPlan, generatedText: aiText });
  } catch (err) {
    next(err);
  }
};
