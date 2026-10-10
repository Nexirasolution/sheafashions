import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

// Reuse one connection per function instance
let cached = global._mongoose;
if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

export async function dbConnect() {
  if (cached.conn) return cached.conn;

  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in .env - add your MongoDB Atlas connection string');
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        maxPoolSize: 5,                  // small pool: serverless instances are many, each needs few connections
        serverSelectionTimeoutMS: 5000,  // fail fast instead of keeping the function alive (and billing CPU/duration)
      })
      .then((m) => m)
      .catch((err) => {
        cached.promise = null;           // allow a retry on the next request after a failed connect
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}