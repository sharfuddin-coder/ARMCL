const express = require('express');
const path = require('path');
const app = express();

// Serve the standalone dynamic Control Tower at the site root
app.use(express.static(path.join(__dirname, '..', 'sms-control-tower')));

// Mount the DWH API (Control Tower panels P6/P5/P9/P10/P11)
const tower = require('../sms-tower');
app.use(tower);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'sms-control-tower', 'index.html'));
});

module.exports = app;
