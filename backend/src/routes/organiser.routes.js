const express = require('express');
const { eventSummary, myEvents } = require('../controllers/organiser.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('ORGANISER', 'ADMIN'));
router.get('/events', myEvents);
router.get('/events/:eventId/summary', eventSummary);

module.exports = router;
