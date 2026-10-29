
/* =========================================================
   BETKEIBA — MAIN APPLICATION
========================================================= */

const $ = id => document.getElementById(id);

let me = null;
let races = [];
let selectedRace = null;
let authMode = 'login';

const money = n =>
    Number(n || 0).toLocaleString('en-US');

const esc = v =>
    String(v ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));

/* =========================================================
   API & NOTIFICATIONS
========================================================= */

function notice(message, error = false) {
    const el = $('notice');

    el.textContent = message;
    el.classList.remove('hidden', 'error');

    if (error) el.classList.add('error');

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

async function api(url, options = {}) {
    const r = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: {
            ...(options.body instanceof FormData
                ? {}
                : { 'Content-Type': 'application/json' }),
            ...(options.headers || {})
        }
    });

    const d = await r.json().catch(() => ({}));

    if (!r.ok) {
        throw new Error(
            d.error || `Request failed (${r.status})`
        );
    }

    return d;
}

/* =========================================================
   AUTHENTICATION
========================================================= */

function setAuthMode(mode) {
    authMode = mode;

    $('loginTab').classList.toggle(
        'active',
        mode === 'login'
    );

    $('registerTab').classList.toggle(
        'active',
        mode === 'register'
    );

    $('authSubmit').textContent =
        mode === 'login' ? 'Log in' : 'Create account';

    $('authPassword').autocomplete =
        mode === 'login'
            ? 'current-password'
            : 'new-password';

    $('authHelp').textContent =
        mode === 'login'
            ? 'Use your Betkeiba account credentials.'
            : 'Use at least 10 characters. Usernames can contain letters, numbers, dots, dashes, and underscores.';
}

$('loginTab').onclick = () =>
    setAuthMode('login');

$('registerTab').onclick = () =>
    setAuthMode('register');

$('authForm').onsubmit = async e => {
    e.preventDefault();

    try {
        const d = await api(
            `/api/auth/${authMode}`,
            {
                method: 'POST',
                body: JSON.stringify({
                    username: $('authUsername').value.trim(),
                    password: $('authPassword').value
                })
            }
        );

        me = d.user;
        $('authPassword').value = '';

        await showApp();

        notice(
            authMode === 'login'
                ? 'Welcome back.'
                : 'Account created. Your virtual credits are ready.'
        );

    } catch (err) {
        notice(err.message, true);
    }
};

$('logoutBtn').onclick = async () => {
    try {
        await api('/api/auth/logout', {
            method: 'POST',
            body: '{}'
        });

        me = null;
        selectedRace = null;

        $('appView').classList.add('hidden');
        $('nav').classList.add('hidden');
        $('authView').classList.remove('hidden');

        notice('You have logged out.');

    } catch (e) {
        notice(e.message, true);
    }
};

/* =========================================================
   APPLICATION STARTUP
========================================================= */

async function boot() {
    try {
        const d = await api('/api/auth/me');

        if (d.user) {
            me = d.user;
            await showApp();
        }

    } catch (e) {
        notice(e.message, true);
    }
}

async function showApp() {
    $('authView').classList.add('hidden');
    $('appView').classList.remove('hidden');
    $('nav').classList.remove('hidden');

    $('navUser').textContent = me.username;
    $('welcomeName').textContent = me.username;
    $('rolePill').textContent = me.role.toUpperCase();

    $('adminPanel').classList.toggle(
        'hidden',
        me.role !== 'admin'
    );

    $('manualResult').classList.toggle(
        'hidden',
        me.role !== 'admin'
    );

    $('horseManager').classList.toggle(
        'hidden',
        me.role !== 'admin'
    );

    await refreshWallet();
    await loadRaces();
    await loadHistory();

    if (me.role === 'admin') {
        await loadUsers();
    }
}

/* =========================================================
   WALLET
========================================================= */

async function refreshWallet() {
    const w = await api('/api/wallet');

    $('balance').textContent = money(w.balance);
}

/* =========================================================
   RACE LIST
========================================================= */

