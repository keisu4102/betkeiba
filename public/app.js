const $ = id => document.getElementById(id);
let races = [];
let selectedRace = null;

function showNotice(message, isError = false) {
  const el = $("notice");
  el.textContent = message;
  el.classList.remove("hidden", "error");
  if (isError) el.classList.add("error");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function money(n) { return Number(n || 0).toLocaleString("en-US"); }
async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
async function refreshWallet() {
  const wallet = await api("/api/wallet");
  $("balance").textContent = money(wallet.balance);
  $("heroBalance").textContent = money(wallet.balance);
}
async function loadRaces() {
  races = await api("/api/races");
  const host = $("raceList");
  if (!races.length) {
    host.innerHTML = '<div class="race-card"><h3>No races yet</h3><p class="muted">Import a racecard below to get started. Nothing is preloaded.</p><a class="link-button" href="#import">Import your first race</a></div>';
    return;
  }
  host.innerHTML = races.map(r => `
    <article class="race-card">
      <span class="pill ${r.status}">${r.status}</span>
      <h3>${esc(r.name)} ${esc(r.raceNumber || "")}</h3>
      <p class="race-meta">${esc(r.venue)} · ${esc(r.date || "Date not set")}<br>${r.distance ? `${r.distance} m · ` : ""}${esc(r.surface || "Turf")} · ${r.horses.length} runners</p>
      <p class="muted">Pool: ${money(r.bets.reduce((s,b)=>s+b.stake,0))} credits</p>
      <button onclick="openRace('${r._id}')">View race</button>
      ${r.bets.length === 0 && r.status === "open" ? `<button class="secondary" onclick="deleteRace('${r._id}')">Delete</button>` : ""}
    </article>`).join("");
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
async function openRace(id) {
  try {
    selectedRace = await api(`/api/races/${id}`);
    const pool = await api(`/api/races/${id}/pool`);
    $("selectedRace").classList.remove("hidden");
    $("raceTitle").textContent = `${selectedRace.name} ${selectedRace.raceNumber || ""}`;
    $("raceMeta").textContent = `${selectedRace.venue} · ${selectedRace.date || "Date not set"} · ${selectedRace.distance ? selectedRace.distance + " m · " : ""}${selectedRace.surface} · Total pool ${money(pool.totalPool)} · Takeout ${selectedRace.takeRate}%`;
    $("raceStatus").textContent = selectedRace.status;
    $("raceStatus").className = `pill ${selectedRace.status}`;
    $("betRaceId").value = selectedRace._id;
    $("betHorse").innerHTML = selectedRace.horses.map(h => `<option value="${h._id}">${h.horseNo}. ${esc(h.name)}</option>`).join("");
    $("horseRows").innerHTML = selectedRace.horses.map(h => {
      const p = pool.horses.find(x => x.horseId === h._id);
      const finish = h.finishPosition ? ` · Finish ${h.finishPosition}` : "";
      return `<tr><td>${h.horseNo}</td><td><strong>${esc(h.name)}</strong>${finish}</td><td>${esc(h.sire)} / ${esc(h.dam)}</td><td>${esc(h.lastRace)}</td><td>${money(p?.amountBet)} cr</td><td>${p?.indicativeReturnPerCredit ? p.indicativeReturnPerCredit.toFixed(2) + "×" : "—"}</td><td><button class="secondary" onclick="pickHorse('${h._id}')">Select</button></td></tr>`;
    }).join("");
    const actions = $("raceActions");
    actions.innerHTML = "";
    if (selectedRace.status === "open") actions.append(makeAction("Close betting", () => raceAction("close")));
    if (selectedRace.status === "closed" && !selectedRace.winnerHorseId) actions.append(makeAction("Simulate race", () => raceAction("simulate")));
    if (selectedRace.status === "closed" && selectedRace.winnerHorseId) actions.append(makeAction("Settle payouts", () => raceAction("settle")));
    $("betForm").querySelector("button").disabled = selectedRace.status !== "open";
    $("results").classList.add("hidden");
    if (selectedRace.status === "finished") renderFinished(selectedRace);
    $("selectedRace").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) { showNotice(e.message, true); }
}
function makeAction(label, callback) {
  const button = document.createElement("button");
  button.textContent = label;
  button.onclick = callback;
  return button;
}
function pickHorse(id) { $("betHorse").value = id; $("stake").focus(); }
async function raceAction(action) {
  try {
    const result = await api(`/api/races/${selectedRace._id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    showNotice(result.message || `${action} complete.`);
    await loadRaces(); await refreshWallet();
    await openRace(selectedRace._id);
    if (action === "simulate") showNotice(`Race simulated. Winner: ${result.winner.name}. Click Settle payouts to distribute the pool.`);
    if (action === "settle") { renderFinished(result.race); showNotice(`Settlement complete. Winner: ${result.result.winner}.`); }
  } catch (e) { showNotice(e.message, true); }
}
function renderFinished(race) {
  const winner = race.horses.find(h => String(h._id) === String(race.winnerHorseId));
  const pool = race.bets.reduce((s,b)=>s+b.stake,0);
  const payouts = race.bets.filter(b=>b.payout > 0).reduce((s,b)=>s+b.payout,0);
  $("results").classList.remove("hidden");
  $("results").innerHTML = `<h3>🏆 Final result</h3><p>Winner: <strong class="winner">${winner ? esc(winner.name) : "Not available"}</strong></p><p>Pool: ${money(pool)} credits · Paid out: ${money(payouts)} credits</p><p>Finishing order: ${[...race.horses].sort((a,b)=>(a.finishPosition||999)-(b.finishPosition||999)).map(h=>`${h.finishPosition || "—"}. ${esc(h.name)}`).join(" · ")}</p>`;
}
$("betForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const result = await api("/api/bets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raceId: $("betRaceId").value, horseId: $("betHorse").value, stake: Number($("stake").value) }) });
    showNotice(`${result.message} Ticket: ${result.ticket.ticketId.slice(0,8)}. Balance: ${money(result.balance)} credits.`);
    await refreshWallet(); await loadRaces(); await openRace(selectedRace._id); await loadHistory();
  } catch (e) { showNotice(e.message, true); }
});
$("importForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData();
  if ($("metadataFile").files[0]) form.append("metadataFile", $("metadataFile").files[0]);
  if ($("horseCsv").files[0]) form.append("horseCsv", $("horseCsv").files[0]);
  form.append("metadataText", $("metadataText").value);
  form.append("horseRows", $("horseRows").value);
  try {
    const result = await api("/api/races/import", { method: "POST", body: form });
    showNotice(result.message);
    $("importForm").reset();
    await loadRaces(); await openRace(result.race._id);
  } catch (e) { showNotice(e.message, true); }
});
async function deleteRace(id) {
  if (!confirm("Delete this race? This is only allowed before bets are placed.")) return;
  try { await api(`/api/races/${id}`, { method: "DELETE" }); showNotice("Race deleted."); await loadRaces(); }
  catch (e) { showNotice(e.message, true); }
}
async function loadHistory() {
  try {
    const bets = await api("/api/bets/mine");
    $("historyRows").innerHTML = bets.length ? bets.map(b=>`<tr><td>${esc(b.raceName)}</td><td>${esc(b.horseName)}</td><td>${money(b.stake)}</td><td>${esc(b.status)}</td><td>${money(b.payout)}</td></tr>`).join("") : '<tr><td colspan="5" class="muted">No bets yet.</td></tr>';
  } catch (e) { showNotice(e.message, true); }
}
$("refreshBtn").onclick = async () => { await loadRaces(); await refreshWallet(); showNotice("Races refreshed."); };
$("historyBtn").onclick = loadHistory;
$("resetWallet").onclick = async () => {
  if (!confirm("Reset the demo wallet to 10,000 credits? Existing tickets will remain in history.")) return;
  try { await api("/api/wallet/reset", { method: "POST" }); await refreshWallet(); showNotice("Demo wallet reset."); }
  catch (e) { showNotice(e.message, true); }
};
(async function init() {
  try { await refreshWallet(); await loadRaces(); await loadHistory(); }
  catch (e) { showNotice(e.message, true); }
})();
window.openRace = openRace;
window.pickHorse = pickHorse;
window.deleteRace = deleteRace;
