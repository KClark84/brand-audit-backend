
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

app.post('/api/audit', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  global.ipHits = global.ipHits || {};
  const now = Date.now();
  global.ipHits[ip] = global.ipHits[ip] || [];
  global.ipHits[ip] = global.ipHits[ip].filter(ts => now - ts < 60000);
  global.ipHits[ip].push(now);
  if (global.ipHits[ip].length > 5) {
    return res.status(429).json({ error: "You're moving too fast. Please wait a minute." });
  }

  const { brandName, websiteURL, email } = req.body;
  console.log("Audit requested by:", email || "No email provided");


  if (!websiteURL) {
    return res.status(400).json({ error: 'Missing website URL' });
  }

  try {
    console.log("Scraping from:", websiteURL);

    const response = await axios.get(websiteURL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    const title = $('title').text() || 'No title found';
    const meta = $('meta[name="description"]').attr('content') || 'No meta description';
    const h1 = $('h1').first().text() || 'No H1 found';
    const image = $('img').first().attr('src') || 'No image found';

    console.log("Scraped:", { title, meta, h1, image });

    const prompt = `
Here is a brand’s basic website data:
- Brand Name: ${brandName}
- Title: ${title}
- H1: ${h1}
- Meta: ${meta}

Give a short but insightful brand audit with:
1. Brand Vibe
2. Design Feedback
3. Voice & Messaging
4. Suggestion for Improvement

Tone: Confident, helpful, slightly witty.
    `;

    console.log("Sending to OpenAI...");

    const openaiRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const result = openaiRes.data.choices[0].message.content;
    console.log("Audit Result:", result);

    res.json({ audit: result });

  } catch (error) {
    console.error("ERROR:", error.response?.data || error.message || error);
    res.status(500).json({ error: 'Audit failed. Check URL or try again later.' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
