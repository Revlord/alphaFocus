/* ============================================================
   AlphaFocus — Renderer
   ============================================================ */

// ----- Game state -----
let xp = 0;
let level = 1;
let gold = 0;
let xpToNextLevel = 2500;
let quests = [];
let completedQuests = [];
let rewards = [];
let habits = [];
let habitHistory = {};

// ----- Session state -----
let activeQuest = null;           // the quest object being worked
let activeMode = 'stopwatch';     // 'stopwatch' | 'timer'
let timerDurationMs = 25 * 60 * 1000;
let elapsedMs = 0;                // total elapsed working time
let segmentStart = 0;             // start timestamp for current running segment
let tickerInterval = null;
let isRunning = false;
let activeQuestStartedAt = null;  // real-world start time for history
let warnedAtEnd = false;          // for timer visual warning / chime

// ----- UI state -----
let currentPriorityFilter = 'all';
let currentTagFilter = null;
let currentSearch = '';
let currentHabitFilter = 'all';
let soundEnabled = true;

// ----- Achievements -----
let achievements = [
    { id: 1,  name: "Ten minutes",         desc: "Focus for 10 minutes in one session",           xp: 500,   completed: false, cond: () => completedQuests.some(q => q.duration >= 600000) },
    { id: 2,  name: "Five long sessions",  desc: "Finish five 30-minute (or longer) sessions",    xp: 1250,  completed: false, cond: () => completedQuests.filter(q => q.duration >= 1800000).length >= 5 },
    { id: 3,  name: "Heavy day",           desc: "Log 3 hours of focus in one day",               xp: 5000,  completed: false, cond: () => focusTimeToday() >= 10800000 },
    { id: 4,  name: "Thousand gold",       desc: "Save up 1,000 gold",                            xp: 2500,  completed: false, cond: () => gold >= 1000 },
    { id: 5,  name: "Fifty sessions",      desc: "Complete 50 focus sessions",                   xp: 3750,  completed: false, cond: () => completedQuests.length >= 50 },
    { id: 6,  name: "Short session",       desc: "Finish a session in under 5 minutes",          xp: 1000,  completed: false, cond: () => completedQuests.some(q => q.duration < 300000) },
    { id: 7,  name: "First habit",         desc: "Create your first habit",                      xp: 250,   completed: false, cond: () => habits.length >= 1 },
    { id: 8,  name: "Week streak",         desc: "Keep a 7-day streak on any habit",             xp: 1500,  completed: false, cond: () => habits.some(h => getHabitStreak(h.id) >= 7) },
    { id: 9,  name: "Month streak",        desc: "Keep a 30-day streak on any habit",            xp: 5000,  completed: false, cond: () => habits.some(h => getHabitStreak(h.id) >= 30) },
    { id: 10, name: "Full day",            desc: "Complete 5 different habits in one day",       xp: 2500,  completed: false, cond: () => checkMultiHabitDay() },
    { id: 11, name: "Hundred days",        desc: "Reach a 100-day streak on any habit",          xp: 10000, completed: false, cond: () => habits.some(h => getHabitStreak(h.id) >= 100) },
    { id: 12, name: "Timer mode",          desc: "Finish a session using the timer",             xp: 500,   completed: false, cond: () => completedQuests.some(q => q.mode === 'timer') },
    { id: 13, name: "A few tags",          desc: "Use at least 3 different tags on sessions",    xp: 500,   completed: false, cond: () => new Set(quests.concat(completedQuests).flatMap(q => q.tags || [])).size >= 3 }
];

const ranks = [
    { level: 1,   name: "Starter" },
    { level: 6,   name: "Casual" },
    { level: 11,  name: "Regular" },
    { level: 16,  name: "Steady" },
    { level: 21,  name: "Habit" },
    { level: 31,  name: "Routine" },
    { level: 41,  name: "Rhythm" },
    { level: 51,  name: "Groove" },
    { level: 61,  name: "Flow" },
    { level: 71,  name: "Momentum" },
    { level: 81,  name: "Comfortable" },
    { level: 91,  name: "Natural" },
    { level: 101, name: "Easy" },
    { level: 126, name: "Second nature" },
    { level: 151, name: "Day in, day out" },
    { level: 176, name: "Just how it is" },
    { level: 201, name: "No sweat" }
];

/* ============================================================
   Boot
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    loadGameState();
    migrateLegacyState();

    wireTabs();
    wireQuickAdd();
    wireFilters();
    wireHabits();
    wireShop();
    wireHistoryFilters();
    wireActiveQuestBar();
    wireModals();
    wireSettings();

    renderAll();
    updateUI();

    // Keyboard shortcut: Enter in quick-add already triggers; Esc closes modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        }
    });
});

/* ============================================================
   Persistence
   ============================================================ */
function saveGameState() {
    const state = {
        xp, level, gold, xpToNextLevel,
        quests, completedQuests, rewards, habits, habitHistory,
        achievements: achievements.map(({ id, completed }) => ({ id, completed })),
        soundEnabled
    };
    localStorage.setItem('focusRPG_gameState', JSON.stringify(state));
}

function loadGameState() {
    const raw = localStorage.getItem('focusRPG_gameState');
    if (!raw) return;
    try {
        const s = JSON.parse(raw);
        xp = s.xp ?? 0;
        level = s.level ?? 1;
        gold = s.gold ?? 0;
        xpToNextLevel = s.xpToNextLevel ?? 2500;
        quests = s.quests ?? [];
        completedQuests = s.completedQuests ?? [];
        rewards = s.rewards ?? [];
        habits = s.habits ?? [];
        habitHistory = s.habitHistory ?? {};
        soundEnabled = s.soundEnabled ?? true;

        if (Array.isArray(s.achievements)) {
            s.achievements.forEach(saved => {
                const a = achievements.find(x => x.id === saved.id);
                if (a) a.completed = !!saved.completed;
            });
        }
    } catch (e) {
        console.error('Failed to load state:', e);
    }
}

