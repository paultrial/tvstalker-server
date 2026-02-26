const express = require('express');
// const subs = require('../lib/opensubtitles');
const subs = require('opensubtitles-client').api,
const router = express.Router();

router.post('/', async (req, res) => {
  let token;
  try {
    const { name, language } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Missing name' });

    token = await subs.login();

    const results = await subs.searchForTitle(token, language || 'rum', name);
    return res.json(results || []);
  } catch (err) {
    console.error(err);
    if (!token) return res.status(502).json({ error: 'Subtitle provider unavailable' });
    return res.status(500).json({ error: 'Subtitle search failed' });
  } finally {
    if (!token) return;
    try {
      await subs.logout(token);
    } catch (logoutErr) {
      console.warn('[opensubtitles] logout failed', logoutErr);
    }
  }
});

router.post('/subtitles', function (req, res) {
        subs.login().then(function (token) {
            subs.searchForTitle(token, 'rum', req.body.name).then(function (results) {
                subs.logout(token);
                res.send(results);
            });
        });
    });

module.exports = router;
