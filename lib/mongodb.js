import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_READONLY_URI = process.env.MONGODB_READONLY_URI;

/* ------------------------------------------------------------------ */
/* 1. Main app connection (unchanged behaviour)                        */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* 2. Read-only connection for the AI cofounder                        */
/*    Separate connection + separate DB user (role: "read" only).      */
/*    Even if the agent code has a bug, it cannot modify your data.    */
/* ------------------------------------------------------------------ */

let cachedRO = global._mongooseReadOnly;
if (!cachedRO) {
  cachedRO = global._mongooseReadOnly = { conn: null, promise: null };
}

export async function dbConnectReadOnly() {
  if (cachedRO.conn) return cachedRO.conn;

  if (!MONGODB_READONLY_URI) {
    throw new Error('Missing MONGODB_READONLY_URI in .env - create a read-only DB user for the AI cofounder');
  }

  if (!cachedRO.promise) {
    // createConnection keeps this separate from the default mongoose.connect() above
    cachedRO.promise = mongoose
      .createConnection(MONGODB_READONLY_URI, {
        bufferCommands: false,
        maxPoolSize: 2,                  // the cofounder needs very few connections
        serverSelectionTimeoutMS: 5000,
      })
      .asPromise()
      .catch((err) => {
        cachedRO.promise = null;
        throw err;
      });
  }

  cachedRO.conn = await cachedRO.promise;
  return cachedRO.conn;
}

// Native MongoDB Db handle (what the cofounder tools use for aggregations)
export async function getReadOnlyDb() {
  const conn = await dbConnectReadOnly();
  return conn.db;
}