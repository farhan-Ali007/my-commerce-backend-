const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { isAuthorized, isAdmin } = require('../middlewares/auth');
const { uploadImage } = require('../config/cloudinary');

// POST /api/v1/media/upload
router.post('/upload', isAuthorized, isAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const type = req.body.type || 'page-media';
    const result = await uploadImage(req.file, type);
    return res.status(200).json(result); // { url, public_id }
  } catch (err) {
    console.error('media upload error', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

module.exports = router;
