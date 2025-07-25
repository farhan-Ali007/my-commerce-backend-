const Redirect = require('../models/redirect');

exports.getRedirectsByTo = async (req, res) => {
  try {
    const { to } = req.query;
    if (!to) return res.status(400).json({ message: 'Missing to parameter' });
    const redirects = await Redirect.find({ to });
    res.status(200).json({ redirects });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};
