// firebase.js — Full working Firebase Admin connection

import admin from "firebase-admin";
import fs from "fs";

// We support two credential modes:
// 1) Local development: read "serviceAccountKey.json" from disk
// 2) Render deployment: read from FIREBASE_SERVICE_ACCOUNT env var

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // On Render (env variable contains full JSON)
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT env var is invalid JSON.");
    throw err;
  }
} else {
  // Local dev mode: load file
  try {
    const raw = fs.readFileSync("./serviceAccountKey.json", "utf8");
    serviceAccount = JSON.parse(raw);
  } catch (err) {
    console.error("❌ Missing serviceAccountKey.json for local Firebase admin.");
    console.error(
      "Download it from Firebase → Project Settings → Service Accounts."
    );
    throw err;
  }
}

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const db = admin.firestore();
