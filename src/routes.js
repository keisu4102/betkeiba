const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const crypto = require("crypto");
const Race = require("./models/Race");
const Wallet = require("./models/Wallet");
const User = require("./models/User");
const { decodeBuffer, parseMetadata, parseHorseCsv } = require("./services/importService");
const { calculatePool, settleRace } = require("./services/payoutService");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

async function getWallet(userId, session = null) {
  const key = String(userId);
  let query = Wallet.findOne({ key });
  if (session) query = query.session(session);
  let wallet = await query;
  if (!wallet) {
    const docs = await Wallet.create([{ key, balance: Number(process.env.STARTING_CREDITS || 10000) }], session ? { session } : {});
    wallet = docs[0];
  }
  return wallet;
}
function adminOnly(req, res) {
  if (req.user?.role !== "admin") { res.status(403).json({ error: "Administrator access required." }); return false; }
  return true;
}
function publicRace(race) {
  const data = race.toObject ? race.toObject() : { ...race };
  data.bets = (data.bets || []).map(b => ({ horseId: b.horseId, horseName: b.horseName, stake: b.stake, status: b.status, payout: b.payout }));
  return data;
}

router.get("/wallet", async (req, res, next) => {
  try {
    const wallet = await getWallet(req.user.id);
    res.json({ balance: wallet.balance, transactions: wallet.transactions.slice(-20).reverse() });
  } catch (e) { next(e); }
});

router.post("/wallet/reset", async (req, res, next) => {
  if (!adminOnly(req, res)) return;
  try {
    const wallet = await getWallet(req.user.id);
    wallet.balance = Number(process.env.STARTING_CREDITS || 10000);
    wallet.transactions.push({ type: "reset", amount: wallet.balance, balanceAfter: wallet.balance, note: "Administrator wallet reset" });
    await wallet.save();
    res.json({ balance: wallet.balance });
  } catch (e) { next(e); }
});

router.get("/races", async (_req, res, next) => {
  try {
    const races = await Race.find().sort({ createdAt: -1 });
    res.json(races.map(publicRace));
  } catch (e) { next(e); }
});

router.get("/races/:id", async (req, res, next) => {
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found." });
    res.json(publicRace(race));
  } catch (e) { next(e); }
});

router.post("/races/import", upload.fields([{ name: "metadataFile" }, { name: "horseCsv" }]), async (req, res, next) => {
  if (!adminOnly(req, res)) return;
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
  if (!adminOnly(req, res)) return;
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
  if (!adminOnly(req, res)) return;
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
  if (!adminOnly(req, res)) return;
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found." });
    if (race.bets.length) return res.status(400).json({ error: "Cannot delete a race that already has bets." });
    await race.deleteOne();
    res.json({ message: "Race deleted." });
  } catch (e) { next(e); }
});

