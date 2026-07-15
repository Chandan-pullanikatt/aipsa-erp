const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');

// Home-Schooling catalog admin. The catalog now lives in the standalone
// Home-Schooling service (its own repo + database) — the ERP no longer touches
// the HS database. AIPSA staff still manage the catalog from this super-admin
// panel; this route authorizes SUPER_ADMIN (the ERP is the identity authority)
// and forwards the request to the HS service with the shared admin token.
const router = Router();
router.use(authenticate, authorize('SUPER_ADMIN'));

function hsBase() {
  return (process.env.HS_API_URL || 'http://localhost:5099/api').replace(/\/$/, '');
}

// Catch-all: proxy every method/subpath under /api/hs-catalog to the HS service.
router.use(async (req, res) => {
  const adminToken = process.env.HS_ADMIN_TOKEN;
  if (!adminToken) {
    return res.status(503).json({ error: 'Home-Schooling catalog admin is not configured (HS_ADMIN_TOKEN unset)' });
  }

  // req.url is the path (with query) after the /api/hs-catalog mount.
  const target = `${hsBase()}/hs-catalog${req.url}`;
  const headers = { 'x-admin-token': adminToken };
  let body;
  if (!['GET', 'HEAD'].includes(req.method)) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(req.body ?? {});
  }

  try {
    const apiRes = await fetch(target, { method: req.method, headers, body });
    const text = await apiRes.text();
    const contentType = apiRes.headers.get('content-type');
    if (contentType) res.set('content-type', contentType);
    res.status(apiRes.status).send(text);
  } catch (err) {
    console.error('HS catalog proxy failed:', target, err);
    res.status(503).json({ error: 'Home-Schooling service unavailable' });
  }
});

module.exports = router;
