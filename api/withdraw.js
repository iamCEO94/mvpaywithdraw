// Import the Paystack library
const paystack = require('paystack-api')('YOUR_PAYSTACK_SECRET_KEY');

// This is the main handler for the Vercel serverless function.
module.exports = async (req, res) => {
    // Set the response headers to allow CORS (Cross-Origin Resource Sharing)
    // This is CRITICAL for your frontend to communicate with this backend.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle the OPTIONS pre-flight request from the browser
    // This is part of the CORS protocol.
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Correctly read the JSON body from the request.
        // It is crucial to use `req.body` and to de-structure the variables.
        const { account_number, bank_code, amount } = req.body;

        // Check for missing fields as a safety measure
        if (!account_number || !bank_code || !amount) {
            return res.status(400).json({ success: false, message: 'All fields (account_number, bank_code, amount) are required.' });
        }

        // Call the Paystack transfer recipient creation API
        const recipient = await paystack.transferrecipient.create({
            type: "nuban",
            name: "Recipient Name", // Use a placeholder name or get it from the frontend
            account_number,
            bank_code,
            currency: "NGN",
        });

        // Use the new recipient code to initiate the transfer
        const transfer = await paystack.transfer.create({
            source: "balance",
            reason: "Withdrawal from balance",
            amount: amount, // The amount is in kobo, so you should ensure the frontend sends it that way or multiply by 100 here.
            recipient: recipient.data.recipient_code,
        });

        // If the transfer is successful, send a success response to the frontend
        res.status(200).json({ success: true, message: "Transfer initiated successfully!", data: transfer.data });

    } catch (error) {
        // If there's any error during the process, catch it and send it to the frontend for debugging.
        console.error('API Error:', error);
        res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
    }
};
