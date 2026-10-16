import mongoose from 'mongoose';

const CourierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Tracking link template. {awb} is replaced with the order's AWB number.
    // Example: https://example.com/track?awb={awb}
    trackingUrl: { type: String, default: '', trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Courier || mongoose.model('Courier', CourierSchema);