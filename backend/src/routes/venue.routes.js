const express = require('express');
const { createVenue, listVenues, getVenue } = require('../controllers/venue.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.get('/', listVenues);
router.get('/:id', getVenue);
router.post('/', requireAuth, requireRole('ADMIN'), createVenue);

module.exports = router;
