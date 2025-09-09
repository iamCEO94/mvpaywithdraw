// api/withdraw.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { bankCode, accountNumber, amount, name } = req.body;

    if (!bankCode || !accountNumber || !amount || !name) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ success: false, message: "Missing Paystack secret key" });
    }

    // Step 1: Create transfer recipient
    const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "nuban",
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN"
      })
    });

    const recipientData = await recipientRes.json();
    if (!recipientData.status) {
      return res.status(400).json({ success: false, message: recipientData.message });
    }

    const recipientCode = recipientData.data.recipient_code;

    // Step 2: Initiate transfer
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "balance",
        amount: amount * 100, // Paystack uses kobo
        recipient: recipientCode,
        reason: "MVPay Withdrawal"
      })
    });

    const transferData = await transferRes.json();

    if (!transferData.status) {
      return res.status(400).json({ success: false, message: transferData.message });
    }

    return res.status(200).json({
      success: true,
      message: "Withdrawal initiated successfully",
      data: transferData.data
    });

  } catch (error) {
    console.error("Withdraw error:", error);
    return res.status(500).json({ success: false, message: "MVPay withdrawal server error" });
  }
}
