import mongoose from 'mongoose';

const ReelSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    // Direct video file URL (.mp4 / .webm) hosted on R2. Instagram embed URLs
    // can't autoplay in a <video> tag; the UI falls back to the thumbnail.
    videoUrl: { type: String, required: true },
    thumbnail: { type: String, default: '' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    instagramLink: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Reel || mongoose.model('Reel', ReelSchema);