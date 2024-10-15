const {signup, login, getUsers, makeAdmin} = require('../controller/auth');
const express = require('express');
const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get('/users', getUsers);           
router.put('/users/:userId/admin', makeAdmin); 

module.exports = router;

