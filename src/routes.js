const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const Race = require("./models/Race");
const Wallet = require("./models/Wallet");
const { decodeBuffer, parseMetadata, parseHorseCsv } = require("./services/importService");
const { calculatePool, settleRace } = require("./services/payoutService");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

async function getWallet() {
  let wallet = await Wallet.findOne({ key: "demo-wallet" });
  if (!wallet) wallet = await Wallet.create({ key: "demo-wallet", balance: 10000 });
  return wallet;
}

router.get("/wallet", async (_req, res, next) => {
  try {
    const wallet = await getWallet();
    res.json({ balance: wallet.balance, transactions: wallet.transactions.slice(-20).reverse() });
  } catch (e) { next(e); }
});

router.post("/wallet/reset", async (_req, res, next) => {
  try {
    const wallet = await getWallet();
    wallet.balance = 10000;
    wallet.transactions.push({ type: "reset", amount: 10000, balanceAfter: 10000, note: "Demo wallet reset" });
    await wallet.save();
    res.json({ balance: wallet.balance });
  } catch (e) { next(e); }
});

router.get("/races", async (_req, res, next) => {
  try {
    const races = await Race.find().sort({ createdAt: -1 });
    res.json(races);
  } catch (e) { next(e); }
});

router.get("/races/:id", async (req, res, next) => {
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found." });
    res.json(race);
  } catch (e) { next(e); }
});

router.post("/races/import", upload.fields([{ name: "metadataFile" }, { name: "horseCsv" }]), async (req, res, next) => {
  try {
    let metadataText = req.files?.metadataFile?.[0] ? decodeBuffer(req.files.metadataFile[0].buffer) : (req.body.metadataText || "");
    const metadata = parseMetadata(metadataText);
    let csvText = req.files?.horseCsv?.[0] ? decodeBuffer(req.files.horseCsv[0].buffer) : (req.body.horseRows || "");
    const horses = parseHorseCsv(csvText);
    const race = await Race.create({ ...metadata, horses, status: "open" });
    res.status(201).json({ message: "Race imported successfully.", race });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/races", async (req, res, next) => {
  try {
    const { name, venue, horses } = req.body;
    if (!name || !venue || !Array.isArray(horses) || horses.length < 2) {
      return res.status(400).json({ error: "name, venue, and at least two horses are required." });
    }
    const race = await Race.create(req.body);
    res.status(201).json(race);
  } catch (e) { next(e); }
});

router.put("/races/:id", async (req, res, next) => {
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found." });
    if (race.bets.length && ["status", "horses", "takeRate"].some(k => req.body[k] !== undefined)) {
      return res.status(400).json({ error: "Cannot change runners, take rate or status after bets have been placed." });
    }
    const allowed = ["name", "date", "venue", "raceNumber", "netkeibaUrl", "takeRate", "distance", "surface"];
    allowed.forEach(key => { if (req.body[key] !== undefined) race[key] = req.body[key]; });
    await race.save();
    res.json(race);
  } catch (e) { next(e); }
});

router.delete("/races/:id", async (req, res, next) => {
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found." });
    if (race.bets.length) return res.status(400).json({ error: "Cannot delete a race that already has bets." });
    await race.deleteOne();
    res.json({ message: "Race deleted." });
  } catch (e) { next(e); }
});

router.post("/races/:id/horses", async (req, res, next) => {
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found." });
    if (race.status !== "open" || race.bets.length) return res.status(400).json({ error: "Runners can only be edited before any bets are placed." });
    race.horses.push(req.body);
    await race.save();
    res.status(201).json(race);
  } catch (e) { next(e); }
});

router.put("/races/:id/horses/:horseId", async (req, res, next) => {
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found." });
    if (race.status !== "open" || race.bets.length) return res.status(400).json({ error: "Runners can only be edited before any bets are placed." });
    const horse = race.horses.id(req.params.horseId);
    if (!horse) return res.status(404).json({ error: "Horse not found." });
    ["gate", "horseNo", "name", "sire", "dam", "damsire", "lastRace", "abilityScore"].forEach(k => {
      if (req.body[k] !== undefined) horse[k] = req.body[k];
    });
    await race.save();
    res.json(race);
  } catch (e) { next(e); }
});

router.delete("/races/:id/horses/:horseId", async (req, res, next) => {
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found." });
    if (race.status !== "open" || race.bets.length) return res.status(400).json({ error: "Runners can only be edited before any bets are placed." });
    if (race.horses.length <= 2) return res.status(400).json({ error: "A race must have at least two horses." });
    const horse = race.horses.id(req.params.horseId);
    if (!horse) return res.status(404).json({ error: "Horse not found." });
    horse.deleteOne();
    await race.save();
    res.json(race);
  } catch (e) { next(e); }
});

