const mongoose = require("mongoose");

const horseSchema = new mongoose.Schema({
  gate: { type: Number, required: true, min: 1 },
  horseNo: { type: Number, required: true, min: 1 },
  bracket: { type: Number, default: null, min: 1 },
  post: { type: Number, default: null, min: 1 },
  name: { type: String, required: true, trim: true },
  sire: { type: String, default: "" },
  dam: { type: String, default: "" },
  damsire: { type: String, default: "" },
  lastRace: { type: String, default: "" },
  abilityScore: { type: Number, default: 50, min: 1, max: 100 },
  finishPosition: { type: Number, default: null }
}, { _id: true });

const betSchema = new mongoose.Schema({
  ticketId: { type: String, required: true },
  bettor: { type: String, default: "demo" },
  horseId: { type: mongoose.Schema.Types.ObjectId, required: true },
  horseName: { type: String, required: true },
  stake: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ["pending", "won", "lost", "refunded"], default: "pending" },
  payout: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const raceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  date: { type: String, default: "" },
  venue: { type: String, required: true, trim: true },
  raceNumber: { type: String, default: "" },
  netkeibaUrl: { type: String, default: "" },
  takeRate: { type: Number, default: 10, min: 0, max: 30 },
  distance: { type: Number, default: null },
  surface: { type: String, default: "Turf" },
  status: { type: String, enum: ["open", "closed", "finished"], default: "open" },
  horses: { type: [horseSchema], validate: v => v.length >= 2 },
  bets: { type: [betSchema], default: [] },
  winnerHorseId: { type: mongoose.Schema.Types.ObjectId, default: null },
  totalPool: { type: Number, default: 0 },
  settledAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model("Race", raceSchema);
