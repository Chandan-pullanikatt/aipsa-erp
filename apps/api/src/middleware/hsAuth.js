// Auth for the home-schooling product, against its OWN database (hsPrisma).
// Home-schooling tokens carry { accountId, kind: 'HS' } so they can never be
// confused with ERP tokens. Sets req.account for downstream handlers.
const { verifyToken } = require('../lib/jwt');
const hsPrisma = require('../lib/hsPrisma');

async function hsAuthenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = verifyToken(token);
    if (payload.kind !== 'HS' || !payload.accountId) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const account = await hsPrisma.hsAccount.findUnique({
      where: { id: payload.accountId },
      select: { id: true, email: true, parentFirstName: true, parentLastName: true },
    });
    if (!account) return res.status(401).json({ error: 'Account not found' });
    req.account = account;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { hsAuthenticate };
