const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    FLpasskey: { type: String, default: '' },
    favorites: { type: [Number], default: [] },
    resetToken: { type: String, default: '' },
    resetTokenExpiresAt: { type: Date, default: null }
  },
  { timestamps: true, collection: 'users' }
);

module.exports = mongoose.model('User', UserSchema);
