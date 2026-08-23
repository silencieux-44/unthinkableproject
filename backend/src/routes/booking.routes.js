const express = require('express');
const { hold, release, confirm, cancel, history } = require('../controllers/booking.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.post('/hold', hold);
router.post('/release', release);
router.post('/confirm', confirm);
router.post('/:id/cancel', cancel);
router.get('/history', history);

module.exports = router;