// Migrate old data model (no lane/priority/tags) into new one
function migrateLegacyState() {
    quests.forEach((q, i) => {
        if (!q.lane) q.lane = 'today';
        if (!q.priority) q.priority = 'medium';
        if (!q.tags) q.tags = [];
        if (typeof q.order !== 'number') q.order = i;
    });
    completedQuests.forEach(q => {
        if (!q.mode) q.mode = 'stopwatch';
        if (!q.tags) q.tags = [];
    });
}

/* ============================================================
   Tab routing
   ============================================================ */
function wireTabs() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === target));
        });
    });
}

/* ============================================================
   Quick Add + parsing
   ============================================================ */
function wireQuickAdd() {
    const input = document.getElementById('quick-add-input');
    const btn = document.getElementById('quick-add-btn');
    const toggle = document.getElementById('toggle-detailed-add');
    const detailedAddBtn = document.getElementById('detailed-add-btn');
    const detailedPanel = document.getElementById('detailed-add');

    const submit = () => {
        const text = input.value.trim();
        if (!text) return;
        const quest = parseQuickAdd(text);
        if (!quest.name) { toast('Give your quest a name', 'danger'); return; }
        addQuest(quest);
        input.value = '';
    };

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

    toggle.addEventListener('click', () => detailedPanel.classList.toggle('hidden'));

    detailedAddBtn.addEventListener('click', () => {
        const name = document.getElementById('detailed-name').value.trim();
        if (!name) { toast('Give your quest a name', 'danger'); return; }
        const tagsRaw = document.getElementById('detailed-tags').value.trim();
        const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean) : [];
        const priority = document.getElementById('detailed-priority').value;
        const lane = document.getElementById('detailed-lane').value;
        const est = parseInt(document.getElementById('detailed-estimate').value) || null;
        const xpVal = parseInt(document.getElementById('detailed-xp').value) || 50;

        addQuest({ name, tags, priority, lane, estimatedMinutes: est, xpReward: xpVal });

        document.getElementById('detailed-name').value = '';
        document.getElementById('detailed-tags').value = '';
        document.getElementById('detailed-estimate').value = '';
        document.getElementById('detailed-xp').value = '50';
    });
}

function parseQuickAdd(text) {
    const q = { tags: [], priority: 'medium', lane: 'inbox', estimatedMinutes: null, xpReward: null };
    const tokens = text.split(/\s+/);
    const nameTokens = [];

    tokens.forEach(tok => {
        if (/^#[\w-]+$/i.test(tok)) {
            q.tags.push(tok.slice(1).toLowerCase());
        } else if (/^!(high|med|medium|low)$/i.test(tok)) {
            const p = tok.slice(1).toLowerCase();
            q.priority = p === 'med' ? 'medium' : p;
        } else if (/^>(inbox|today|later)$/i.test(tok)) {
            q.lane = tok.slice(1).toLowerCase();
        } else if (/^\d+h$/i.test(tok)) {
            q.estimatedMinutes = (q.estimatedMinutes || 0) + parseInt(tok) * 60;
        } else if (/^\d+m$/i.test(tok)) {
            q.estimatedMinutes = (q.estimatedMinutes || 0) + parseInt(tok);
        } else if (/^\d+h\d+m$/i.test(tok)) {
            const [, h, m] = tok.match(/^(\d+)h(\d+)m$/i);
            q.estimatedMinutes = (q.estimatedMinutes || 0) + parseInt(h) * 60 + parseInt(m);
        } else if (/^\d+xp$/i.test(tok)) {
            q.xpReward = parseInt(tok);
        } else {
            nameTokens.push(tok);
        }
    });

    q.name = nameTokens.join(' ').trim();

    // Sensible defaults for XP if not specified
    if (!q.xpReward) {
        if (q.estimatedMinutes) {
            // ~5 XP per estimated minute, scaled by priority
            const mult = q.priority === 'high' ? 1.5 : q.priority === 'low' ? 0.8 : 1;
            q.xpReward = Math.max(10, Math.round(q.estimatedMinutes * 5 * mult));
        } else {
            q.xpReward = 50;
        }
    }
    return q;
}

function addQuest({ name, xpReward = 50, tags = [], priority = 'medium', lane = 'inbox', estimatedMinutes = null }) {
    const laneQuests = quests.filter(q => q.lane === lane);
    const maxOrder = laneQuests.reduce((m, q) => Math.max(m, q.order ?? 0), -1);

    const quest = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name,
        xpReward,
        tags,
        priority,
        lane,
        estimatedMinutes,
        order: maxOrder + 1,
        timeAdded: new Date().toISOString()
    };
    quests.push(quest);
    renderLanes();
    renderTagFilters();
    saveGameState();
    toast(`✨ Added "${name}" to ${laneLabel(lane)}`);
}

function laneLabel(lane) {
    return { inbox: 'Inbox', today: 'Today', later: 'Later' }[lane] || lane;
}

/* ============================================================
   Filters (priority, tag, search)
   ============================================================ */
function wireFilters() {
    document.querySelectorAll('.priority-filters .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.priority-filters .chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentPriorityFilter = chip.dataset.priority;
            renderLanes();
        });
    });

    document.getElementById('quest-search').addEventListener('input', (e) => {
        currentSearch = e.target.value.toLowerCase().trim();
        renderLanes();
    });
}

function renderTagFilters() {
    const container = document.getElementById('tag-filters');
    const allTags = [...new Set(quests.flatMap(q => q.tags || []))].sort();
    if (allTags.length === 0) {
        container.innerHTML = '';
        currentTagFilter = null;
        return;
    }
    container.innerHTML = allTags.map(t =>
        `<button class="chip tag-chip ${currentTagFilter === t ? 'active' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`
    ).join('');
    container.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const t = chip.dataset.tag;
            currentTagFilter = currentTagFilter === t ? null : t;
            renderTagFilters();
            renderLanes();
        });
    });
}

