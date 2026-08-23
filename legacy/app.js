/* =====================================================
   Hydration Garden — main app logic
   ===================================================== */

const STORAGE_KEY = "hydration-garden-v1";

const DAILY_MAX_ML = 4000;        // hard daily cap
const QUICK_WINDOW_MS = 10 * 60 * 1000;  // 10 minutes
const QUICK_WINDOW_MAX_ML = 800;  // max mL in any 10-minute window
const COINS_PER_100ML = 500;
const DEFAULT_GOAL = 2000;

// ---------- State ----------
const defaultState = () => ({
  coins: 0,
  totalCoinsEarned: 0,
  totalMlLogged: 0,
  goalMl: DEFAULT_GOAL,
  streak: 0,
  longestStreak: 0,
  lastGoalDate: null,         // YYYY-MM-DD of last day daily goal was hit
  history: {},                // { "YYYY-MM-DD": totalMl }
  checkins: [],               // [{ id, ts, ml, photo? (dataURL), coins }]
  owned: {},                  // { plantId: { ts } }
  realPlants: [],             // [{ id, name, type, scheduleDays, lastWatered, created, lastPhoto?, lastBonusDate? }]
  reminders: { enabled: false, intervalMin: 60, lastNudge: null },
  lastLoginRewardDate: null   // YYYY-MM-DD — daily +350 coin bonus
});

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed, reminders: { ...defaultState().reminders, ...(parsed.reminders || {}) } };
  } catch (e) {
    return defaultState();
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// ---------- Helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}
function todayMl() { return state.history[todayKey()] || 0; }
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function coinsFor(ml) { return Math.round((ml / 100) * COINS_PER_100ML); }

function pulse(el) {
  if (!el) return;
  el.classList.remove("pulse");
  void el.offsetWidth;
  el.classList.add("pulse");
}

function toast(msg, type = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast " + type;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), 2600);
}

// ---------- Navigation ----------
function goTo(screenName) {
  $$(".screen").forEach(s => s.classList.toggle("active", s.dataset.screen === screenName));
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.go === screenName));
  window.scrollTo({ top: 0, behavior: "smooth" });
  // Refresh dynamic screens
  if (screenName === "shop") renderShop();
  if (screenName === "garden") renderGarden();
  if (screenName === "plants") renderRealPlants();
  if (screenName === "profile") renderProfile();
  if (screenName === "home") renderHome();
}

// ---------- Streak logic ----------
function refreshStreak() {
  // Streak resets if a full day was missed (i.e. lastGoalDate is older than yesterday).
  if (!state.lastGoalDate) {
    state.streak = 0;
    return;
  }
  const last = state.lastGoalDate;
  const today = todayKey();
  const yesterday = yesterdayKey();
  if (last !== today && last !== yesterday) {
    state.streak = 0;
  }
}

function maybeGoalReached(prevMl, newMl) {
  if (prevMl < state.goalMl && newMl >= state.goalMl) {
    const today = todayKey();
    if (state.lastGoalDate !== today) {
      // If yesterday was the last goal day, continue streak. Otherwise restart at 1.
      if (state.lastGoalDate === yesterdayKey()) state.streak += 1;
      else state.streak = 1;
      state.lastGoalDate = today;
      state.longestStreak = Math.max(state.longestStreak, state.streak);
      toast(`🎉 Daily goal hit! Streak ${state.streak} 🔥`, "ok");
    }
  }
}

// ---------- Logging water ----------
function recentMlInWindow(ms) {
  const cutoff = Date.now() - ms;
  return state.checkins
    .filter(c => c.ts >= cutoff)
    .reduce((sum, c) => sum + c.ml, 0);
}

