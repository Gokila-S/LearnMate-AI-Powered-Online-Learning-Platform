import mongoose from 'mongoose';

const providerApplicationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // optional; set on approval
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  // Password is captured at submission time but becomes optional later; keep it excluded from default selects
  password: { type: String, select: false },
  organization: { type: String, required: true },
  website: { type: String },
  message: { type: String, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending', index: true },
  decidedAt: { type: Date },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String }
}, { timestamps: true });

export default mongoose.model('ProviderApplication', providerApplicationSchema);