function questMatchesFilters(q) {
    if (currentPriorityFilter !== 'all' && q.priority !== currentPriorityFilter) return false;
    if (currentTagFilter && !(q.tags || []).includes(currentTagFilter)) return false;
    if (currentSearch) {
        const hay = (q.name + ' ' + (q.tags || []).join(' ')).toLowerCase();
        if (!hay.includes(currentSearch)) return false;
    }
    return true;
}

/* ============================================================
   Lanes rendering + DnD
   ============================================================ */
function renderLanes() {
    ['inbox', 'today', 'later'].forEach(renderLane);
}

function renderLane(laneName) {
    const container = document.getElementById(`lane-${laneName}`);
    const countEl = document.getElementById(`count-${laneName}`);
    const laneQuests = quests
        .filter(q => q.lane === laneName)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    countEl.textContent = laneQuests.length;

    const visible = laneQuests.filter(questMatchesFilters);
    container.innerHTML = '';

    if (visible.length === 0) {
        const msg = laneQuests.length === 0
            ? (laneName === 'inbox' ? 'Drop new tasks here. Use quick-add above.' :
               laneName === 'today' ? 'Drag tasks here when you\'re ready.' :
               'Backlog. Out of sight, out of mind.')
            : 'No tasks match your filters.';
        const empty = document.createElement('div');
        empty.className = 'lane-empty';
        empty.textContent = msg;
        container.appendChild(empty);
    } else {
        visible.forEach(q => container.appendChild(createQuestCard(q)));
    }

    setupLaneDropZone(container, laneName);
}

function createQuestCard(quest) {
    const card = document.createElement('div');
    card.className = 'quest-card';
    card.draggable = true;
    card.dataset.questId = quest.id;
    card.dataset.priority = quest.priority;

    const tagsHtml = (quest.tags || [])
        .map(t => `<span class="qc-tag">#${escapeHtml(t)}</span>`).join('');

    const estHtml = quest.estimatedMinutes
        ? `<span class="qc-estimate"><i class="far fa-clock"></i>${quest.estimatedMinutes}m</span>`
        : '';

    card.innerHTML = `
        <div class="qc-row">
            <span class="qc-priority-dot ${quest.priority}"></span>
            <span class="qc-name">${escapeHtml(quest.name)}</span>
        </div>
        <div class="qc-meta">
            <span class="qc-xp"><i class="fas fa-star"></i>${quest.xpReward} XP</span>
            ${estHtml}
        </div>
        ${tagsHtml ? `<div class="qc-tags">${tagsHtml}</div>` : ''}
        <div class="qc-actions">
            <button class="qc-btn start" title="Start quest"><i class="fas fa-play"></i> Start</button>
            ${quest.lane !== 'today' ? `<button class="qc-btn" data-act="move-today" title="Move to Today"><i class="fas fa-bullseye"></i> Today</button>` : ''}
            ${quest.lane !== 'inbox' ? `<button class="qc-btn" data-act="move-inbox" title="Move to Inbox"><i class="fas fa-inbox"></i></button>` : ''}
            ${quest.lane !== 'later' ? `<button class="qc-btn" data-act="move-later" title="Move to Later"><i class="fas fa-box"></i></button>` : ''}
            <button class="qc-btn delete" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
    `;

    // DnD
    card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', String(quest.id));
        e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.drop-above, .drop-below').forEach(n => n.classList.remove('drop-above', 'drop-below'));
    });

    card.addEventListener('dragover', (e) => {
        e.preventDefault();
        const rect = card.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        card.classList.toggle('drop-above', !after);
        card.classList.toggle('drop-below', after);
    });
    card.addEventListener('dragleave', () => {
        card.classList.remove('drop-above', 'drop-below');
    });
    card.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = Number(e.dataTransfer.getData('text/plain'));
        const rect = card.getBoundingClientRect();
        const placeAfter = e.clientY > rect.top + rect.height / 2;
        moveQuest(draggedId, quest.lane, quest.id, placeAfter);
        card.classList.remove('drop-above', 'drop-below');
    });

    // Actions
    card.querySelector('.qc-btn.start').addEventListener('click', (e) => {
        e.stopPropagation();
        startQuest(quest.id);
    });
    card.querySelector('.qc-btn.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteQuest(quest.id);
    });
    card.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const act = btn.dataset.act;
            const targetLane = { 'move-today': 'today', 'move-inbox': 'inbox', 'move-later': 'later' }[act];
            moveQuestToLane(quest.id, targetLane);
        });
    });

    return card;
}

function setupLaneDropZone(listEl, laneName) {
    listEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        listEl.classList.add('drag-over');
    });
    listEl.addEventListener('dragleave', (e) => {
        if (e.target === listEl) listEl.classList.remove('drag-over');
    });
    listEl.addEventListener('drop', (e) => {
        e.preventDefault();
        listEl.classList.remove('drag-over');
        // If dropped on a card, card's own drop handler will have fired
        if (e.target.closest('.quest-card')) return;
        const draggedId = Number(e.dataTransfer.getData('text/plain'));
        moveQuest(draggedId, laneName, null, true);
    });
}

function moveQuestToLane(questId, lane) {
    moveQuest(questId, lane, null, true);
}

