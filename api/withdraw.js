// api/withdraw.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    // Handle preflight CORS
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
    res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const { uid, bankCode, accountNumber, amount } = req.body;

    if (!uid || !bankCode || !accountNumber || !amount) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Create transfer recipient
    const recipientResponse = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "nuban",
        name: `User-${uid}`,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN"
      })
    });

    const recipientData = await recipientResponse.json();

    if (!recipientData.status) {
      return res.status(400).json({ success: false, message: recipientData.message || "Failed to create recipient" });
    }

    // Initiate transfer
    const transferResponse = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "balance",
        amount: amount * 100, // convert to kobo
        recipient: recipientData.data.recipient_code,
        reason: "MVPay Withdrawal"
      })
    });

    const transferData = await transferResponse.json();

    if (!transferData.status) {
      return res.status(400).json({ success: false, message: transferData.message || "Transfer failed" });
    }

    return res.status(200).json({ success: true, message: "Withdrawal successful", data: transferData.data });

  } catch (error) {
    console.error("Withdraw error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
