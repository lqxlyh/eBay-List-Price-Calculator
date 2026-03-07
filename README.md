# eBay List Price Calculator & FB Resell Assistant

## FB Resell Assistant (Netlify deploy)

1. Push to your repo and deploy on Netlify.
2. In Netlify: **Site settings → Environment variables** → Add:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** your Gemini API key (from [Google AI Studio](https://aistudio.google.com/apikey))
3. Redeploy after adding the variable.

The assistant uses Netlify Functions and Google Gemini API (free tier available).
