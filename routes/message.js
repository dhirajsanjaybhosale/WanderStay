const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync');
const { isLoggedIn } = require('../middleware');
const messagesController = require('../controllers/messages');

router.get('/', isLoggedIn, wrapAsync(messagesController.index));
router.get('/new', isLoggedIn, wrapAsync(messagesController.initiateContact));
router.post('/start', isLoggedIn, wrapAsync(messagesController.startConversation));
router.get('/:id', isLoggedIn, wrapAsync(messagesController.index));
router.post('/:id', isLoggedIn, wrapAsync(messagesController.sendMessage));

module.exports = router;
