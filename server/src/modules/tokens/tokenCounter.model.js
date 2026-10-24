import mongoose from 'mongoose';

// One counter document per department (_id = departmentId), incremented atomically.
const tokenCounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  value: { type: Number, required: true, default: 0 },
});

export const TokenCounter = mongoose.models.TokenCounter || mongoose.model('TokenCounter', tokenCounterSchema);

export async function nextTokenSequence(departmentId) {
  const counter = await TokenCounter.findOneAndUpdate(
    { _id: departmentId },
    { $inc: { value: 1 } },
    { upsert: true, new: true, lean: true },
  );

  return counter.value;
}