async function loadRaces() {
    races = await api('/api/races');

    $('raceCount').textContent =
        `${races.length} race${races.length === 1 ? '' : 's'}`;

    const host = $('raceList');

    if (!races.length) {
        host.innerHTML = `
            <div class="panel">
                <h3>No racecards yet</h3>
                <p class="muted">
                    An administrator can create a race or import
                    a racecard. No demo races are preloaded.
                </p>
            </div>
        `;

        return;
    }

    host.innerHTML = races.map(r => `
        <article class="race-card">

            <span class="pill ${esc(r.status)}">
                ${esc(r.status)}
            </span>

            <h3>
                ${esc(r.name)}
                ${esc(r.raceNumber || '')}
            </h3>

            <p class="race-meta">
                ${esc(r.venue)} · ${esc(r.date || 'Date not set')}
                <br>
                ${r.distance ? `${esc(r.distance)} m · ` : ''}
                ${esc(r.surface || 'Turf')} ·
                ${r.horses.length} runners
            </p>

            <div class="race-card-footer">
                <span class="muted small">
                    Pool:
                    ${money(
                        r.bets.reduce(
                            (s, b) => s + b.stake,
                            0
                        )
                    )}
                    credits
                </span>

                <button
                    class="btn btn-primary"
                    onclick="openRace('${r._id}')"
                >
                    View race →
                </button>
            </div>

        </article>
    `).join('');
}

/* =========================================================
   OPEN SELECTED RACE
========================================================= */

async function openRace(id) {
    try {
        selectedRace = await api(`/api/races/${id}`);

        const pool = await api(`/api/races/${id}/pool`);

        $('selectedRace').classList.remove('hidden');

        $('raceTitle').textContent =
            `${selectedRace.name} ${selectedRace.raceNumber || ''}`;

        $('raceMeta').textContent =
            `${selectedRace.venue} · ${selectedRace.date || 'Date not set'} · ` +
            `${selectedRace.distance ? selectedRace.distance + ' m · ' : ''}` +
            `${selectedRace.surface} · Pool ${money(pool.totalPool)} credits · ` +
            `Takeout ${selectedRace.takeRate}%`;

        $('raceStatus').textContent =
            selectedRace.status;

        $('raceStatus').className =
            `pill ${selectedRace.status}`;

        /* Betting horse options */

        $('betHorse').innerHTML =
            selectedRace.horses.map(h => `
                <option value="${h._id}">
                    ${h.horseNo}. ${esc(h.name)}
                </option>
            `).join('');

        /* Racecard table */

        $('horseRows').innerHTML =
            selectedRace.horses.map(h => {
                const p = pool.horses.find(
                    x => x.horseId === String(h._id)
                );

                return `
                    <tr>
                        <td>${h.horseNo}</td>

                        <td>
                            <strong>${esc(h.name)}</strong>
                            ${h.finishPosition
                                ? `<br><span class="muted">
                                    Finish: ${h.finishPosition}
                                   </span>`
                                : ''}
                        </td>

                        <td>
                            ${esc(h.sire)} / ${esc(h.dam)}
                        </td>

                        <td>${esc(h.lastRace)}</td>

                        <td>${money(p?.amountBet)} cr</td>

                        <td>
                            ${p?.indicativeReturnPerCredit
                                ? Number(
                                    p.indicativeReturnPerCredit
                                  ).toFixed(2) + '×'
                                : '—'}
                        </td>
                    </tr>
                `;
            }).join('');

        /* Betting availability */

        const bettingOpen =
            selectedRace.status === 'open';

        $('betForm').querySelector('button').disabled =
            !bettingOpen;

        $('betHorse').disabled = !bettingOpen;
        $('stake').disabled = !bettingOpen;

        /* Admin race controls */

        const acts = $('raceActions');

        acts.innerHTML = '';

        acts.classList.toggle(
            'hidden',
            me.role !== 'admin'
        );

        if (me.role === 'admin') {

            if (selectedRace.status === 'open') {
                acts.append(
                    actionBtn(
                        'Close betting',
                        () => raceAction('close')
                    )
                );
            }

            if (
                selectedRace.status === 'closed' &&
                !selectedRace.winnerHorseId
            ) {
                acts.append(
                    actionBtn(
                        'Simulate result (fictional)',
                        () => raceAction('simulate')
                    )
                );

                acts.append(
                    actionBtn(
                        'Enter official result',
                        () => {
                            $('manualResult').classList.remove('hidden');

                            renderPositions();

                            $('manualResult').scrollIntoView({
                                behavior: 'smooth'
                            });
                        },
                        'btn btn-quiet'
                    )
                );
            }

            if (
                selectedRace.status === 'closed' &&
                selectedRace.winnerHorseId
            ) {
                acts.append(
                    actionBtn(
                        'Settle payouts',
                        () => raceAction('settle')
                    )
                );
            }

            if (
                selectedRace.status === 'open' &&
                selectedRace.bets.length === 0
            ) {
                acts.append(
                    actionBtn(
                        'Delete race',
                        () => deleteRace(selectedRace._id),
                        'btn btn-danger'
                    )
                );
            }
        }

        /* Horse Management */

        $('horseManager').classList.toggle(
            'hidden',
            me.role !== 'admin'
        );

        if (me.role === 'admin') {
            renderManagedHorses();
            clearHorseEditor();
        }

        /* Finished race result */

        if (selectedRace.status === 'finished') {
            const paid = selectedRace.bets.reduce(
                (s, b) => s + b.payout,
                0
            );

            $('raceResult').classList.remove('hidden');

            $('raceResult').innerHTML = `
                <h3>Official final result</h3>

                <p>
                    ${
                        [...selectedRace.horses]
                            .filter(h => h.finishPosition)
                            .sort(
                                (a, b) =>
                                    a.finishPosition - b.finishPosition
                            )
                            .map(h =>
                                `${h.finishPosition}. ${esc(h.name)}`
                            )
                            .join(' · ')
                    }
                </p>

                <p class="muted small">
                    Total pool: ${money(selectedRace.totalPool)}
                    credits · Ticket payouts: ${money(paid)}
                    credits
                </p>
            `;

        } else {
            $('raceResult').classList.add('hidden');
        }

        /* Manual result form visibility */

        $('manualResult').classList.toggle(
            'hidden',
            !(
                me.role === 'admin' &&
                selectedRace.status === 'closed' &&
                !selectedRace.settledAt
            )
        );

        if (
            me.role === 'admin' &&
            selectedRace.status === 'closed' &&
            !selectedRace.settledAt
        ) {
            renderPositions();
        }

        $('selectedRace').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });

    } catch (e) {
        notice(e.message, true);
    }
}

