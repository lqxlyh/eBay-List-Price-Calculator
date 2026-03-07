const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function parseJsonFromText(text) {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/) || trimmed.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : trimmed;
  return JSON.parse(jsonStr);
}

async function callGemini(apiKey, parts, jsonMode = false) {
  const url = `${GEMINI_API_BASE}?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
      ...(jsonMode && { responseMimeType: 'application/json' }),
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from Gemini');
  return text;
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { imageBase64 } = body;
  if (!imageBase64) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Missing imageBase64' }),
    };
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

    const identificationPrompt = `You are an expert at identifying secondhand items from photos for resale. Analyze the image and respond with a JSON object only (no other text):
{
  "itemName": "clear, concise name of the item",
  "brand": "brand if visible, else null",
  "model": "model if visible, else null",
  "year": "year if identifiable, else null",
  "sellingPoints": ["point1", "point2", "point3"],
  "condition": "new | like new | lightly used | good | fair | poor"
}`;

    const identificationContent = await callGemini(apiKey, [
      { text: identificationPrompt },
      { inlineData: { mimeType, data: base64Data } },
    ], true);

    const identification = parseJsonFromText(identificationContent);

    const pricingPrompt = `Based on this identified item (North American二手 market, knowledge cutoff Dec 2024):
${JSON.stringify(identification, null, 2)}

Provide Facebook Marketplace pricing advice. Respond with a JSON object only:
{
  "fbPriceRange": "e.g. $80-120",
  "eBayAverage": "e.g. ~$100",
  "offerUpNote": "brief note on OfferUp/Craigslist local pricing",
  "quickSellPrice": { "amount": 85, "reason": "short reason" },
  "normalPrice": { "amount": 100, "reason": "short reason" },
  "maxPrice": { "amount": 120, "reason": "short reason" }
}
Use realistic USD amounts based on typical二手 prices.`;

    const pricingContent = await callGemini(apiKey, [{ text: pricingPrompt }], true);
    const pricing = parseJsonFromText(pricingContent);

    const normalAmount = pricing.normalPrice?.amount ?? pricing.quickSellPrice?.amount ?? 0;
    const descPrompt = `Based on this item:
${JSON.stringify(identification, null, 2)}

Suggested price: $${normalAmount}

Write a Facebook Marketplace listing. Style: casual, friendly, like a regular person selling to neighbors. NOT corporate, NOT pretentious, NOT wordy. 2-4 short sentences, 40-80 words. Include: what it is, condition, 1-2 highlights. End with a casual "message me if interested" line. Use 1-2 emojis max. Respond with a JSON object:
{
  "title": "short listing title, max 100 chars, e.g. 'Nintendo Switch + 3 games - Like New'",
  "description": "the casual description text"
}
Output JSON only.`;

    const descContent = await callGemini(apiKey, [{ text: descPrompt }], true);
    const listing = parseJsonFromText(descContent);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        identification,
        pricing,
        listing,
      }),
    };
  } catch (err) {
    console.error('resell-assistant error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: err.message || 'Processing failed',
      }),
    };
  }
};