function logWater(ml, photoDataUrl) {
  ml = Math.round(Number(ml));
  if (!Number.isFinite(ml) || ml < 10) {
    return { ok: false, level: "error", msg: "Please enter at least 10 mL." };
  }
  if (ml > 1500) {
    return { ok: false, level: "error", msg: "That's a lot in one go — try 1500 mL or less per log." };
  }

  const day = todayKey();
  const dayTotal = state.history[day] || 0;
  if (dayTotal + ml > DAILY_MAX_ML) {
    return {
      ok: false, level: "warn",
      msg: `Daily safe limit is ${DAILY_MAX_ML} mL. You've already logged ${dayTotal} mL today.`
    };
  }

  const recent = recentMlInWindow(QUICK_WINDOW_MS);
  if (recent + ml > QUICK_WINDOW_MAX_ML) {
    return {
      ok: false, level: "warn",
      msg: `Slow down 🐢 max ${QUICK_WINDOW_MAX_ML} mL within 10 minutes — drinking too fast isn't safe.`
    };
  }

  // Apply
  const prevDayMl = dayTotal;
  state.history[day] = dayTotal + ml;
  state.totalMlLogged += ml;

  const earned = coinsFor(ml);
  state.coins += earned;
  state.totalCoinsEarned += earned;

  const checkin = {
    id: "c-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    ts: Date.now(),
    ml,
    coins: earned,
    photo: photoDataUrl || null
  };
  state.checkins.unshift(checkin);
  if (state.checkins.length > 50) state.checkins.length = 50;

  maybeGoalReached(prevDayMl, state.history[day]);
  saveState();

  return { ok: true, level: "ok", msg: `+${earned.toLocaleString()} 🪙 for ${ml} mL!`, earned, checkin };
}

// ---------- Shop ----------
function isSetUnlocked(setIndex) {
  if (setIndex === 0) return true;
  const prev = PLANT_SETS[setIndex - 1];
  return prev.plants.every(p => state.owned[p.id]);
}
function ownedCountInSet(set) {
  return set.plants.filter(p => state.owned[p.id]).length;
}
function buyPlant(plantId) {
  const plant = PLANT_BY_ID[plantId];
  if (!plant) return;
  if (state.owned[plantId]) { toast("You already own this one 🌿"); return; }
  const setIndex = plant.setId - 1;
  if (!isSetUnlocked(setIndex)) { toast("Complete the previous set first 🔒", "warn"); return; }
  if (state.coins < plant.price) {
    toast(`Need ${(plant.price - state.coins).toLocaleString()} more coins 🪙`, "warn");
    return;
  }
  state.coins -= plant.price;
  state.owned[plantId] = { ts: Date.now() };
  saveState();
  toast(`${plant.icon} ${plant.name} added to your garden!`, "ok");
  renderTopbar();
  renderShop();

  // Set completion check
  const set = PLANT_SETS[setIndex];
  if (ownedCountInSet(set) === set.plants.length) {
    setTimeout(() => toast(`🏆 Set complete: ${set.name}! Next set unlocked.`, "ok"), 600);
  }
}

// ---------- Real plants ----------
function addRealPlant(name, type, days) {
  if (!name.trim()) return false;
  state.realPlants.push({
    id: "rp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    name: name.trim(),
    type: type.trim(),
    scheduleDays: Math.max(1, Number(days) || 7),
    lastWatered: null,
    created: Date.now()
  });
  saveState();
  return true;
}
const REAL_PLANT_PHOTO_BONUS = 1000;