/* =========================================================
   BUTTON HELPER
========================================================= */

function actionBtn(
    text,
    cb,
    cls = 'btn btn-primary'
) {
    const b = document.createElement('button');

    b.className = cls;
    b.textContent = text;
    b.onclick = cb;

    return b;
}

/* =========================================================
   MANUAL RACE RESULTS — TOP FIVE
========================================================= */

function renderPositions() {
    if (!selectedRace) return;

    const places = [1, 2, 3, 4, 5];

    $('resultPositions').innerHTML =
        selectedRace.horses.map(h => `
            <label>
                <span>
                    ${h.horseNo}. ${esc(h.name)}
                </span>

                <select
                    data-horse-id="${h._id}"
                    aria-label="Finishing position for ${esc(h.name)}"
                >
                    <option value="">
                        Unplaced / DNF
                    </option>

                    ${places.map(pos => `
                        <option
                            value="${pos}"
                            ${h.finishPosition === pos ? 'selected' : ''}
                        >
                            ${pos}${pos === 1
                                ? 'st'
                                : pos === 2
                                    ? 'nd'
                                    : pos === 3
                                        ? 'rd'
                                        : 'th'
                            } place
                        </option>
                    `).join('')}

                </select>
            </label>
        `).join('');
}

$('resultForm').onsubmit = async e => {
    e.preventDefault();

    try {
        const vals = [
            ...$('resultPositions').querySelectorAll('select')
        ]
            .filter(x => x.value)
            .map(x => ({
                id: x.dataset.horseId,
                pos: Number(x.value)
            }));

        const positions = vals.map(x => x.pos);

        if (!vals.some(x => x.pos === 1)) {
            throw new Error(
                'Select the horse that finished 1st.'
            );
        }

        if (new Set(positions).size !== positions.length) {
            throw new Error(
                'Each finishing position from 1st to 5th can be assigned to only one horse.'
            );
        }

        vals.sort((a, b) => a.pos - b.pos);

        if (vals.some((x, i) => x.pos !== i + 1)) {
            throw new Error(
                'Enter positions consecutively from 1st. Leave unplaced horses blank.'
            );
        }

        const d = await api(
            `/api/races/${selectedRace._id}/results`,
            {
                method: 'POST',
                body: JSON.stringify({
                    finishOrder: vals.map(x => x.id)
                })
            }
        );

        notice(d.message);

        await loadRaces();
        await openRace(selectedRace._id);

    } catch (e) {
        notice(e.message, true);
    }
};

