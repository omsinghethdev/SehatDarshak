import mongoose from 'mongoose';

// The walkable graph for indoor directions (see demoHospital.data.js for the data model). It is
// a separate, additive collection: floors and rooms are unchanged, and nodes refer to rooms by ID.
// One active document describes the whole hospital; the seed upserts it by its stable ID.

const routingSchema = new mongoose.Schema(
  {
    metresPerMapUnit: { type: Number, required: true, min: 0 },
    walkingMetresPerSecond: { type: Number, required: true, min: 0 },
    stairsMetresPerSecond: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const corridorSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    floorId: { type: String, required: true },
    x: { type: Number, required: true, min: 0 },
    y: { type: Number, required: true, min: 0 },
    width: { type: Number, required: true, min: 0 },
    height: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const nodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    floorId: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    kind: { type: String, enum: ['door', 'junction'], required: true },
    roomId: { type: String },
    transition: { type: String, enum: ['lift', 'stairs'] },
    entrance: { type: Boolean },
  },
  { _id: false },
);

const edgeSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    kind: { type: String, enum: ['corridor', 'door', 'lift', 'stairs'], required: true },
    metres: { type: Number, min: 0 },
    seconds: { type: Number, min: 0 },
  },
  { _id: false },
);

const navigationGraphSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    routing: { type: routingSchema, required: true },
    corridors: { type: [corridorSchema], default: [] },
    nodes: { type: [nodeSchema], default: [] },
    edges: { type: [edgeSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const NavigationGraph =
  mongoose.models.NavigationGraph || mongoose.model('NavigationGraph', navigationGraphSchema);
