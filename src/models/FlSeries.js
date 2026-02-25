const mongoose = require('mongoose');

const FlSeriesSchema = new mongoose.Schema(
  {
    title: { type: String, index: true },
    webLink: String,
    descr: String,
    time: Number
  },
  { timestamps: true, collection: 'flSeries' }
);

module.exports = mongoose.model('FlSeries', FlSeriesSchema);
