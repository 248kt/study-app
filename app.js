// Minimal Study App logic: Pomodoro + Tasks + Theme
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const STORAGE_KEYS = {
  SETTINGS: "study.settings.v1",
  TASKS: "study.tasks.v1",
  THEME: "study.theme.v1",
  CYCLE: "study.cycle.v1",
};

const state = {
  mode: "work",         // "work" | "short" | "long"
  running: false,
  remaining: 25*60,
  timerId: null,
  cycleCount: 0,        // completed work sessions
  settings: {
    work: 25,
    short: 5,
    long: 15,
    tick: false,
    autoNext: false,
    volume: 0.6,
  }
};

// ---- Theme ----
const Theme = {
  load() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved) return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light";
  },
  apply(theme) {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    $("#iconSun").style.display = theme === "dark" ? "none" : "block";
    $("#iconMoon").style.display = theme === "dark" ? "block" : "none";
  },
  toggle() {
    Theme.apply(document.documentElement.classList.contains("dark") ? "light" : "dark");
  }
};

// ---- Timer ----
function formatTime(s) {
  const m = Math.floor(s/60).toString().padStart(2,"0");
  const sec = Math.floor(s%60).toString().padStart(2,"0");
  return `${m}:${sec}`;
}

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      Object.assign(state.settings, obj);
    } catch {}
  }
  ToneKit.setVolume(state.settings.volume);
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
}

function applyMode(mode) {
  state.mode = mode;
  state.running = false;
  clearInterval(state.timerId);
  const minutes = state.settings[mode] || 25;
  state.remaining = minutes * 60;
  updateTimeUI();
  $("#startPause").textContent = "Start";
  $$(".tab").forEach(b => {
    b.classList.toggle("active", b.dataset.mode === mode);
    b.setAttribute("aria-selected", b.dataset.mode === mode ? "true" : "false");
  });
  ToneKit.stopTick();
}

function tick() {
  state.remaining--;
  if (state.remaining <= 0) {
    // done
    clearInterval(state.timerId);
    state.running = false;
    updateTimeUI();
    $("#startPause").textContent = "Start";

    // beep
    ToneKit.chime();

    // cycle accounting
    if (state.mode === "work") {
      state.cycleCount++;
      $("#cycleCount").textContent = String(state.cycleCount);
      localStorage.setItem(STORAGE_KEYS.CYCLE, String(state.cycleCount));
    }

    if (state.settings.autoNext) {
      // auto switch: work -> short, short -> work, long -> work
      const next = state.mode === "work" ? "short" : "work";
      applyMode(next);
      startTimer();
    } else {
      ToneKit.stopTick();
    }
    return;
  }
  updateTimeUI();
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  clearInterval(state.timerId);
  state.timerId = setInterval(tick, 1000);
  $("#startPause").textContent = "Pause";
  if (state.settings.tick) ToneKit.startTick();
}

function pauseTimer() {
  state.running = false;
  clearInterval(state.timerId);
  $("#startPause").textContent = "Start";
  ToneKit.stopTick();
}

function resetTimer() {
  applyMode(state.mode);
}

function updateTimeUI() {
  $("#time").textContent = formatTime(state.remaining);
}

// ---- Tasks ----
const Tasks = {
  list: [],
  load() {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    this.list = raw ? JSON.parse(raw) : [];
  },
  save() {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(this.list));
  },
  add(text) {
    const t = { id: crypto.randomUUID(), text, done: false };
    this.list.push(t);
    this.save(); this.render();
  },
  toggle(id) {
    const t = this.list.find(x => x.id === id);
    if (t) { t.done = !t.done; this.save(); this.render(); }
  },
  remove(id) {
    this.list = this.list.filter(x => x.id !== id);
    this.save(); this.render();
  },
  edit(id, text) {
    const t = this.list.find(x => x.id === id);
    if (t) { t.text = text.trim(); this.save(); this.render(); }
  },
  clearDone() {
    this.list = this.list.filter(x => !x.done);
    this.save(); this.render();
  },
  render() {
    const ul = $("#taskList");
    ul.innerHTML = "";
    this.list.forEach(t => {
      const li = document.createElement("li");
      li.className = "task-item" + (t.done ? " completed" : "");
      li.innerHTML = `
        <input type="checkbox" ${t.done ? "checked": ""} aria-label="Toggle done">
        <span class="label" contenteditable="true"></span>
        <button class="btn small" aria-label="Delete">Delete</button>
      `;
      const checkbox = $("input", li);
      const label = $(".label", li);
      const del = $("button", li);
      label.textContent = t.text;

      checkbox.addEventListener("change", () => this.toggle(t.id));
      del.addEventListener("click", () => this.remove(t.id));

      label.addEventListener("blur", () => this.edit(t.id, label.textContent || ""));
      label.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); label.blur(); }
      });

      ul.appendChild(li);
    });

    // Stats
    const total = this.list.length;
    const done = this.list.filter(t => t.done).length;
    const left = total - done;
    $("#taskStats").textContent = total === 0 ? "No tasks" : `${left} left • ${done} done`;
  }
};

// ---- Init ----
document.addEventListener("DOMContentLoaded", () => {
  // Theme
  Theme.apply(Theme.load());
  $("#themeToggle").addEventListener("click", Theme.toggle);

  // Settings load
  loadSettings();
  // hydrate settings UI
  $("#durWork").value = state.settings.work;
  $("#durShort").value = state.settings.short;
  $("#durLong").value = state.settings.long;
  $("#tick").checked = state.settings.tick;
  $("#autoNext").checked = state.settings.autoNext;
  $("#volume").value = state.settings.volume;
  $("#cycleCount").textContent = localStorage.getItem(STORAGE_KEYS.CYCLE) || "0";

  // Timer
  applyMode("work");
  $$(".tab").forEach(b => b.addEventListener("click", () => applyMode(b.dataset.mode)));
  $("#startPause").addEventListener("click", () => state.running ? pauseTimer() : startTimer());
  $("#reset").addEventListener("click", resetTimer);

  $("#saveSettings").addEventListener("click", () => {
    state.settings.work = Math.max(1, parseInt($("#durWork").value || "25", 10));
    state.settings.short = Math.max(1, parseInt($("#durShort").value || "5", 10));
    state.settings.long = Math.max(1, parseInt($("#durLong").value || "15", 10));
    state.settings.tick = $("#tick").checked;
    state.settings.autoNext = $("#autoNext").checked;
    state.settings.volume = parseFloat($("#volume").value);
    saveSettings();
    ToneKit.setVolume(state.settings.volume);
    applyMode(state.mode); // reset time with new duration
    ToneKit.beep(880, 0.08);
  });

  // Tasks
  Tasks.load(); Tasks.render();

  $("#taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#taskInput");
    const text = (input.value || "").trim();
    if (!text) return;
    Tasks.add(text);
    input.value = "";
    ToneKit.beep(1320, 0.05);
  });

  $("#clearDone").addEventListener("click", () => {
    Tasks.clearDone();
    ToneKit.beep(660, 0.05);
  });

  // Wake audio context on first interaction (mobile)
  window.addEventListener("pointerdown", () => {
    try { ToneKit._ensure(); } catch {}
  }, { once: true });

});
