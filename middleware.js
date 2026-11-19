const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

const role = (allowed) => (req, res, next) =>
  allowed.includes(req.user?.role) ? next() : res.status(403).json({ message: 'Forbidden' });

const verifyCustomer = role(['customer']);
const verifyTechnician = role(['technician']);
const verifyAdmin = role(['admin']);

module.exports = { verifyToken, verifyCustomer, verifyTechnician, verifyAdmin };
