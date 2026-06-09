const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const { upload } = require('../middleware/upload');
const { storage } = require('../lib/storage');

const router = Router();

// Any authenticated school user can upload (admins create ID-card photos, events,
// library covers; teachers attach event media). Returns { url, key } — the caller
// stores the url on the relevant record and keeps the key for later deletion.
router.post(
  '/',
  authenticate,
  authorize('SCHOOL_ADMIN', 'TEACHER'),
  requireTenant,
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file provided (field name: "file").' });
      const folder = `aipsa/${req.tenant.id}/${(req.body.folder || 'misc').replace(/[^a-z0-9/_-]/gi, '')}`;
      const resourceType = req.file.mimetype === 'application/pdf' ? 'raw' : 'image';
      const result = await storage.upload(req.file.buffer, {
        folder,
        resourceType,
        contentType: req.file.mimetype,
      });
      res.status(201).json(result);
    } catch (err) { next(err); }
  }
);

module.exports = router;
