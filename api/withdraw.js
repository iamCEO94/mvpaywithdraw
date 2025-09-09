// api/withdraw.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { uid, bankCode, accountNumber, amount } = req.body;
  if (!uid || !bankCode || !accountNumber || !amount) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return res.status(500).json({ success: false, message: "Missing Paystack secret key" });
  }

  try {
    // Create recipient
    const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
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
    const recipientData = await recipientRes.json();
    if (!recipientData.status) {
      return res.status(400).json({ success: false, message: "Failed to create recipient", details: recipientData });
    }
    const recipient_code = recipientData.data.recipient_code;

    // Initiate transfer
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "balance",
        amount: amount * 100,
        recipient: recipient_code,
        reason: "MVPay Wallet Withdrawal"
      })
    });
    const transferData = await transferRes.json();
    if (!transferData.status) {
      return res.status(400).json({ success: false, message: "Transfer failed", details: transferData });
    }

    return res.status(200).json({ success: true, message: "Withdrawal successful", data: transferData.data });

  } catch (error) {
    console.error("Withdrawal error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
