import Cors from "cors";
import fetch from "node-fetch";
import admin from "firebase-admin";

// Enable CORS
const cors = Cors({ origin: "*", methods: ["POST", "OPTIONS"] });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
    }),
  });
}

const db = admin.firestore();

export default function handler(req, res) {
  return cors(req, res, async () => {
    if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

    const { uid, amount, bankName, accountNumber } = req.body;

    if (!uid || !amount || !bankName || !accountNumber) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    try {
      // Fetch user from Firestore
      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) return res.status(404).json({ success: false, message: "User not found" });

      const userData = userSnap.data();
      if (userData.balance < amount) return res.status(400).json({ success: false, message: "Insufficient balance" });

      // Initiate Paystack transfer
      const transferRes = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "balance",
          reason: "User Withdrawal",
          amount: amount * 100, // Paystack in kobo
          recipient: accountNumber, // assuming recipient code or account number
          currency: "NGN",
        }),
      });

      const transferData = await transferRes.json();
      if (!transferData.status) return res.status(400).json({ success: false, message: transferData.message });

      // Deduct from user's balance
      await userRef.update({
        balance: admin.firestore.FieldValue.increment(-amount),
        totalWithdraw: admin.firestore.FieldValue.increment(amount),
      });

      return res.json({ success: true, message: "Withdrawal initiated successfully" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });
}
