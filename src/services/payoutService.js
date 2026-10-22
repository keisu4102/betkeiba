function calculatePool(race) {
  const perHorse = new Map();
  let totalPool = 0;
  for (const bet of race.bets) {
    totalPool += bet.stake;
    const id = String(bet.horseId);
    perHorse.set(id, (perHorse.get(id) || 0) + bet.stake);
  }
  const netPool = Math.floor(totalPool * (1 - race.takeRate / 100));
  const horses = race.horses.map(horse => {
    const amount = perHorse.get(String(horse._id)) || 0;
    return {
      horseId: String(horse._id),
      horseNo: horse.horseNo,
      name: horse.name,
      amountBet: amount,
      share: totalPool ? amount / totalPool : 0,
      indicativeReturnPerCredit: amount ? Number((netPool / amount).toFixed(2)) : null
    };
  });
  return { totalPool, netPool, takeRate: race.takeRate, horses };
}

function settleRace(race) {
  if (race.status === "finished" || race.settledAt) throw new Error("This race has already been settled.");
  if (race.status !== "closed") throw new Error("Close betting before settling the race.");
  const winner = race.horses.find(h => String(h._id) === String(race.winnerHorseId));
  if (!winner) throw new Error("Race winner was not found.");
  const totalPool = race.bets.reduce((sum, bet) => sum + bet.stake, 0);
  const winningStake = race.bets
    .filter(bet => String(bet.horseId) === String(winner._id))
    .reduce((sum, bet) => sum + bet.stake, 0);
  const netPool = Math.floor(totalPool * (1 - race.takeRate / 100));
  const refundAll = winningStake === 0;
  let paid = 0;
  for (const bet of race.bets) {
    if (refundAll) {
      bet.status = "refunded";
      bet.payout = bet.stake;
    } else if (String(bet.horseId) === String(winner._id)) {
      bet.status = "won";
      bet.payout = Math.floor(netPool * bet.stake / winningStake);
    } else {
      bet.status = "lost";
      bet.payout = 0;
    }
    paid += bet.payout;
  }
  race.totalPool = totalPool;
  race.status = "finished";
  race.settledAt = new Date();
  return { winner, totalPool, netPool, winningStake, refundAll, totalPaid: paid };
}

module.exports = { calculatePool, settleRace };
