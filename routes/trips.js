const express = require('express');
const router = express.Router();
const trips = require('../controllers/trips');

router.get('/', trips.index);
router.get('/new', trips.newForm);
router.post('/', trips.createTrip);
router.get('/:id', trips.showTrip);
router.post('/:id/members', trips.addMember);
router.post('/:id/expenses', trips.addExpense);
router.post('/:id/vote', trips.vote);

module.exports = router;