/* =========================================================
   RACE ACTIONS & PAYOUTS
========================================================= */

async function raceAction(action) {
    try {
        const d = await api(
            `/api/races/${selectedRace._id}/${action}`,
            {
                method: 'POST',
                body: '{}'
            }
        );

        notice(
            action === 'simulate'
                ? `Fictional simulation winner: ${d.winner.name}. You can settle payouts.`
                : d.message
        );

        await refreshWallet();
        await loadRaces();
        await openRace(selectedRace._id);
        await loadHistory();

    } catch (e) {
        notice(e.message, true);
    }
}

/* =========================================================
   BET PLACEMENT
========================================================= */

$('betForm').onsubmit = async e => {
    e.preventDefault();

    try {
        const d = await api('/api/bets', {
            method: 'POST',
            body: JSON.stringify({
                raceId: selectedRace._id,
                horseId: $('betHorse').value,
                stake: Number($('stake').value)
            })
        });

        notice(
            `${d.message} Ticket ${d.ticket.ticketId.slice(0, 8)} · balance ${money(d.balance)} credits.`
        );

        await refreshWallet();
        await loadRaces();
        await openRace(selectedRace._id);
        await loadHistory();

    } catch (e) {
        notice(e.message, true);
    }
};

/* =========================================================
   DELETE RACE
========================================================= */

async function deleteRace(id) {
    if (!confirm(
        'Delete this race? This is only allowed before bets are placed.'
    )) return;

    try {
        await api(`/api/races/${id}`, {
            method: 'DELETE'
        });

        $('selectedRace').classList.add('hidden');

        notice('Race deleted.');

        await loadRaces();

    } catch (e) {
        notice(e.message, true);
    }
}

/* =========================================================
   CREATE RACE
========================================================= */

$('createRaceForm').onsubmit = async e => {
    e.preventDefault();

    const f = new FormData(e.currentTarget);

    try {
        const horses = String(
            f.get('horses') || ''
        )
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(Boolean)
            .map((line, i) => {
                const m = line.match(
                    /^\s*(\d+)\s*[,;\t]\s*(.+)$/
                );

                if (!m) {
                    throw new Error(
                        `Runner line ${i + 1} must be formatted: horse number, horse name`
                    );
                }

                return {
                    gate: Number(m[1]),
                    horseNo: Number(m[1]),
                    name: m[2].trim(),
                    abilityScore: 50
                };
            });

        if (horses.length < 2) {
            throw new Error('Add at least two runners.');
        }

        const d = await api('/api/races', {
            method: 'POST',
            body: JSON.stringify({
                name: f.get('name'),
                venue: f.get('venue'),
                date: f.get('date'),
                raceNumber: f.get('raceNumber'),
                distance: f.get('distance')
                    ? Number(f.get('distance'))
                    : null,
                surface: f.get('surface'),
                takeRate: Number(f.get('takeRate')),
                horses
            })
        });

        e.currentTarget.reset();

        notice('Race created.');

        await loadRaces();
        await openRace(d._id);

    } catch (e) {
        notice(e.message, true);
    }
};

