// api/withdraw.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { account_number, bank_code, amount } = req.body;

    if (!account_number || !bank_code || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Step 1: Create transfer recipient
    const recipientResp = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: "MVPay User",
        account_number,
        bank_code,
        currency: "NGN",
      }),
    });

    const recipientData = await recipientResp.json();

    if (!recipientData.status) {
      return res.status(400).json({ error: recipientData.message });
    }

    const recipientCode = recipientData.data.recipient_code;

    // Step 2: Initiate transfer
    const transferResp = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amount * 100, // Paystack expects kobo
        recipient: recipientCode,
        reason: "MVPay withdrawal",
      }),
    });

    const transferData = await transferResp.json();

    if (!transferData.status) {
      return res.status(400).json({ error: transferData.message });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ message: "Withdrawal successful", data: transferData.data });

  } catch (err) {
    console.error(err);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({ error: "Withdrawal failed. Please try again later." });
  }
}