function waterRealPlant(id, photoDataUrl) {
  const p = state.realPlants.find(rp => rp.id === id);
  if (!p) return;
  p.lastWatered = Date.now();

  let bonus = 0;
  if (photoDataUrl) {
    p.lastPhoto = { ts: Date.now(), dataUrl: photoDataUrl };
    const today = todayKey();
    if (p.lastBonusDate !== today) {
      bonus = REAL_PLANT_PHOTO_BONUS;
      p.lastBonusDate = today;
      state.coins += bonus;
      state.totalCoinsEarned += bonus;
    }
  }

  saveState();
  if (bonus > 0) {
    toast(`💧 ${p.name} watered! +${bonus.toLocaleString()} 🪙 photo bonus 🎉`, "ok");
  } else if (photoDataUrl) {
    toast(`💧 ${p.name} watered! (photo bonus already claimed today)`, "ok");
  } else {
    toast(`💧 Watered ${p.name}!`, "ok");
  }
  renderTopbar();
  renderRealPlants();
  renderHome();
}
function removeRealPlant(id) {
  state.realPlants = state.realPlants.filter(rp => rp.id !== id);
  saveState();
  renderRealPlants();
  renderHome();
}
function daysUntilNextWater(p) {
  if (!p.lastWatered) return -1; // never watered = due now
  const due = p.lastWatered + p.scheduleDays * 24 * 60 * 60 * 1000;
  return Math.ceil((due - Date.now()) / (24 * 60 * 60 * 1000));
}

// ---------- Reminders ----------
let reminderTimer = null;
function startReminderTimer() {
  stopReminderTimer();
  if (!state.reminders.enabled) return;
  const ms = state.reminders.intervalMin * 60 * 1000;
  reminderTimer = setInterval(fireReminder, ms);
}
function stopReminderTimer() {
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = null;
}
function fireReminder() {
  const msg = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
  state.reminders.lastNudge = Date.now();
  saveState();
  // Try Web Notification, fall back to toast
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("Hydration Garden", { body: msg, icon: undefined });
    } catch (e) { /* fall back */ }
  }
  toast(msg);
  renderHome();
}
async function ensureNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const res = await Notification.requestPermission();
    return res === "granted";
  } catch (e) { return false; }
}

// ---------- Daily login bonus ----------
const DAILY_LOGIN_BONUS = 350;
function checkDailyLogin() {
  const today = todayKey();
  if (state.lastLoginRewardDate !== today) {
    state.coins += DAILY_LOGIN_BONUS;
    state.totalCoinsEarned += DAILY_LOGIN_BONUS;
    state.lastLoginRewardDate = today;
    saveState();
    // Show toast after init finishes so the user notices the bump
    setTimeout(() => toast(`🌅 Daily login bonus: +${DAILY_LOGIN_BONUS} 🪙`, "ok"), 900);
  }
}

// ---------- In-app camera ----------
let cameraStream = null;
let cameraCallback = null;
let cameraDataUrl = null;

async function openCamera(title, callback) {
  cameraCallback = callback || null;
  cameraDataUrl = null;
  $("#camera-title").textContent = title || "Take a photo";
  $("#camera-modal").classList.remove("hidden");

  const video = $("#camera-video");
  const still = $("#camera-still");
  const status = $("#camera-status");
  video.classList.remove("hidden");
  still.classList.add("hidden");
  still.removeAttribute("src");
  $("#camera-pre").classList.remove("hidden");
  $("#camera-post").classList.add("hidden");

  if (!navigator.mediaDevices?.getUserMedia) {
    // Fallback for browsers without camera API
    closeCamera();
    cameraFileFallback(callback);
    return;
  }

  status.textContent = "Starting camera...";
  status.classList.remove("hidden");
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    video.srcObject = cameraStream;
    status.classList.add("hidden");
  } catch (err) {
    status.textContent = "Couldn't open camera 😕 — using file picker instead.";
    setTimeout(() => {
      closeCamera();
      cameraFileFallback(callback);
    }, 900);
  }
}

function captureCameraFrame() {
  const video = $("#camera-video");
  if (!video.videoWidth) return;
  const maxDim = 800;
  const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(video, 0, 0, w, h);
  cameraDataUrl = canvas.toDataURL("image/jpeg", 0.72);
  const still = $("#camera-still");
  still.src = cameraDataUrl;
  still.classList.remove("hidden");
  video.classList.add("hidden");
  $("#camera-pre").classList.add("hidden");
  $("#camera-post").classList.remove("hidden");
}