router.get("/races/:id/pool", async (req, res, next) => {
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found." });
    res.json(calculatePool(race));
  } catch (e) { next(e); }
});

router.post("/bets", async (req, res, next) => {
  try {
    const { raceId, horseId, stake } = req.body;
    const amount = Number(stake);
    if (!Number.isInteger(amount) || amount < 10) return res.status(400).json({ error: "Stake must be a whole number of at least 10 credits." });
    const race = await Race.findById(raceId);
    if (!race) return res.status(404).json({ error: "Race not found." });
    if (race.status !== "open") return res.status(400).json({ error: "Betting is closed for this race." });
    const horse = race.horses.id(horseId);
    if (!horse) return res.status(400).json({ error: "Select a valid horse." });
    const wallet = await getWallet();
    if (wallet.balance < amount) return res.status(400).json({ error: "Not enough virtual credits." });
    // Educational single-user demo. For production, use authenticated users and atomic transactions.
    wallet.balance -= amount;
    wallet.transactions.push({ type: "bet", amount: -amount, balanceAfter: wallet.balance, note: `${race.name}: ${horse.name}` });
    race.bets.push({ ticketId: crypto.randomUUID(), bettor: "demo", horseId: horse._id, horseName: horse.name, stake: amount });
    await wallet.save();
    await race.save();
    res.status(201).json({ message: "Bet placed.", balance: wallet.balance, ticket: race.bets[race.bets.length - 1] });
  } catch (e) { next(e); }
});

router.post("/races/:id/close", async (req, res, next) => {
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found." });
    if (race.status !== "open") return res.status(400).json({ error: "Race is not open." });
    race.status = "closed";
    await race.save();
    res.json({ message: "Betting closed.", race });
  } catch (e) { next(e); }
});

router.post("/races/:id/simulate", async (req, res, next) => {
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found." });
    if (race.status !== "closed") return res.status(400).json({ error: "Close betting before running the race." });
    if (race.winnerHorseId) return res.status(400).json({ error: "A winner has already been selected." });
    // Weighted random score: stronger simulated ability improves the chance, but does not guarantee a win.
    const weighted = race.horses.map(h => ({ horse: h, weight: Math.max(1, h.abilityScore) * (0.75 + Math.random() * 0.5) }));
    const winner = weighted.reduce((best, item) => item.weight > best.weight ? item : best).horse;
    const ordered = [...weighted].sort((a, b) => b.weight - a.weight);
    ordered.forEach((item, i) => { item.horse.finishPosition = i + 1; });
    race.winnerHorseId = winner._id;
    await race.save();
    res.json({ message: "Race simulated.", winner, finishOrder: ordered.map(x => ({ horseNo: x.horse.horseNo, name: x.horse.name, finishPosition: x.horse.finishPosition })) });
  } catch (e) { next(e); }
});

router.post("/races/:id/settle", async (req, res, next) => {
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found." });
    const result = settleRace(race);
    const wallet = await getWallet();
    for (const bet of race.bets.filter(b => b.bettor === "demo" && b.payout > 0)) {
      wallet.balance += bet.payout;
      wallet.transactions.push({ type: bet.status === "refunded" ? "refund" : "payout", amount: bet.payout, balanceAfter: wallet.balance, note: `${race.name}: ${bet.horseName}` });
    }
    await race.save();
    await wallet.save();
    res.json({ message: "Race settled.", result: { winner: result.winner.name, totalPool: result.totalPool, netPool: result.netPool, winningStake: result.winningStake, refundAll: result.refundAll, totalPaid: result.totalPaid }, race });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get("/bets/mine", async (_req, res, next) => {
  try {
    const races = await Race.find({ "bets.bettor": "demo" }).sort({ createdAt: -1 });
    const bets = races.flatMap(race => race.bets.filter(b => b.bettor === "demo").map(b => ({
      ...b.toObject(), raceId: race._id, raceName: race.name, venue: race.venue, raceStatus: race.status
    })));
    res.json(bets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (e) { next(e); }
});

router.get("/templates/metadata", (_req, res) => {
  res.type("text/plain").attachment("race_metadata_template.txt").send(
`# ToteTrack race metadata template\nname=Kikuka Sho\ndate=2026-10-25\nvenue=Kyoto\nraceNumber=11R\nnetkeibaUrl=https://race.netkeiba.com/...\ntakeRate=10\ndistance=3000\nsurface=Turf\n`
  );
});
router.get("/templates/csv", (_req, res) => {
  res.type("text/csv").attachment("racecard_template.csv").send(
`gate,horse_no,name,sire,dam,damsire,last_race\n1,1,Example Horse,Example Sire,Example Dam,Example Damsire,Previous race (G2)\n1,2,Another Horse,Example Sire,Example Dam,Example Damsire,Previous race (G3)\n`
  );
});

router.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error. Check the server terminal for details." });
});

module.exports = router;
