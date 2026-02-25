const express = require('express');
const subs = require('opensubtitles-client').api;

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, language } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Missing name' });

    const token = await subs.login();
    const results = await subs.searchForTitle(token, language || 'rum', name);
    await subs.logout(token);

    return res.json(results || []);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Subtitle search failed' });
  }
});

module.exports = router;
