const prisma = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');

// seatLayout shape: { rows: number, cols: number, categories: [{ name, rowLabels: ["A","B"] }] }
// Example: a 10-row theatre where rows A-C are Premium and D-J are Standard.
async function createVenue(req, res, next) {
  try {
    const { name, address, seatLayout } = req.body;
    if (!name || !address || !seatLayout) throw new ApiError(400, 'name, address and seatLayout are required');
    if (!seatLayout.rows || !seatLayout.cols || !Array.isArray(seatLayout.categories)) {
      throw new ApiError(400, 'seatLayout must include rows, cols and a categories array');
    }
    const venue = await prisma.venue.create({ data: { name, address, seatLayout } });
    res.status(201).json(venue);
  } catch (err) {
    next(err);
  }
}

async function listVenues(req, res, next) {
  try {
    const venues = await prisma.venue.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(venues);
  } catch (err) {
    next(err);
  }
}

async function getVenue(req, res, next) {
  try {
    const venue = await prisma.venue.findUnique({ where: { id: req.params.id } });
    if (!venue) throw new ApiError(404, 'Venue not found');
    res.json(venue);
  } catch (err) {
    next(err);
  }
}

module.exports = { createVenue, listVenues, getVenue };
