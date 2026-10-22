const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "demo-wallet" },
  balance: { type: Number, default: 10000, min: 0 },
  transactions: [{
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    note: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model("Wallet", walletSchema);
