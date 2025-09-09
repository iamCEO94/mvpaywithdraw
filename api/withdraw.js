// api/withdraw.js
import fetch from "node-fetch";
import admin from "firebase-admin";

// Initialize Firebase Admin once
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { uid, bankCode, accountNumber, amount } = req.body;

    if (!uid || !bankCode || !accountNumber || !amount) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // ✅ Check user balance
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userData = userDoc.data();
    if (userData.balance < amount) {
      return res.status(400).json({ success: false, message: "Insufficient balance" });
    }

    // ✅ Create transfer recipient
    const recipientResp = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: userData.name || "MVPay User",
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      }),
    });

    const recipientData = await recipientResp.json();
    if (!recipientData.status) {
      return res.status(400).json({ success: false, message: "Failed to create recipient", details: recipientData });
    }

    const recipientCode = recipientData.data.recipient_code;

    // ✅ Initiate transfer
    const transferResp = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amount * 100, // kobo
        recipient: recipientCode,
        reason: "MVPay Wallet Withdrawal",
      }),
    });

    const transferData = await transferResp.json();
    if (!transferData.status) {
      return res.status(400).json({ success: false, message: "Transfer failed", details: transferData });
    }

    // ✅ Deduct from Firestore balance
    await userRef.update({
      balance: userData.balance - amount,
      totalWithdraw: (userData.totalWithdraw || 0) + amount,
    });

    return res.status(200).json({ success: true, message: "Withdrawal successful", data: transferData });
  } catch (error) {
    console.error("Withdrawal error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