router.post("/races/:id/horses", async (req, res, next) => {
  if (!adminOnly(req, res)) return;
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
  if (!adminOnly(req, res)) return;
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
  if (!adminOnly(req, res)) return;
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

router.get("/admin/users", async (req, res, next) => {
  if (!adminOnly(req, res)) return;
  try {
    const users = await User.find().select("username role active createdAt").sort({ createdAt: -1 });
    const Wallet = require("./models/Wallet");
    const wallets = await Wallet.find({ key: { $in: users.map(u => String(u._id)) } });
    const byKey = new Map(wallets.map(w => [w.key, w.balance]));
    res.json(users.map(u => ({ id: String(u._id), username: u.username, role: u.role, active: u.active, balance: byKey.get(String(u._id)) || 0, createdAt: u.createdAt })));
  } catch (e) { next(e); }
});
router.post("/admin/users/:id/credits", async (req, res, next) => {
  if (!adminOnly(req, res)) return;
  try {
    const amount = Number(req.body.amount);
    if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 1000000) return res.status(400).json({ error: "Amount must be a non-zero whole number up to 1,000,000 credits." });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    const wallet = await getWallet(user.id);
    if (wallet.balance + amount < 0) return res.status(400).json({ error: "Adjustment would make the balance negative." });
    wallet.balance += amount;
    wallet.transactions.push({ type: "admin_adjustment", amount, balanceAfter: wallet.balance, note: String(req.body.note || `Admin adjustment by ${req.user.username}`).slice(0, 200) });
    await wallet.save();
    res.json({ username: user.username, balance: wallet.balance });
  } catch (e) { next(e); }
});
router.patch("/admin/users/:id", async (req, res, next) => {
  if (!adminOnly(req, res)) return;
  try {
    if (String(req.params.id) === String(req.user.id) && req.body.active === false) return res.status(400).json({ error: "You cannot disable your own account." });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    if (req.body.active !== undefined) user.active = Boolean(req.body.active);
    if (req.body.role !== undefined) {
      if (!['admin','user'].includes(req.body.role)) return res.status(400).json({ error: "Invalid role." });
      if (String(user._id) === String(req.user.id) && req.body.role !== 'admin') return res.status(400).json({ error: "You cannot remove your own admin role." });
      user.role = req.body.role;
    }
    await user.save(); res.json({ id: user.id, username: user.username, role: user.role, active: user.active });
  } catch (e) { next(e); }
});
router.post("/races/:id/results", async (req, res, next) => {
  if (!adminOnly(req, res)) return;
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found." });
    if (race.status !== "closed" || race.settledAt) return res.status(400).json({ error: "Close betting first. Results can only be entered before settlement." });
    const order = req.body.finishOrder;
    if (!Array.isArray(order) || order.length < 1) return res.status(400).json({ error: "Provide the official finishing order." });
    const ids = order.map(String);
    if (new Set(ids).size !== ids.length || ids.some(id => !race.horses.id(id))) return res.status(400).json({ error: "Finishing order contains duplicate or invalid horses." });
    race.horses.forEach(h => { h.finishPosition = null; });
    order.forEach((id, index) => { race.horses.id(id).finishPosition = index + 1; });
    race.winnerHorseId = race.horses.id(order[0])._id;
    await race.save();
    res.json({ message: "Official result saved. Review it, then settle payouts.", race });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post("/bets", async (req, res, next) => {
  const amount = Number(req.body.stake);
  if (!Number.isSafeInteger(amount) || amount < 10) return res.status(400).json({ error: "Stake must be a whole number of at least 10 credits." });
  const session = await mongoose.startSession();
  try {
    let response;
    await session.withTransaction(async () => {
      const race = await Race.findById(req.body.raceId).session(session);
      if (!race) throw new Error("Race not found.");
      if (race.status !== "open") throw new Error("Betting is closed for this race.");
      const horse = race.horses.id(req.body.horseId);
      if (!horse) throw new Error("Select a valid horse.");
      const wallet = await getWallet(req.user.id, session);
      if (wallet.balance < amount) throw new Error("Not enough virtual credits.");
      wallet.balance -= amount;
      const ticket = { ticketId: crypto.randomUUID(), bettor: String(req.user.id), horseId: horse._id, horseName: horse.name, stake: amount };
      wallet.transactions.push({ type: "bet", amount: -amount, balanceAfter: wallet.balance, note: `${race.name}: ${horse.name} (${ticket.ticketId})` });
      race.bets.push(ticket);
      await wallet.save({ session });
      await race.save({ session });
      response = { message: "Bet placed.", balance: wallet.balance, ticket: race.bets[race.bets.length - 1] };
    });
    res.status(201).json(response);
  } catch (e) { res.status(400).json({ error: e.message }); }
  finally { await session.endSession(); }
});

router.post("/races/:id/close", async (req, res, next) => {
  if (!adminOnly(req, res)) return;
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
  if (!adminOnly(req, res)) return;
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
  if (!adminOnly(req, res)) return;
  const session = await mongoose.startSession();
  try {
    let response;
    await session.withTransaction(async () => {
      const race = await Race.findById(req.params.id).session(session);
      if (!race) throw new Error("Race not found.");
      const result = settleRace(race);
      await race.save({ session });
      const byBettor = new Map();
      for (const bet of race.bets.filter(b => b.payout > 0)) {
        const key = String(bet.bettor);
        if (!byBettor.has(key)) byBettor.set(key, []);
        byBettor.get(key).push(bet);
      }
      for (const [bettor, tickets] of byBettor) {
        const wallet = await getWallet(bettor, session);
        for (const bet of tickets) {
          wallet.balance += bet.payout;
          wallet.transactions.push({ type: bet.status === "refunded" ? "refund" : "payout", amount: bet.payout, balanceAfter: wallet.balance, note: `${race.name}: ${bet.horseName} (${bet.ticketId})` });
        }
        await wallet.save({ session });
      }
      response = { message: "Race settled.", result: { winner: result.winner.name, totalPool: result.totalPool, netPool: result.netPool, winningStake: result.winningStake, refundAll: result.refundAll, totalPaid: result.totalPaid }, race };
    });
    res.json(response);
  } catch (e) { res.status(400).json({ error: e.message }); }
  finally { await session.endSession(); }
});

router.get("/bets/mine", async (req, res, next) => {
  try {
    const races = await Race.find({ "bets.bettor": String(req.user.id) }).sort({ createdAt: -1 });
    const bets = races.flatMap(race => race.bets.filter(b => b.bettor === String(req.user.id)).map(b => ({
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
