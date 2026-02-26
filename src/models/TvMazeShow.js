const mongoose = require('mongoose');

const TvMazeShowSchema = new mongoose.Schema(
  { id: { type: Number } },
  { strict: false, collection: 'tvMazeFull', id: false }
);
TvMazeShowSchema.index({ id: 1 }, { unique: false });
TvMazeShowSchema.index({ name: 1 });

module.exports = mongoose.model('TvMazeShow', TvMazeShowSchema);