// Move quest to given lane, optionally relative to another quest
function moveQuest(questId, lane, relativeToId, placeAfter) {
    const q = quests.find(x => x.id === questId);
    if (!q) return;

    q.lane = lane;

    // Rebuild order for the target lane
    const laneQs = quests.filter(x => x.lane === lane && x.id !== questId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    let insertIdx = laneQs.length; // default: append
    if (relativeToId != null) {
        const i = laneQs.findIndex(x => x.id === relativeToId);
        if (i >= 0) insertIdx = placeAfter ? i + 1 : i;
    }
    laneQs.splice(insertIdx, 0, q);
    laneQs.forEach((quest, idx) => quest.order = idx);

    renderLanes();
    saveGameState();
}

function deleteQuest(questId) {
    const q = quests.find(x => x.id === questId);
    if (!q) return;
    if (!confirm(`Delete "${q.name}"?`)) return;
    quests = quests.filter(x => x.id !== questId);
    if (activeQuest && activeQuest.id === questId) cancelActiveQuest();
    renderLanes();
    renderTagFilters();
    saveGameState();
    toast('🗑️ Quest deleted');
}

/* ============================================================
   Active Quest Bar / Stopwatch / Timer
   ============================================================ */
function wireActiveQuestBar() {
    document.querySelectorAll('#aq-mode-switcher button').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isRunning) { toast('Pause first to switch modes', 'danger'); return; }
            setMode(btn.dataset.mode);
        });
    });

    document.querySelectorAll('.aq-timer-presets button').forEach(b => {
        b.addEventListener('click', () => {
            document.getElementById('aq-timer-minutes').value = b.dataset.min;
        });
    });

    document.getElementById('aq-start-btn').addEventListener('click', startTicker);
    document.getElementById('aq-pause-btn').addEventListener('click', pauseTicker);
    document.getElementById('aq-resume-btn').addEventListener('click', startTicker);
    document.getElementById('aq-complete-btn').addEventListener('click', completeActiveQuest);
    document.getElementById('aq-cancel-btn').addEventListener('click', () => {
        if (confirm('Cancel active quest? Progress will not be saved.')) cancelActiveQuest();
    });
}

function setMode(mode) {
    activeMode = mode;
    document.querySelectorAll('#aq-mode-switcher button').forEach(b =>
        b.classList.toggle('active', b.dataset.mode === mode)
    );
    document.getElementById('aq-mode-label').textContent = mode.toUpperCase();
    document.getElementById('aq-timer-input').classList.toggle('hidden', mode !== 'timer');
    // Reset warning state & redraw clock
    warnedAtEnd = false;
    document.getElementById('active-quest-bar').classList.remove('warning');
    updateClockDisplay();
}

function startQuest(questId) {
    const q = quests.find(x => x.id === questId);
    if (!q) return;
    if (activeQuest && activeQuest.id !== questId) {
        if (!confirm('You already have an active quest. Replace it?')) return;
        stopTicker();
    }
    activeQuest = q;
    elapsedMs = 0;
    segmentStart = 0;
    isRunning = false;
    warnedAtEnd = false;
    activeQuestStartedAt = new Date();

    // Pick a sensible default mode: if quest has estimate, default to timer
    const bar = document.getElementById('active-quest-bar');
    bar.classList.remove('hidden', 'running', 'warning');

    if (q.estimatedMinutes) {
        setMode('timer');
        document.getElementById('aq-timer-minutes').value = q.estimatedMinutes;
        timerDurationMs = q.estimatedMinutes * 60 * 1000;
    } else {
        setMode('stopwatch');
    }

    document.getElementById('aq-name').textContent = q.name;
    const metaParts = [];
    metaParts.push(`<i class="fas fa-star"></i> ${q.xpReward} XP`);
    if (q.priority) metaParts.push(`<span class="qc-priority-dot ${q.priority}" style="display:inline-block;vertical-align:middle;margin-right:4px;"></span>${q.priority}`);
    if (q.tags && q.tags.length) metaParts.push(q.tags.map(t => `#${escapeHtml(t)}`).join(' '));
    document.getElementById('aq-meta').innerHTML = metaParts.join('  ·  ');

    showStartControls();
    updateClockDisplay();

    // Switch to Focus tab
    document.querySelector('.nav-item[data-tab="focus"]').click();
    toast(`▶️ Starting: ${q.name}`);
}

function startTicker() {
    if (!activeQuest) return;
    if (activeMode === 'timer') {
        const minutes = parseInt(document.getElementById('aq-timer-minutes').value) || 25;
        if (elapsedMs === 0) timerDurationMs = minutes * 60 * 1000;
    }
    segmentStart = Date.now();
    isRunning = true;
    document.getElementById('active-quest-bar').classList.add('running');
    tickerInterval = setInterval(tick, 250);
    showRunningControls();
    tick();
}

function pauseTicker() {
    if (!isRunning) return;
    elapsedMs += Date.now() - segmentStart;
    isRunning = false;
    clearInterval(tickerInterval);
    tickerInterval = null;
    document.getElementById('active-quest-bar').classList.remove('running');
    showPausedControls();
    updateClockDisplay();
}

function stopTicker() {
    if (tickerInterval) clearInterval(tickerInterval);
    tickerInterval = null;
    if (isRunning) {
        elapsedMs += Date.now() - segmentStart;
        isRunning = false;
    }
    document.getElementById('active-quest-bar').classList.remove('running');
}

function tick() {
    updateClockDisplay();
    if (activeMode === 'timer') {
        const total = currentElapsed();
        if (!warnedAtEnd && total >= timerDurationMs) {
            warnedAtEnd = true;
            document.getElementById('active-quest-bar').classList.add('warning');
            pauseTicker();
            playChime();
            openTimerEndModal();
        }
    }
}

function currentElapsed() {
    return elapsedMs + (isRunning ? Date.now() - segmentStart : 0);
}

function updateClockDisplay() {
    const clockEl = document.getElementById('aq-clock');
    if (!activeQuest) {
        clockEl.textContent = '00:00:00';
        return;
    }
    const total = currentElapsed();
    if (activeMode === 'timer') {
        const remaining = Math.max(0, timerDurationMs - total);
        clockEl.textContent = formatClock(remaining);
    } else {
        clockEl.textContent = formatClock(total);
    }
}

