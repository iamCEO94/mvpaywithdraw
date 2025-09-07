import Cors from "cors";
import fetch from "node-fetch";
import admin from "firebase-admin";

// Enable CORS
const cors = Cors({ origin: "*", methods: ["POST", "OPTIONS"] });

// Initialize Firebase Admin with single service key variable
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
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
      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) return res.status(404).json({ success: false, message: "User not found" });

      const userData = userSnap.data();
      if (userData.balance < amount) return res.status(400).json({ success: false, message: "Insufficient balance" });

      const transferRes = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "balance",
          reason: "User Withdrawal",
          amount: amount * 100,
          recipient: accountNumber,
          currency: "NGN",
        }),
      });

      const transferData = await transferRes.json();
      if (!transferData.status) return res.status(400).json({ success: false, message: transferData.message });

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
