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
  const { brandName, websiteURL } = req.body;

  if (!websiteURL) {
    return res.status(400).json({ error: 'Missing website URL' });
  }

  try {
    // Fetch website HTML
    const response = await axios.get(websiteURL);
    const $ = cheerio.load(response.data);

    // Basic scrape
    const title = $('title').text() || '';
    const meta = $('meta[name="description"]').attr('content') || '';
    const h1 = $('h1').first().text() || '';
    const image = $('img').first().attr('src') || '';

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

    // Call OpenAI
    const openaiRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    }, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const result = openaiRes.data.choices[0].message.content;
    res.json({ audit: result });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Audit failed. Check URL or try again later.' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