function formatClock(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function showStartControls() {
    document.getElementById('aq-start-btn').classList.remove('hidden');
    document.getElementById('aq-pause-btn').classList.add('hidden');
    document.getElementById('aq-resume-btn').classList.add('hidden');
    document.getElementById('aq-complete-btn').classList.add('hidden');
}

function showRunningControls() {
    document.getElementById('aq-start-btn').classList.add('hidden');
    document.getElementById('aq-pause-btn').classList.remove('hidden');
    document.getElementById('aq-resume-btn').classList.add('hidden');
    document.getElementById('aq-complete-btn').classList.remove('hidden');
}

function showPausedControls() {
    document.getElementById('aq-start-btn').classList.add('hidden');
    document.getElementById('aq-pause-btn').classList.add('hidden');
    document.getElementById('aq-resume-btn').classList.remove('hidden');
    document.getElementById('aq-complete-btn').classList.remove('hidden');
}

function cancelActiveQuest() {
    stopTicker();
    activeQuest = null;
    elapsedMs = 0;
    activeQuestStartedAt = null;
    document.getElementById('active-quest-bar').classList.add('hidden');
    document.getElementById('active-quest-bar').classList.remove('running', 'warning');
}

function completeActiveQuest() {
    if (!activeQuest) return;
    stopTicker();

    const duration = elapsedMs;
    const mode = activeMode;
    const bonus = calculateBonusMultiplier(duration, mode);
    const earnedXP = Math.round(activeQuest.xpReward * bonus);
    const earnedGold = Math.round(earnedXP / 10);

    const endTime = new Date();
    const startTime = activeQuestStartedAt || new Date(endTime.getTime() - duration);

    const completed = {
        ...activeQuest,
        completedTime: endTime.toISOString(),
        duration,
        earnedXP,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        mode
    };
    completedQuests.push(completed);

    // Remove from active quest list
    const completedId = activeQuest.id;
    quests = quests.filter(q => q.id !== completedId);

    gainXP(earnedXP);
    gainGold(earnedGold);

    toast(`✅ Completed! +${earnedXP} XP, +${earnedGold} gold (${formatDuration(duration)})`, 'success');

    activeQuest = null;
    elapsedMs = 0;
    activeQuestStartedAt = null;
    document.getElementById('active-quest-bar').classList.add('hidden');
    document.getElementById('active-quest-bar').classList.remove('running', 'warning');

    renderAll();
    saveGameState();
}

function calculateBonusMultiplier(duration, mode) {
    let mult = 1;
    if (duration < 60000) mult = 1;
    else if (duration < 300000) mult = 1.2;
    else if (duration < 1800000) mult = 1.5;
    else if (duration < 3600000) mult = 1.8;
    else mult = 2;
    // Small bonus for using timer (completed focused blocks)
    if (mode === 'timer') mult *= 1.05;
    return mult;
}

/* ============================================================
   Timer-end modal
   ============================================================ */
function openTimerEndModal() {
    if (!activeQuest) return;
    document.getElementById('timer-end-quest-name').textContent = activeQuest.name;
    document.getElementById('timer-end-duration').textContent = formatDuration(elapsedMs);
    document.getElementById('timer-end-modal').classList.add('active');
}

function closeTimerEndModal() {
    document.getElementById('timer-end-modal').classList.remove('active');
}

function wireModals() {
    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('level-up-modal').classList.remove('active');
    });
    document.getElementById('close-redeem-modal').addEventListener('click', () => {
        document.getElementById('redeem-modal').classList.remove('active');
    });
    document.getElementById('close-streak-modal').addEventListener('click', () => {
        document.getElementById('streak-modal').classList.remove('active');
    });

    document.getElementById('timer-complete-btn').addEventListener('click', () => {
        closeTimerEndModal();
        completeActiveQuest();
    });
    document.getElementById('timer-extend-5').addEventListener('click', () => extendTimer(5));
    document.getElementById('timer-extend-10').addEventListener('click', () => extendTimer(10));
    document.getElementById('timer-overtime-btn').addEventListener('click', () => {
        closeTimerEndModal();
        setMode('stopwatch');
        // continue counting up from where we are
        startTicker();
    });

    document.getElementById('reset-game-btn').addEventListener('click', () => {
        document.getElementById('settings-modal').classList.remove('active');
        document.getElementById('reset-modal').classList.add('active');
        document.getElementById('reset-code').value = '';
        document.getElementById('reset-code').focus();
    });
    document.getElementById('cancel-reset-btn').addEventListener('click', () => {
        document.getElementById('reset-modal').classList.remove('active');
    });
    document.getElementById('confirm-reset-btn').addEventListener('click', attemptReset);

    // click backdrop to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });
}

function extendTimer(minutes) {
    closeTimerEndModal();
    timerDurationMs += minutes * 60 * 1000;
    warnedAtEnd = false;
    document.getElementById('active-quest-bar').classList.remove('warning');
    startTicker();
    toast(`⏰ Extended by ${minutes} min`);
}

/* ============================================================
   Settings
   ============================================================ */
function wireSettings() {
    document.getElementById('open-settings-btn').addEventListener('click', () => {
        document.getElementById('sound-toggle').checked = soundEnabled;
        document.getElementById('settings-modal').classList.add('active');
    });
    document.getElementById('close-settings-btn').addEventListener('click', () => {
        document.getElementById('settings-modal').classList.remove('active');
    });
    document.getElementById('sound-toggle').addEventListener('change', (e) => {
        soundEnabled = e.target.checked;
        saveGameState();
    });
}

function attemptReset() {
    const code = document.getElementById('reset-code').value;
    if (code !== 'grindfor2030') {
        toast('Incorrect code', 'danger');
        return;
    }
    xp = 0; level = 1; gold = 0; xpToNextLevel = 2500;
    quests = []; completedQuests = []; rewards = []; habits = []; habitHistory = {};
    achievements.forEach(a => a.completed = false);
    cancelActiveQuest();
    saveGameState();
    renderAll();
    updateUI();
    document.getElementById('reset-modal').classList.remove('active');
    toast('🔄 Game data reset', 'success');
}

/* ============================================================
   XP / Level / Gold / Achievements
   ============================================================ */
function gainXP(amount) {
    xp += amount;
    while (xp >= xpToNextLevel) levelUp();
    updateUI();
    saveGameState();
}

