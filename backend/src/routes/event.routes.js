const express = require('express');
const { createEvent, listEvents, getEvent } = require('../controllers/event.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.get('/', listEvents);
router.get('/:id', getEvent);
router.post('/', requireAuth, requireRole('ORGANISER', 'ADMIN'), createEvent);

module.exports = router;