/* =========================================================
   IMPORT RACE
========================================================= */

$('importForm').onsubmit = async e => {
    e.preventDefault();

    const form = new FormData();

    if ($('metadataFile').files[0]) {
        form.append(
            'metadataFile',
            $('metadataFile').files[0]
        );
    }

    if ($('horseCsv').files[0]) {
        form.append(
            'horseCsv',
            $('horseCsv').files[0]
        );
    }

    try {
        const d = await api(
            '/api/races/import',
            {
                method: 'POST',
                body: form
            }
        );

        e.currentTarget.reset();

        notice(d.message);

        await loadRaces();
        await openRace(d.race._id);

    } catch (e) {
        notice(e.message, true);
    }
};

/* =========================================================
   HORSE MANAGEMENT — CLEAR EDITOR
========================================================= */

function clearHorseEditor() {
    const form = $('horseEditor');

    if (!form) return;

    form.reset();

    form.elements.namedItem('horseId').value = '';

    $('horseEditorTitle').textContent = 'Add New Horse';

    const submit = form.querySelector(
        'button[type="submit"]'
    );

    if (submit) {
        submit.textContent = 'Add Horse';
    }
}

/* =========================================================
   HORSE MANAGEMENT — RENDER HORSE LIST
========================================================= */

function renderManagedHorses() {
    if (!selectedRace || me.role !== 'admin') return;

    const rows = $('managedHorseRows');

    if (!rows) return;

    if (!selectedRace.horses.length) {
        rows.innerHTML = `
            <tr>
                <td colspan="7" class="horse-empty">
                    No horses have been added to this race yet.
                </td>
            </tr>
        `;

        return;
    }

    rows.innerHTML = selectedRace.horses.map(h => `
        <tr>
            <td>
                ${esc(h.horseNo)}
            </td>

            <td>
                <strong class="horse-name">
                    ${esc(h.name)}
                </strong>
            </td>

            <td>
                ${esc(h.abilityScore ?? '—')}
            </td>

            <td>
                ${esc(h.gate ?? '—')}
            </td>

            <td>
                ${esc(h.bracket ?? '—')}
            </td>

            <td>
                ${esc(h.lastRace || '—')}
            </td>

            <td>
                <div class="horse-actions">

                    <button
                        type="button"
                        class="btn btn-quiet"
                        data-horse-action="edit"
                        data-horse-id="${h._id}"
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        class="btn btn-danger"
                        data-horse-action="delete"
                        data-horse-id="${h._id}"
                    >
                        Delete
                    </button>

                </div>
            </td>
        </tr>
    `).join('');
}

/* =========================================================
   HORSE MANAGEMENT — EDIT HORSE
========================================================= */

function editHorse(id) {
    if (!selectedRace || me.role !== 'admin') return;

    const horse = selectedRace.horses.find(
        h => String(h._id) === String(id)
    );

    if (!horse) {
        notice('Horse could not be found.', true);
        return;
    }

    const form = $('horseEditor');

    form.elements.namedItem('horseId').value =
        horse._id;

    form.elements.namedItem('name').value =
        horse.name || '';

    form.elements.namedItem('horseNo').value =
        horse.horseNo ?? '';

    form.elements.namedItem('abilityScore').value =
        horse.abilityScore ?? 50;

    form.elements.namedItem('gate').value =
        horse.gate ?? '';

    form.elements.namedItem('bracket').value =
        horse.bracket ?? '';

    form.elements.namedItem('post').value =
        horse.post ?? '';

    form.elements.namedItem('sire').value =
        horse.sire || '';

    form.elements.namedItem('dam').value =
        horse.dam || '';

    form.elements.namedItem('damsire').value =
        horse.damsire || '';

    form.elements.namedItem('lastRace').value =
        horse.lastRace || '';

    $('horseEditorTitle').textContent =
        `Edit Horse: ${horse.name}`;

    const submit = form.querySelector(
        'button[type="submit"]'
    );

    if (submit) {
        submit.textContent = 'Save Changes';
    }

    form.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });
}

