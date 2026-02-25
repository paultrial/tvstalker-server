const mongoose = require('mongoose');

const TvMazeShowSchema = new mongoose.Schema({}, { strict: false, collection: 'tvMazeFull' });
TvMazeShowSchema.index({ id: 1 }, { unique: false });
TvMazeShowSchema.index({ name: 1 });

module.exports = mongoose.model('TvMazeShow', TvMazeShowSchema);
