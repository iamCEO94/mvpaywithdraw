// api/withdraw.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { bank_code, account_number, amount, reason } = req.body;

    if (!bank_code || !account_number || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1️⃣ Create recipient on Paystack
    const recipientResponse = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: "Withdrawal User",
        account_number,
        bank_code,
        currency: "NGN",
      }),
    });

    const recipientData = await recipientResponse.json();
    if (!recipientData.status) {
      return res.status(400).json({ error: "Failed to create recipient", details: recipientData });
    }

    const recipientCode = recipientData.data.recipient_code;

    // 2️⃣ Initiate transfer
    const transferResponse = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amount * 100, // Paystack expects kobo
        recipient: recipientCode,
        reason: reason || "Withdrawal from MVPay",
      }),
    });

    const transferData = await transferResponse.json();

    if (!transferData.status) {
      return res.status(400).json({ error: "Transfer failed", details: transferData });
    }

    return res.status(200).json({
      message: "Withdrawal initiated successfully",
      data: transferData.data,
    });

  } catch (err) {
    console.error("Withdraw error:", err);
    return res.status(500).json({ error: "MVPay withdrawal server error. Try again later." });
  }
}