/* =========================================================
   HORSE MANAGEMENT — ADD / UPDATE HORSE
========================================================= */

$('horseEditor').onsubmit = async e => {
    e.preventDefault();

    if (!selectedRace || me.role !== 'admin') {
        notice('Administrator access is required.', true);
        return;
    }

    const form = e.currentTarget;
    const f = new FormData(form);

    const horseId = String(
        f.get('horseId') || ''
    ).trim();

    const name = String(
        f.get('name') || ''
    ).trim();

    const horseNo = Number(
        f.get('horseNo')
    );

    const abilityScore = Number(
        f.get('abilityScore')
    );

    if (!name) {
        notice('Enter the horse name.', true);
        return;
    }

    if (
        !Number.isSafeInteger(horseNo) ||
        horseNo < 1
    ) {
        notice('Enter a valid horse number.', true);
        return;
    }

    if (
        !Number.isFinite(abilityScore) ||
        abilityScore < 0
    ) {
        notice('Enter a valid ability score.', true);
        return;
    }

    const horseData = {
        name,
        horseNo,
        abilityScore,

        gate: f.get('gate')
            ? Number(f.get('gate'))
            : null,

        bracket: f.get('bracket')
            ? Number(f.get('bracket'))
            : null,

        post: f.get('post')
            ? Number(f.get('post'))
            : null,

        sire: String(f.get('sire') || '').trim(),
        dam: String(f.get('dam') || '').trim(),
        damsire: String(f.get('damsire') || '').trim(),
        lastRace: String(f.get('lastRace') || '').trim()
    };

    try {
        if (horseId) {
            await api(
                `/api/races/${selectedRace._id}/horses/${horseId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(horseData)
                }
            );

            notice(`${name} updated successfully.`);

        } else {
            await api(
                `/api/races/${selectedRace._id}/horses`,
                {
                    method: 'POST',
                    body: JSON.stringify(horseData)
                }
            );

            notice(`${name} added to the race.`);
        }

        await loadRaces();
        await openRace(selectedRace._id);

    } catch (err) {
        notice(err.message, true);
    }
};

/* =========================================================
   HORSE MANAGEMENT — DELETE HORSE
========================================================= */

async function deleteHorse(id) {
    if (!selectedRace || me.role !== 'admin') return;

    const horse = selectedRace.horses.find(
        h => String(h._id) === String(id)
    );

    if (!horse) {
        notice('Horse could not be found.', true);
        return;
    }

    if (!confirm(
        `Delete ${horse.name} from this race?`
    )) return;

    try {
        await api(
            `/api/races/${selectedRace._id}/horses/${id}`,
            {
                method: 'DELETE'
            }
        );

        notice(`${horse.name} removed from the race.`);

        await loadRaces();
        await openRace(selectedRace._id);

    } catch (err) {
        notice(err.message, true);
    }
}

/* =========================================================
   HORSE MANAGEMENT — BUTTON EVENTS
========================================================= */

$('managedHorseRows').addEventListener(
    'click',
    e => {
        const button = e.target.closest(
            '[data-horse-action]'
        );

        if (!button) return;

        const id = button.dataset.horseId;
        const action = button.dataset.horseAction;

        if (action === 'edit') {
            editHorse(id);
        }

        if (action === 'delete') {
            deleteHorse(id);
        }
    }
);

$('horseEditorCancel').onclick = () => {
    clearHorseEditor();
};

/* =========================================================
   BETTING HISTORY
========================================================= */

async function loadHistory() {
    try {
        const bets = await api('/api/bets/mine');

        $('historyList').innerHTML = bets.length
            ? bets.map(b => `
                <div class="history-item">

                    <strong>
                        ${esc(b.horseName)}
                    </strong>

                    <small>
                        ${esc(b.raceName)} · ${esc(b.status)}
                    </small>

                    <div>
                        ${money(b.stake)} staked ·
                        ${money(b.payout)} payout
                    </div>

                    <small>
                        Ticket ${esc(String(b.ticketId).slice(0, 8))}
                    </small>

                </div>
            `).join('')
            : `
                <p class="muted small">
                    No bets yet. Choose a race to place your first ticket.
                </p>
            `;

    } catch (e) {
        $('historyList').innerHTML = `
            <p class="muted">
                ${esc(e.message)}
            </p>
        `;
    }
}

/* =========================================================
   ADMIN — USER MANAGEMENT
========================================================= */

async function loadUsers() {
    if (me.role !== 'admin') return;

    try {
        const users = await api('/api/admin/users');

        $('userRows').innerHTML = users.map(u => `
            <tr>

                <td>${esc(u.username)}</td>

                <td>${esc(u.role)}</td>

                <td>${money(u.balance)}</td>

                <td>
                    ${u.active ? 'Active' : 'Disabled'}
                </td>

                <td>

                    <button
                        class="btn btn-quiet"
                        onclick="adjustCredits('${u.id}','${esc(u.username)}')"
                    >
                        ± Credits
                    </button>

                    <button
                        class="btn btn-quiet"
                        onclick="toggleUser('${u.id}',${!u.active})"
                    >
                        ${u.active ? 'Disable' : 'Enable'}
                    </button>

                    <button
                        class="btn btn-quiet"
                        onclick="changeRole('${u.id}','${u.role === 'admin' ? 'user' : 'admin'}')"
                    >
                        Make ${u.role === 'admin' ? 'user' : 'admin'}
                    </button>

                </td>

            </tr>
        `).join('') || `
            <tr>
                <td colspan="5">No users yet.</td>
            </tr>
        `;

    } catch (e) {
        notice(e.message, true);
    }
}

/* =========================================================
   ADMIN — ADJUST USER CREDITS
========================================================= */

window.adjustCredits = async (id, username) => {
    const amount = prompt(
        `Adjust ${username}'s balance. Use a positive number to add or negative to deduct.`
    );

    if (amount === null) return;

    const n = Number(amount);

    if (!Number.isSafeInteger(n) || n === 0) {
        notice('Enter a non-zero whole number.', true);
        return;
    }

    try {
        const d = await api(
            `/api/admin/users/${id}/credits`,
            {
                method: 'POST',
                body: JSON.stringify({
                    amount: n,
                    note: `Admin adjustment by ${me.username}`
                })
            }
        );

        notice(
            `${username}'s balance is now ${money(d.balance)} credits.`
        );

        await loadUsers();

    } catch (e) {
        notice(e.message, true);
    }
};

/* =========================================================
   ADMIN — ENABLE / DISABLE USER
========================================================= */

window.toggleUser = async (id, active) => {
    try {
        await api(
            `/api/admin/users/${id}`,
            {
                method: 'PATCH',
                body: JSON.stringify({ active })
            }
        );

        notice('Account status updated.');

        await loadUsers();

    } catch (e) {
        notice(e.message, true);
    }
};

/* =========================================================
   ADMIN — CHANGE USER ROLE
========================================================= */

window.changeRole = async (id, role) => {
    if (!confirm(
        `Change this account role to ${role}?`
    )) return;

    try {
        await api(
            `/api/admin/users/${id}`,
            {
                method: 'PATCH',
                body: JSON.stringify({ role })
            }
        );

        notice('Account role updated.');

        await loadUsers();

    } catch (e) {
        notice(e.message, true);
    }
};

/* =========================================================
   NAVIGATION & REFRESH BUTTONS
========================================================= */

$('refreshBtn').onclick = async () => {
    try {
        await loadRaces();
        await refreshWallet();

        notice('Racecards refreshed.');

    } catch (e) {
        notice(e.message, true);
    }
};

$('historyBtn').onclick = () => {
    $('historyList').scrollIntoView({
        behavior: 'smooth'
    });

    loadHistory();
};

$('reloadUsers').onclick = loadUsers;

/* =========================================================
   GLOBAL RACE FUNCTION
========================================================= */

window.openRace = openRace;

/* =========================================================
   START APPLICATION
========================================================= */

boot();
