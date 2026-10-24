import mongoose from 'mongoose';

const floorSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    // Server-only display order for the floor list (e.g. 0 = ground floor).
    level: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Floor = mongoose.models.Floor || mongoose.model('Floor', floorSchema);