function retakeCameraFrame() {
  cameraDataUrl = null;
  $("#camera-still").classList.add("hidden");
  $("#camera-video").classList.remove("hidden");
  $("#camera-pre").classList.remove("hidden");
  $("#camera-post").classList.add("hidden");
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  $("#camera-video").srcObject = null;
  $("#camera-modal").classList.add("hidden");
}

function useCameraPhoto() {
  const data = cameraDataUrl;
  const cb = cameraCallback;
  closeCamera();
  cameraCallback = null;
  cameraDataUrl = null;
  if (cb) cb(data || null);
}

function cancelCamera() {
  const cb = cameraCallback;
  closeCamera();
  cameraCallback = null;
  cameraDataUrl = null;
  if (cb) cb(null);
}

// File-input fallback when camera API is unavailable or denied
function cameraFileFallback(callback) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";
  input.onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) { callback && callback(null); return; }
    try {
      const dataUrl = await readImageAsDataUrl(file);
      callback && callback(dataUrl);
    } catch (err) {
      callback && callback(null);
    }
  };
  input.click();
}

// ---------- Rendering ----------
function renderTopbar() {
  $("#coin-balance").textContent = state.coins.toLocaleString();
  $("#streak-count").textContent = state.streak;
  pulse($("#coin-balance"));
}

function renderHome() {
  refreshStreak();
  const ml = todayMl();
  const goal = state.goalMl;
  const pct = Math.min(1, ml / goal);
  // Ring: circumference ≈ 2 * π * 86 ≈ 540
  const dash = 540;
  $("#ring-progress").style.strokeDasharray = dash;
  $("#ring-progress").style.strokeDashoffset = dash * (1 - pct);
  $("#today-ml").textContent = ml.toLocaleString();
  $("#goal-ml").textContent = goal.toLocaleString();
  $("#home-today").textContent = ml.toLocaleString();
  $("#home-streak").textContent = state.streak;
  $("#home-coins").textContent = state.coins.toLocaleString();

  // Reminders
  $("#toggle-reminders").textContent = state.reminders.enabled ? "On ✓" : "Off";
  $("#toggle-reminders").classList.toggle("btn-primary", state.reminders.enabled);
  $("#reminder-interval").value = String(state.reminders.intervalMin);
  $("#reminder-interval-label").textContent = state.reminders.intervalMin;
  $("#last-nudge").textContent = state.reminders.lastNudge
    ? "Last nudge: " + fmtTime(state.reminders.lastNudge)
    : "";

  // Real plant summary
  if (state.realPlants.length) {
    const due = state.realPlants.filter(p => daysUntilNextWater(p) <= 0).length;
    $("#real-plant-summary").textContent =
      `${state.realPlants.length} real plant${state.realPlants.length === 1 ? "" : "s"} tracked` +
      (due > 0 ? ` — ${due} need${due === 1 ? "s" : ""} watering today 💧` : " — all happy 🌿");
  } else {
    $("#real-plant-summary").textContent = "Add the plants you care for in real life and we'll remind you when to water them.";
  }

  // Milestones
  const ms = $("#milestones-list");
  ms.innerHTML = "";
  STREAK_MILESTONES.forEach(n => {
    const div = document.createElement("div");
    div.className = "milestone" + (state.longestStreak >= n ? " reached" : "");
    div.innerHTML = `<div class="m-num">${n}</div><div>day${n === 1 ? "" : "s"}</div>`;
    ms.appendChild(div);
  });

  renderTopbar();
}

