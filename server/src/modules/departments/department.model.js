import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    floor: { type: String },
    roomIds: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Department = mongoose.models.Department || mongoose.model('Department', departmentSchema);

export function toPublicDepartment(department) {
  return {
    id: department._id,
    name: department.name,
    code: department.code,
    ...(department.description ? { description: department.description } : {}),
    ...(department.floor ? { floor: department.floor } : {}),
    roomIds: department.roomIds ?? [],
  };
}