function gainGold(amount) {
    gold += amount;
    updateUI();
    saveGameState();
}

function levelUp() {
    const oldLevel = level;
    level++;
    xp -= xpToNextLevel;
    xpToNextLevel = Math.round(xpToNextLevel * 1.15 + 500);
    const newRank = rankForLevel(level);
    const oldRank = rankForLevel(oldLevel);
    document.getElementById('new-level').textContent = level;
    document.getElementById('new-rank').textContent = newRank.name;
    if (newRank.name !== oldRank.name) {
        document.getElementById('new-rank').innerHTML = newRank.name + ' <span class="subtle">(new rank!)</span>';
    }
    document.getElementById('level-up-modal').classList.add('active');
}

function rankForLevel(lvl) {
    for (let i = ranks.length - 1; i >= 0; i--) if (lvl >= ranks[i].level) return ranks[i];
    return ranks[0];
}

function checkAchievements() {
    achievements.forEach(a => {
        if (!a.completed && typeof a.cond === 'function') {
            try {
                if (a.cond()) {
                    a.completed = true;
                    gainXP(a.xp);
                    toast(`🏆 Achievement: ${a.name} (+${a.xp} XP)`, 'success');
                }
            } catch (e) { /* ignore */ }
        }
    });
}

function updateUI() {
    document.getElementById('xp').textContent = xp;
    document.getElementById('level').textContent = level;
    document.getElementById('gold').textContent = Math.floor(gold);
    document.getElementById('xp-to-level').textContent = xpToNextLevel;
    document.getElementById('xp-progress').style.width = `${Math.min(100, (xp / xpToNextLevel) * 100)}%`;
    document.getElementById('rank').textContent = rankForLevel(level).name;
    renderAchievements();
    checkAchievements();
}

function focusTimeToday() {
    const today = new Date().toISOString().slice(0, 10);
    return completedQuests
        .filter(q => (q.completedTime || '').slice(0, 10) === today)
        .reduce((acc, q) => acc + (q.duration || 0), 0);
}

/* ============================================================
   History
   ============================================================ */
function wireHistoryFilters() {
    ['month-filter', 'duration-filter', 'mode-filter'].forEach(id =>
        document.getElementById(id).addEventListener('change', renderHistory));
}

