function authRequired(req, res, next) {
  if (req.session && req.session.userId) {
    req.auth = { sub: req.session.userId, username: req.session.username };
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { authRequired };
