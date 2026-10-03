const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiPlanner');

router.get('/', aiController.showForm);
router.post('/', aiController.createPlan);

module.exports = router;
