// firebase.js — FINAL FULL VERSION

import admin from "firebase-admin";
import fs from "fs";

let serviceAccount;

// Render mode: ENV VAR
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error("Invalid FIREBASE_SERVICE_ACCOUNT JSON");
    throw err;
  }
} 
// Local mode: file
else {
  try {
    const raw = fs.readFileSync("./serviceAccountKey.json", "utf8");
    serviceAccount = JSON.parse(raw);
  } catch (err) {
    console.error("Missing serviceAccountKey.json for local Firebase.");
    throw err;
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export const db = admin.firestore();
