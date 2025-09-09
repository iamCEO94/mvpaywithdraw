// api/withdraw.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  // Always set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const { account_number, bank_code, amount } = req.body;
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY; // Ensure you have this in your environment variables

    if (!account_number || !bank_code || !amount) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // 👉 1. Resolve Account Details to get the account name
    const resolveRes = await fetch("https://api.paystack.co/bank/resolve", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const resolveData = await resolveRes.json();
    if (!resolveRes.ok || !resolveData.status) {
        throw new Error(resolveData.message || 'Failed to resolve account');
    }

    const accountName = resolveData.data.account_name;

    // 👉 2. Create a Transfer Recipient
    const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: accountName,
        account_number,
        bank_code,
        currency: "NGN", // or your desired currency
      }),
    });

    const recipientData = await recipientRes.json();
    if (!recipientRes.ok || !recipientData.status) {
      throw new Error(recipientData.message || 'Failed to create transfer recipient');
    }

    const recipientCode = recipientData.data.recipient_code;

    // 👉 3. Initiate the Transfer
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        reason: "Withdrawal from user balance",
        amount: amount * 100, // Paystack API expects amount in kobo (or the lowest currency unit)
        recipient: recipientCode,
      }),
    });

    const transferData = await transferRes.json();
    if (!transferRes.ok || !transferData.status) {
      throw new Error(transferData.message || 'Transfer failed');
    }

    // If all steps succeed, return success
    return res.status(200).json({ success: true, message: "Withdrawal successful", data: transferData.data });

  } catch (error) {
    console.error("Withdraw error:", error);
    return res.status(500).json({ success: false, message: `Internal Server Error: ${error.message}` });
  }
}
