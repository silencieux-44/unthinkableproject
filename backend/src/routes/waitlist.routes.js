const express = require('express');
const { join, getOffer, claimOffer } = require('../controllers/waitlist.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.post('/join', requireAuth, join);
router.get('/offer/:token', getOffer);
router.post('/offer/:token/claim', requireAuth, claimOffer);

module.exports = router;