function renderLog() {
  // Recent check-ins
  const list = $("#checkin-list");
  list.innerHTML = "";
  if (!state.checkins.length) {
    list.innerHTML = '<li class="muted">No check-ins yet — log your first sip!</li>';
  } else {
    state.checkins.slice(0, 10).forEach(c => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="checkin-thumb">${c.photo ? `<img src="${c.photo}" alt="" />` : "💧"}</div>
        <div class="checkin-meta">
          <div class="ml">${c.ml} mL</div>
          <div class="time">${fmtTime(c.ts)}</div>
        </div>
        <div class="checkin-reward">+${c.coins.toLocaleString()} 🪙</div>
      `;
      list.appendChild(li);
    });
  }
  updateRewardPreview();
}

function updateRewardPreview() {
  const v = Number($("#log-amount").value) || 0;
  $("#reward-preview").textContent = `${coinsFor(v).toLocaleString()} 🪙`;
}

function renderShop() {
  const root = $("#shop-sets");
  root.innerHTML = "";
  PLANT_SETS.forEach((set, idx) => {
    const unlocked = isSetUnlocked(idx);
    const ownedCount = ownedCountInSet(set);
    const total = set.plants.length;
    const pct = Math.round((ownedCount / total) * 100);

    const card = document.createElement("div");
    card.className = "set-card" + (unlocked ? "" : " locked");
    card.innerHTML = `
      <div class="set-header">
        <h2>Set ${set.id}: ${set.name} ${unlocked ? "" : "🔒"}</h2>
        <span class="set-meta">${ownedCount}/${total}</span>
      </div>
      <div class="set-progress"><div style="width:${pct}%"></div></div>
      ${unlocked ? "" : `<div class="set-locked-msg">Complete Set ${set.id - 1} to unlock.</div>`}
      <div class="plants-grid"></div>
    `;
    const grid = $(".plants-grid", card);
    set.plants.forEach(p => {
      const owned = !!state.owned[p.id];
      const affordable = state.coins >= p.price;
      const tile = document.createElement("div");
      tile.className = "plant-card" + (owned ? " owned" : "") + (unlocked ? "" : " locked");
      tile.innerHTML = `
        <span class="plant-icon">${p.icon}</span>
        <div class="plant-name">${p.name}</div>
        <div class="plant-price">${p.price.toLocaleString()} 🪙</div>
        ${owned
          ? `<span class="owned-badge">Owned ✓</span>`
          : `<button ${(!unlocked || !affordable) ? "disabled" : ""} data-buy="${p.id}">
                ${!unlocked ? "Locked" : affordable ? "Buy" : "Not enough"}
            </button>`
        }
      `;
      grid.appendChild(tile);
    });
    root.appendChild(card);
  });

  // Bind buy buttons
  $$("#shop-sets button[data-buy]").forEach(btn => {
    btn.addEventListener("click", () => buyPlant(btn.dataset.buy));
  });
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function renderGarden() {
  const grid = $("#garden-grid");
  const empty = $("#garden-empty");
  grid.innerHTML = "";

  const owned = Object.entries(state.owned)
    .filter(([id]) => PLANT_BY_ID[id])
    .map(([id, meta]) => ({ id, meta, catalog: PLANT_BY_ID[id] }))
    .sort((a, b) => a.catalog.setId - b.catalog.setId || a.meta.ts - b.meta.ts);

  $("#garden-count").textContent = owned.length;
  empty.classList.toggle("hidden", owned.length > 0);

  // Grow the bed to fit auto-placed plants
  const cols = 6;
  const rows = Math.max(1, Math.ceil(owned.length / cols));
  const bedHeight = 220 + Math.max(0, rows - 2) * 70;
  grid.style.height = bedHeight + "px";

  owned.forEach((entry, i) => {
    const p = entry.catalog;
    const m = entry.meta;

    // Position: use saved coords if user has dragged, else auto-place on a 6-col grid
    let x, y;
    if (typeof m.x === "number" && typeof m.y === "number") {
      x = m.x; y = m.y;
    } else {
      const col = i % cols;
      const row = Math.floor(i / cols);
      x = 0.08 + (col / Math.max(cols - 1, 1)) * 0.84;
      y = rows === 1 ? 0.6 : 0.3 + (row / Math.max(rows - 1, 1)) * 0.65;
    }

    const sizeClass =
      p.setId >= 7 ? "g-xl" :
      p.setId >= 5 ? "g-lg" :
      p.setId >= 3 ? "g-md" : "g-sm";

    const seed = hashStr(p.id);
    const swayDur = 3 + (seed % 25) / 10;
    const swayDelay = -((seed % 40) / 10);
    const swayDir = (seed % 2) === 0 ? "normal" : "reverse";
    const growDelay = Math.min(i * 60, 1500);

    const el = document.createElement("div");
    el.className = `g-plant ${sizeClass}`;
    el.style.left = (x * 100) + "%";
    el.style.top  = (y * 100) + "%";
    el.dataset.plantId = entry.id;
    el.title = `${p.name} — Set ${p.setId}: ${p.setName}`;
    el.innerHTML = `
      <div class="g-plant-inner"
           style="animation-duration:${swayDur}s; animation-delay:${swayDelay}s; animation-direction:${swayDir};">
        <span class="emoji" style="animation-delay:${growDelay}ms">${p.icon}</span>
      </div>
      <span class="mound"></span>
    `;
    attachDragHandlers(el, grid);
    grid.appendChild(el);
  });
}

// ---------- Drag-to-arrange ----------
function attachDragHandlers(plantEl, grid) {
  let drag = null;

  plantEl.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    plantEl.setPointerCapture(e.pointerId);
    const gridRect = grid.getBoundingClientRect();
    drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startLeftPct: parseFloat(plantEl.style.left) || 50,
      startTopPct:  parseFloat(plantEl.style.top)  || 60,
      gridWidth: gridRect.width,
      gridHeight: gridRect.height,
      moved: false
    };
    plantEl.classList.add("dragging");
    e.preventDefault();
  });

  plantEl.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
    if (!drag.moved) return;
    let leftPct = drag.startLeftPct + (dx / drag.gridWidth) * 100;
    let topPct  = drag.startTopPct  + (dy / drag.gridHeight) * 100;
    // Keep plants on the soil, with a small inset
    leftPct = Math.max(5, Math.min(95, leftPct));
    topPct  = Math.max(15, Math.min(100, topPct));
    plantEl.style.left = leftPct + "%";
    plantEl.style.top  = topPct  + "%";
  });

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const wasMoved = drag.moved;
    plantEl.classList.remove("dragging");
    if (wasMoved) {
      const id = plantEl.dataset.plantId;
      const x = (parseFloat(plantEl.style.left) || 50) / 100;
      const y = (parseFloat(plantEl.style.top)  || 60) / 100;
      if (state.owned[id]) {
        state.owned[id].x = x;
        state.owned[id].y = y;
        saveState();
      }
    } else {
      // Treat as a tap — show plant info
      const p = PLANT_BY_ID[plantEl.dataset.plantId];
      if (p) toast(`${p.icon} ${p.name} — Set ${p.setId}: ${p.setName}`);
    }
    drag = null;
  };
  plantEl.addEventListener("pointerup", endDrag);
  plantEl.addEventListener("pointercancel", endDrag);
}

function renderRealPlants() {
  const list = $("#rp-list");
  const empty = $("#rp-empty");
  list.innerHTML = "";
  empty.classList.toggle("hidden", state.realPlants.length > 0);

  const today = todayKey();
  state.realPlants.forEach(p => {
    const days = daysUntilNextWater(p);
    let nextLabel, nextClass;
    if (days < 0 && !p.lastWatered) { nextLabel = "Needs first watering 💧"; nextClass = "due"; }
    else if (days <= 0) { nextLabel = "Water today 💧"; nextClass = "due"; }
    else if (days === 1) { nextLabel = "Water tomorrow"; nextClass = "soon"; }
    else { nextLabel = `Water in ${days} days`; nextClass = "ok"; }

    const bonusClaimed = p.lastBonusDate === today;
    const photoLabel = bonusClaimed ? "📸 Bonus claimed" : "📸 +1000 🪙";

    const card = document.createElement("div");
    card.className = "rp-card";
    card.innerHTML = `
      <div class="rp-icon">🪴</div>
      <div class="rp-info">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="meta">${escapeHtml(p.type || "Plant")} · every ${p.scheduleDays} day${p.scheduleDays === 1 ? "" : "s"}</div>
        <div class="next ${nextClass}">${nextLabel}</div>
      </div>
      <div class="rp-actions">
        <button class="water" data-water="${p.id}">💧 Water</button>
        <button class="water-photo ${bonusClaimed ? "claimed" : ""}" data-photo="${p.id}">${photoLabel}</button>
        <button class="remove" data-remove="${p.id}">Remove</button>
      </div>
    `;
    list.appendChild(card);
  });

  $$("#rp-list button[data-water]").forEach(b => b.addEventListener("click", () => waterRealPlant(b.dataset.water)));
  $$("#rp-list button[data-photo]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.photo;
    const plant = state.realPlants.find(rp => rp.id === id);
    openCamera(`Photo: ${plant ? plant.name : "plant"}`, (dataUrl) => {
      if (!dataUrl) return; // user cancelled — don't water
      waterRealPlant(id, dataUrl);
    });
  }));
  $$("#rp-list button[data-remove]").forEach(b => b.addEventListener("click", () => {
    if (confirm("Remove this plant?")) removeRealPlant(b.dataset.remove);
  }));
}

function renderProfile() {
  refreshStreak();
  $("#p-total-ml").textContent = state.totalMlLogged.toLocaleString();
  $("#p-best-streak").textContent = state.longestStreak;
  $("#p-cur-streak").textContent = state.streak;
  $("#p-total-coins").textContent = state.totalCoinsEarned.toLocaleString();
  $("#p-plants-owned").textContent = Object.keys(state.owned).length;

  const completed = PLANT_SETS.filter(s => ownedCountInSet(s) === s.plants.length);
  $("#p-sets-done").textContent = completed.length;

  $("#goal-input").value = state.goalMl;

  const setsEl = $("#completed-sets");
  setsEl.innerHTML = "";
  PLANT_SETS.forEach(s => {
    const done = ownedCountInSet(s) === s.plants.length;
    const badge = document.createElement("span");
    badge.className = "set-badge" + (done ? "" : " muted");
    badge.textContent = (done ? "🏆 " : "") + `Set ${s.id}`;
    setsEl.appendChild(badge);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Photo handling ----------
async function readImageAsDataUrl(file, maxDim = 800) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- Event wiring ----------
function bindEvents() {
  // Navigation
  $$("[data-go]").forEach(el => {
    el.addEventListener("click", () => goTo(el.dataset.go));
  });

  // Log amount quick buttons
  $$(".amount-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $("#log-amount").value = btn.dataset.amount;
      $$(".amount-btn").forEach(b => b.classList.toggle("active", b === btn));
      updateRewardPreview();
    });
  });
  $("#log-amount").addEventListener("input", () => {
    $$(".amount-btn").forEach(b => b.classList.remove("active"));
    updateRewardPreview();
  });
  // Enter to submit the water log
  $("#log-amount").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); $("#log-submit").click(); }
  });

  // Photo capture (live camera) for water log
  let pendingPhoto = null;
  function setLogPhoto(dataUrl) {
    pendingPhoto = dataUrl || null;
    const preview = $("#photo-preview");
    const clearBtn = $("#clear-water-photo");
    if (pendingPhoto) {
      preview.innerHTML = `<img src="${pendingPhoto}" alt="check-in" />`;
      preview.classList.remove("hidden");
      clearBtn.classList.remove("hidden");
    } else {
      preview.innerHTML = "";
      preview.classList.add("hidden");
      clearBtn.classList.add("hidden");
    }
  }

  $("#open-water-camera").addEventListener("click", () => {
    openCamera("Photo your drink", (dataUrl) => {
      if (dataUrl) setLogPhoto(dataUrl);
    });
  });
  $("#upload-water-file").addEventListener("click", () => {
    cameraFileFallback((dataUrl) => {
      if (dataUrl) setLogPhoto(dataUrl);
    });
  });
  $("#clear-water-photo").addEventListener("click", () => setLogPhoto(null));

  // Camera modal controls (shared by water + real-plant flows)
  $("#camera-capture").addEventListener("click", captureCameraFrame);
  $("#camera-retake").addEventListener("click", retakeCameraFrame);
  $("#camera-use").addEventListener("click", useCameraPhoto);
  $("#camera-close").addEventListener("click", cancelCamera);
  $("#camera-upload").addEventListener("click", () => {
    // Switch from camera capture to file picker without losing the callback
    const cb = cameraCallback;
    closeCamera();
    cameraCallback = null;
    cameraDataUrl = null;
    cameraFileFallback((dataUrl) => { if (cb) cb(dataUrl || null); });
  });

  // Log submit
  $("#log-submit").addEventListener("click", () => {
    const ml = Number($("#log-amount").value);
    const result = logWater(ml, pendingPhoto);
    const fb = $("#log-feedback");
    fb.textContent = result.msg;
    fb.className = "feedback " + (result.level || "");
    if (result.ok) {
      $("#log-amount").value = "";
      $$(".amount-btn").forEach(b => b.classList.remove("active"));
      setLogPhoto(null);
      updateRewardPreview();
      renderTopbar();
      renderLog();
      renderHome();
      toast(result.msg, "ok");
    }
  });

  $("#clear-checkins").addEventListener("click", () => {
    if (!state.checkins.length) return;
    if (confirm("Clear all photo check-ins? Your water totals stay.")) {
      state.checkins = [];
      saveState();
      renderLog();
    }
  });

  // Reminders
  $("#toggle-reminders").addEventListener("click", async () => {
    if (!state.reminders.enabled) {
      await ensureNotificationPermission();
      state.reminders.enabled = true;
    } else {
      state.reminders.enabled = false;
    }
    saveState();
    startReminderTimer();
    renderHome();
  });
  $("#reminder-interval").addEventListener("change", (e) => {
    state.reminders.intervalMin = Number(e.target.value);
    saveState();
    startReminderTimer();
    renderHome();
  });
  $("#test-reminder").addEventListener("click", fireReminder);

  // Real plants — Enter on name/type submits the add form
  ["#rp-name", "#rp-type"].forEach(sel => {
    $(sel).addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); $("#rp-add").click(); }
    });
  });
  $("#rp-add").addEventListener("click", () => {
    const name = $("#rp-name").value;
    const type = $("#rp-type").value;
    const days = $("#rp-schedule").value;
    if (!name.trim()) { toast("Give your plant a name 🌱", "warn"); return; }
    addRealPlant(name, type, days);
    $("#rp-name").value = "";
    $("#rp-type").value = "";
    renderRealPlants();
    renderHome();
    toast("Plant added 🪴", "ok");
  });

  // Goal
  $("#goal-input").addEventListener("change", (e) => {
    let g = Number(e.target.value);
    if (!Number.isFinite(g)) g = DEFAULT_GOAL;
    g = Math.max(500, Math.min(3500, Math.round(g / 100) * 100));
    state.goalMl = g;
    e.target.value = g;
    saveState();
    renderHome();
    toast(`Daily goal set to ${g} mL 💧`, "ok");
  });

  // Reset
  $("#reset-app").addEventListener("click", () => {
    if (confirm("Reset all progress? This cannot be undone.")) {
      state = defaultState();
      saveState();
      renderAll();
      goTo("home");
      toast("Fresh start 🌱", "ok");
    }
  });
}

function renderAll() {
  renderTopbar();
  renderHome();
  renderLog();
  renderShop();
  renderGarden();
  renderRealPlants();
  renderProfile();
}

// ---------- Init ----------
function init() {
  refreshStreak();
  checkDailyLogin();
  saveState();
  bindEvents();
  renderAll();
  startReminderTimer();
}

document.addEventListener("DOMContentLoaded", init);
