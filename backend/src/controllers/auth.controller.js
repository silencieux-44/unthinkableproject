const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { signToken } = require('../utils/jwt');
const { ApiError } = require('../middleware/errorHandler');

async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) throw new ApiError(400, 'name, email and password are required');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, 'An account with this email already exists');

    // Only CUSTOMER/ORGANISER are self-serve; ADMIN accounts are provisioned manually (seed script).
    const allowedRole = ['CUSTOMER', 'ORGANISER'].includes(role) ? role : 'CUSTOMER';
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email, passwordHash, role: allowedRole } });

    const token = signToken({ id: user.id, role: user.role, email: user.email });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(401, 'Invalid email or password');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new ApiError(401, 'Invalid email or password');

    const token = signToken({ id: user.id, role: user.role, email: user.email });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me };