function renderHistory() {
    populateMonthFilter();
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    if (completedQuests.length === 0) {
        list.innerHTML = '<div class="empty-state">No completed quests yet. Finish a quest to see it here!</div>';
        return;
    }

    const monthFilter = document.getElementById('month-filter').value;
    const durationFilter = document.getElementById('duration-filter').value;
    const modeFilter = document.getElementById('mode-filter').value;

    let items = [...completedQuests].sort((a, b) => new Date(b.completedTime) - new Date(a.completedTime));

    if (monthFilter !== 'all') {
        const [year, month] = monthFilter.split('-');
        items = items.filter(q => {
            const d = new Date(q.completedTime);
            return d.getFullYear() === Number(year) && d.getMonth() === Number(month) - 1;
        });
    }

    if (durationFilter !== 'all') {
        items = items.filter(q => {
            const d = q.duration || 0;
            switch (durationFilter) {
                case 'short': return d < 300000;
                case 'medium': return d >= 300000 && d < 1800000;
                case 'long': return d >= 1800000 && d < 3600000;
                case 'extended': return d >= 3600000;
            }
            return true;
        });
    }

    if (modeFilter !== 'all') items = items.filter(q => (q.mode || 'stopwatch') === modeFilter);

    if (items.length === 0) {
        list.innerHTML = '<div class="empty-state">No quests match your filters.</div>';
        return;
    }

    items.forEach(q => {
        const d = new Date(q.completedTime);
        const dateStr = d.toLocaleDateString();
        let ts = '';
        if (q.startTime && q.endTime) {
            const fmt = t => new Date(t).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
            ts = `<div class="history-timestamps">
                    <span>Start <span class="timestamp-value">${fmt(q.startTime)}</span></span>
                    <span>End <span class="timestamp-value">${fmt(q.endTime)}</span></span>
                  </div>`;
        }
        const tags = (q.tags || []).map(t => `<span class="qc-tag">#${escapeHtml(t)}</span>`).join(' ');
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="history-main">
                <div class="history-quest-name">${escapeHtml(q.name)}</div>
                <div class="history-date">${dateStr}${tags ? ' · ' + tags : ''}</div>
                ${ts}
            </div>
            <div class="history-details">
                <span class="history-duration">${formatDuration(q.duration || 0)}</span>
                <span class="history-xp">+${q.earnedXP || q.xpReward} XP</span>
                <span class="history-mode">${q.mode || 'stopwatch'}</span>
            </div>
            <button class="delete-history-btn" data-id="${q.id || q.completedTime}" title="Delete log">
                <i class="fas fa-trash"></i>
            </button>
        `;
        item.querySelector('.delete-history-btn').addEventListener('click', () => {
            if (!confirm('Delete this log entry?')) return;
            const id = q.id || q.completedTime;
            completedQuests = completedQuests.filter(x => (x.id || x.completedTime) !== id);
            renderHistory();
            saveGameState();
        });
        list.appendChild(item);
    });
}

function populateMonthFilter() {
    const sel = document.getElementById('month-filter');
    const current = sel.value;
    sel.innerHTML = '<option value="all">All time</option>';
    if (completedQuests.length === 0) return;
    const months = new Set();
    completedQuests.forEach(q => {
        const d = new Date(q.completedTime);
        months.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    });
    Array.from(months).sort().reverse().forEach(ym => {
        const [y, m] = ym.split('-');
        const label = new Date(y, m - 1).toLocaleString('default', { month: 'long' }) + ' ' + y;
        const opt = document.createElement('option');
        opt.value = ym;
        opt.textContent = label;
        sel.appendChild(opt);
    });
    if (current !== 'all') sel.value = current;
    if (sel.value !== current) sel.value = 'all';
}

/* ============================================================
   Habits
   ============================================================ */
function wireHabits() {
    document.getElementById('add-habit-btn').addEventListener('click', addHabit);
    document.getElementById('habit-frequency').addEventListener('change', toggleCustomDays);
    document.querySelectorAll('.habit-filters .chip').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.habit-filters .chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentHabitFilter = btn.dataset.filter;
            renderHabits();
        });
    });
}

function toggleCustomDays() {
    const freq = document.getElementById('habit-frequency').value;
    document.getElementById('custom-days-selector').classList.toggle('hidden', freq !== 'custom');
}

function addHabit() {
    const name = document.getElementById('habit-name').value.trim();
    if (!name) { toast('Habit name required', 'danger'); return; }
    const difficulty = document.getElementById('habit-difficulty').value;
    const frequency = document.getElementById('habit-frequency').value;
    let customDays = [];
    if (frequency === 'custom') {
        customDays = Array.from(document.querySelectorAll('.days-checkboxes input:checked')).map(c => parseInt(c.value));
        if (customDays.length === 0) { toast('Pick at least one day', 'danger'); return; }
    }
    const xpRewards = { easy: 150, medium: 300, hard: 500, extreme: 1000 };
    const habit = {
        id: Date.now(),
        name, difficulty, frequency, customDays,
        xpReward: xpRewards[difficulty],
        createdDate: new Date().toISOString().slice(0, 10),
        totalCompletions: 0
    };
    habits.push(habit);
    document.getElementById('habit-name').value = '';
    document.getElementById('habit-difficulty').value = 'medium';
    document.getElementById('habit-frequency').value = 'daily';
    document.getElementById('custom-days-selector').classList.add('hidden');
    document.querySelectorAll('.days-checkboxes input').forEach(c => c.checked = false);
    renderHabits();
    saveGameState();
    toast(`🎯 Habit "${name}" added`);
}

function renderHabits() {
    const list = document.getElementById('habits-list');
    list.innerHTML = '';
    if (habits.length === 0) {
        list.innerHTML = '<div class="empty-habits">No habits yet. Add your first one above!</div>';
        return;
    }

    let items = [...habits];
    switch (currentHabitFilter) {
        case 'active':
            items = items.filter(h => isHabitActiveToday(h) && !isHabitCompletedToday(h.id));
            break;
        case 'completed':
            items = items.filter(h => isHabitCompletedToday(h.id));
            break;
        case 'streak':
            items.sort((a, b) => getHabitStreak(b.id) - getHabitStreak(a.id));
            break;
    }

    if (items.length === 0) {
        list.innerHTML = `<div class="empty-habits">No habits match this filter.</div>`;
        return;
    }

    items.forEach(h => list.appendChild(createHabitElement(h)));
}

function createHabitElement(habit) {
    const el = document.createElement('div');
    el.className = 'habit-item';
    const completed = isHabitCompletedToday(habit.id);
    const active = isHabitActiveToday(habit);
    const streak = getHabitStreak(habit.id);

    if (completed) el.classList.add('completed');
    if (streak >= 7) el.classList.add('streak-fire');

    el.innerHTML = `
        <div class="habit-header">
            <div class="habit-name">${escapeHtml(habit.name)}</div>
            <div class="habit-difficulty ${habit.difficulty}">${habit.difficulty}</div>
        </div>
        <div class="habit-streak">
            <span class="streak-flame">🔥</span>
            <span class="streak-number">${streak}</span>
            <span class="streak-text">day streak</span>
        </div>
        <div class="habit-frequency">
            <i class="fas fa-calendar"></i> ${frequencyText(habit)}
        </div>
        <div>
            <div class="progress-text">
                <span>This week</span>
                <span>${weeklyCompletionCount(habit.id)}/7</span>
            </div>
            <div class="weekly-progress">${weeklyProgressDots(habit.id)}</div>
        </div>
        <div class="habit-actions">
            <button class="complete-habit-btn ${completed ? 'completed' : ''}" ${!active || completed ? 'disabled' : ''}>
                ${completed
                    ? '<i class="fas fa-check"></i> Completed!'
                    : `<i class="fas fa-plus"></i> Complete (+${habit.xpReward} XP)`}
            </button>
            <button class="delete-habit-btn" title="Delete habit">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;

    const completeBtn = el.querySelector('.complete-habit-btn');
    if (!completeBtn.disabled) {
        completeBtn.addEventListener('click', () => completeHabit(habit.id));
    }
    el.querySelector('.delete-habit-btn').addEventListener('click', () => {
        if (!confirm(`Delete "${habit.name}" and all its history?`)) return;
        habits = habits.filter(h => h.id !== habit.id);
        delete habitHistory[habit.id];
        renderHabits();
        saveGameState();
    });

    return el;
}

function completeHabit(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit || isHabitCompletedToday(habitId)) return;
    const today = new Date().toISOString().slice(0, 10);
    habitHistory[habitId] = habitHistory[habitId] || {};
    habitHistory[habitId][today] = true;
    habit.totalCompletions = (habit.totalCompletions || 0) + 1;

    const streak = getHabitStreak(habitId);
    const bonus = streakBonus(streak);
    const earnedXP = Math.round(habit.xpReward * bonus);
    const earnedGold = Math.round(earnedXP / 15);

    gainXP(earnedXP);
    gainGold(earnedGold);

    checkStreakMilestone(habit, streak);
    renderHabits();
    saveGameState();
    toast(`✅ ${habit.name} +${earnedXP} XP`, 'success');
}

function isHabitActiveToday(habit) {
    return isHabitActiveOnDate(habit, new Date());
}

function isHabitActiveOnDate(habit, date) {
    const dow = date.getDay();
    switch (habit.frequency) {
        case 'daily': return true;
        case 'weekdays': return dow >= 1 && dow <= 5;
        case 'weekends': return dow === 0 || dow === 6;
        case 'custom': return (habit.customDays || []).includes(dow);
        default: return true;
    }
}

function isHabitCompletedToday(habitId) {
    const today = new Date().toISOString().slice(0, 10);
    return !!(habitHistory[habitId] && habitHistory[habitId][today]);
}

function getHabitStreak(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit || !habitHistory[habitId]) return 0;
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        if (!isHabitActiveOnDate(habit, d)) continue;
        const key = d.toISOString().slice(0, 10);
        if (habitHistory[habitId][key]) {
            streak++;
        } else {
            // Today can be uncompleted without breaking the streak yet
            if (i === 0) continue;
            break;
        }
    }
    return streak;
}

