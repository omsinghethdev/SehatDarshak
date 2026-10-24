import mongoose from 'mongoose';

// Coordinates use the floor's top-left-origin map-unit system.
const mapPositionSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true, min: 0 },
    y: { type: Number, required: true, min: 0 },
    width: { type: Number, required: true, min: 0 },
    height: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const roomSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    roomNumber: { type: String, trim: true },
    floorId: { type: String, ref: 'Floor', required: true },
    type: { type: String, required: true },
    departmentId: { type: String, ref: 'Department' },
    mapPosition: { type: mapPositionSchema, required: true },
    isAccessible: { type: Boolean },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

roomSchema.index({ floorId: 1, departmentId: 1, isActive: 1 });

export const Room = mongoose.models.Room || mongoose.model('Room', roomSchema);

export function toPublicRoom(room) {
  const { x, y, width, height } = room.mapPosition;

  return {
    id: room._id,
    name: room.name,
    ...(room.roomNumber ? { roomNumber: room.roomNumber } : {}),
    floorId: room.floorId,
    type: room.type,
    ...(room.departmentId ? { departmentId: room.departmentId } : {}),
    mapPosition: { x, y, width, height },
    ...(typeof room.isAccessible === 'boolean' ? { isAccessible: room.isAccessible } : {}),
  };
}
