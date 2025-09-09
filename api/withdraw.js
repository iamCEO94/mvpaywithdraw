// api/withdraw.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  // Always set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const { account_number, bank_code, amount } = req.body;

    if (!account_number || !bank_code || !amount) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // 👉 Add Paystack withdrawal logic here...

    return res.status(200).json({ success: true, message: "Withdrawal successful" });

  } catch (error) {
    console.error("Withdraw error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}