function streakBonus(streak) {
    if (streak < 3) return 1;
    if (streak < 7) return 1.2;
    if (streak < 30) return 1.5;
    if (streak < 100) return 2;
    return 2.5;
}

function checkStreakMilestone(habit, streak) {
    const milestones = [7, 30, 50, 100, 365];
    if (milestones.includes(streak)) {
        const bonus = streak * 20;
        gainXP(bonus);
        document.getElementById('streak-days').textContent = streak;
        document.getElementById('streak-habit').textContent = habit.name;
        document.getElementById('streak-bonus').textContent = `+${bonus} XP`;
        document.getElementById('streak-modal').classList.add('active');
    }
}

function frequencyText(h) {
    const map = { daily: 'Every day', weekdays: 'Weekdays only', weekends: 'Weekends only' };
    if (h.frequency === 'custom') {
        const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return 'Custom: ' + (h.customDays || []).map(d => names[d]).join(', ');
    }
    return map[h.frequency] || 'Daily';
}

function weeklyProgressDots(habitId) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    let html = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        const isToday = key === today.toISOString().slice(0, 10);
        const done = habitHistory[habitId] && habitHistory[habitId][key];
        const classes = ['day-dot'];
        if (done) classes.push('completed');
        if (isToday) classes.push('today');
        html += `<div class="${classes.join(' ')}" title="${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i]}"></div>`;
    }
    return html;
}

function weeklyCompletionCount(habitId) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    let n = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        if (habitHistory[habitId] && habitHistory[habitId][key]) n++;
    }
    return n;
}

function checkMultiHabitDay() {
    return habits.filter(h => isHabitCompletedToday(h.id)).length >= 5;
}

/* ============================================================
   Shop / Rewards
   ============================================================ */
function wireShop() {
    document.getElementById('add-reward-btn').addEventListener('click', addReward);
}

function addReward() {
    const name = document.getElementById('reward-name').value.trim();
    const price = parseInt(document.getElementById('reward-price').value);
    if (!name || !price || price <= 0) { toast('Enter a name and positive price', 'danger'); return; }
    rewards.push({ id: Date.now(), name, price, timeAdded: new Date().toISOString() });
    document.getElementById('reward-name').value = '';
    document.getElementById('reward-price').value = '50';
    renderRewards();
    saveGameState();
}

function renderRewards() {
    const list = document.getElementById('rewards-list');
    list.innerHTML = '';
    if (rewards.length === 0) {
        list.innerHTML = '<div class="empty-rewards">No rewards yet. Add some to spend your gold on!</div>';
        return;
    }
    rewards.forEach(r => {
        const canAfford = gold >= r.price;
        const el = document.createElement('div');
        el.className = 'reward-item';
        el.innerHTML = `
            <div class="reward-name">${escapeHtml(r.name)}</div>
            <div class="reward-price">${r.price} <i class="fas fa-coins"></i></div>
            <div class="reward-actions">
                <button class="redeem-btn" ${canAfford ? '' : 'disabled'}>
                    ${canAfford ? '<i class="fas fa-shopping-cart"></i> Redeem' : '<i class="fas fa-lock"></i> Need more gold'}
                </button>
                <button class="delete-reward-btn" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        const redeem = el.querySelector('.redeem-btn');
        if (canAfford) redeem.addEventListener('click', () => redeemReward(r.id));
        el.querySelector('.delete-reward-btn').addEventListener('click', () => {
            if (!confirm('Delete this reward?')) return;
            rewards = rewards.filter(x => x.id !== r.id);
            renderRewards();
            saveGameState();
        });
        list.appendChild(el);
    });
}

function redeemReward(id) {
    const r = rewards.find(x => x.id === id);
    if (!r || gold < r.price) return;
    gold -= r.price;
    rewards = rewards.filter(x => x.id !== id);
    document.getElementById('redeemed-reward').textContent = r.name;
    document.getElementById('redeem-modal').classList.add('active');
    updateUI();
    renderRewards();
    saveGameState();
}

/* ============================================================
   Achievements rendering
   ============================================================ */
function renderAchievements() {
    const ul = document.getElementById('achievements-list');
    if (!ul) return;
    ul.innerHTML = '';
    achievements.forEach(a => {
        const li = document.createElement('li');
        li.className = a.completed ? 'unlocked' : 'locked';
        li.innerHTML = `
            <div class="achievement-info">
                <div class="achievement-title">${escapeHtml(a.name)}</div>
                <div class="achievement-desc">${escapeHtml(a.desc)}</div>
            </div>
            <span class="achievement-xp">+${a.xp} XP</span>
        `;
        ul.appendChild(li);
    });
}

/* ============================================================
   Chime (Web Audio)
   ============================================================ */
let audioCtx = null;
function playChime() {
    if (!soundEnabled) return;
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime;
        // Three-tone chime
        [880, 1108, 1318].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = now + i * 0.18;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(start);
            osc.stop(start + 0.7);
        });
    } catch (e) {
        console.warn('Chime failed', e);
    }
}

/* ============================================================
   Toast
   ============================================================ */
function toast(message, kind = '') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 320);
    }, 2800);
}

/* ============================================================
   Helpers
   ============================================================ */
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function renderAll() {
    renderLanes();
    renderTagFilters();
    renderHabits();
    renderRewards();
    renderHistory();
    renderAchievements();
}
