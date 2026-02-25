const mongoose = require('mongoose');

const RarBgSeriesSchema = new mongoose.Schema(
  {
    title: { type: String, index: true },
    webLink: String,
    time: Number
  },
  { timestamps: true, collection: 'rarBgSeries' }
);

module.exports = mongoose.model('RarBgSeries', RarBgSeriesSchema);
