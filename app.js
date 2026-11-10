/**
 * Mint Day · Kim Oanh — Daily Planner & Focus Hub
 * Designed for single-screen zero-scroll productivity & public web sync.
 */
(() => {
  "use strict";

  const STORAGE_KEY = "mint-day-v2";
  const GITHUB_TOKEN_KEY = "mint_day_gh_token";
  const REPO_OWNER = "OanhKim-tmd";
  const REPO_NAME = "mint-day-kimoanh";
  const DATA_FILE_PATH = "data.json";

  const $ = id => document.getElementById(id);

  // Helper: Format Date YYYY-MM-DD
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);

  // Default initial data structure
  const blankState = () => ({
    version: 2,
    date: todayKey(),
    owner: "Kim Oanh",
    lastUpdated: new Date().toISOString(),
    tasks: [],
    active: null,
    elapsedToday: 0,
    history: {}
  });

  let state = loadLocalState();
  let filter = "all";
  let selectedId = null;
  let ticker = null;
  let toastTimer = null;
  let viewedDate = todayKey();
  let calendarMonth = new Date();

  // Load from local storage
  function loadLocalState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return blankState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.tasks)) return blankState();
      return {
        version: 2,
        date: parsed.date || todayKey(),
        owner: parsed.owner || "Kim Oanh",
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        tasks: parsed.tasks,
        active: parsed.active || null,
        elapsedToday: Number(parsed.elapsedToday) || 0,
        history: parsed.history && typeof parsed.history === "object" ? parsed.history : {}
      };
    } catch {
      return blankState();
    }
  }

  // Fetch data.json from web repository (so ANY browser sees Kim Oanh's live schedule)
  async function syncWithCloudData() {
    try {
      const res = await fetch(`./data.json?_t=${Date.now()}`);
      if (!res.ok) return;
      const cloudData = await res.json();
      if (!cloudData || !Array.isArray(cloudData.tasks)) return;

      const localHasData = state.tasks.length > 0 || Object.keys(state.history).length > 0;
      const localTime = new Date(state.lastUpdated || 0).getTime();
      const cloudTime = new Date(cloudData.lastUpdated || 0).getTime();

      // If user has no local data, or cloud data is fresher, sync cloud data
      if (!localHasData || cloudTime > localTime) {
        state = {
          version: 2,
          date: cloudData.date || todayKey(),
          owner: cloudData.owner || "Kim Oanh",
          lastUpdated: cloudData.lastUpdated || new Date().toISOString(),
          tasks: cloudData.tasks,
          active: cloudData.active || null,
          elapsedToday: Number(cloudData.elapsedToday) || 0,
          history: cloudData.history || {}
        };
        saveLocal();
        render();
        showToast("Đã tải lịch trình mới nhất của Kim Oanh 🌿");
      }
    } catch {
      // Local fallback silently
    }
  }

  // Save current state into local storage & history snapshot
  function snapshot(targetDate = state.date) {
    if (!state.history) state.history = {};
    state.history[targetDate] = {
      tasks: state.tasks.map(t => ({
        id: t.id,
        name: t.name,
        minutes: t.minutes,
        category: t.category,
        done: !!t.done,
        completedAt: t.completedAt || null
      })),
      focusSeconds: Math.max(0, Math.floor(state.elapsedToday)),
      savedAt: new Date().toISOString()
    };
    state.lastUpdated = new Date().toISOString();
  }

  function saveLocal() {
    snapshot();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      showToast("Bộ nhớ trình duyệt đầy, hãy xuất file sao lưu.");
    }
  }

  // Handle new calendar day rollover
  function rolloverIfNeeded() {
    const today = todayKey();
    if (state.date === today) return;

    snapshot(state.date);
    state.date = today;
    // Keep recurring tasks but reset completion for the new day
    state.tasks = state.tasks.map(t => ({ ...t, done: false, completedAt: null }));
    state.active = null;
    state.elapsedToday = 0;
    selectedId = null;
    saveLocal();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function dateObj(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function formatDisplayDate(key, opts = { weekday: "short", day: "numeric", month: "numeric", year: "numeric" }) {
    try {
      return new Intl.DateTimeFormat("vi-VN", opts).format(dateObj(key));
    } catch {
      return key;
    }
  }

  function showToast(message) {
    const t = $("toast");
    t.textContent = message;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
  }

  function playAlertSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    } catch {
      // Audio autoplay restrictions
    }
  }

  function currentTask() {
    return state.tasks.find(t => t.id === selectedId) || null;
  }

  function activeTask() {
    return state.active ? state.tasks.find(t => t.id === state.active.id) || null : null;
  }

  function isTodayView() {
    return viewedDate === todayKey();
  }

  function getDayRecord(key) {
    if (key === state.date) {
      return { tasks: state.tasks, focusSeconds: state.elapsedToday };
    }
    return state.history ? state.history[key] || null : null;
  }

  // ==========================================================
  // RENDER CONTROLLERS
  // ==========================================================
  function render() {
    rolloverIfNeeded();

    // Top Header info
    $("headerDate").textContent = formatDisplayDate(todayKey(), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    const doneCount = state.tasks.filter(t => t.done).length;
    const totalCount = state.tasks.length;
    const focusMinutes = Math.floor(state.elapsedToday / 60);

    $("headerSummary").textContent = `${doneCount}/${totalCount} việc xong · ${focusMinutes}m tập trung`;

    renderTasksColumn();
    renderTimerColumn();
    renderCalendarColumn();
    renderHistoryDetail();
  }

  function renderTasksColumn() {
    const today = isTodayView();
    const tasks = today ? state.tasks : (getDayRecord(viewedDate)?.tasks || []);
    const done = tasks.filter(t => t.done).length;
    const total = tasks.length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    $("taskCountBadge").textContent = total;
    $("taskPanelTitle").textContent = today ? "Kế hoạch hôm nay" : `Ngày ${formatDisplayDate(viewedDate, { day: "numeric", month: "numeric" })}`;
    $("taskProgressFill").style.width = `${pct}%`;
    $("progressPercent").textContent = `${pct}%`;

    if (total === 0) {
      $("progressNote").textContent = today ? "Thêm một việc nhỏ để bắt đầu ngày" : "Không có dữ liệu trong ngày này";
    } else if (done === total) {
      $("progressNote").textContent = "Tuyệt vời! Bạn đã hoàn thành toàn bộ mục tiêu 🎉";
    } else {
      $("progressNote").textContent = `Đã hoàn thành ${done}/${total} việc · Cố lên nào!`;
    }

    // History Banner
    const banner = $("historyBanner");
    if (!today) {
      banner.hidden = false;
      $("historyBannerDate").textContent = formatDisplayDate(viewedDate, { day: "numeric", month: "long" });
    } else {
      banner.hidden = true;
    }

    // Filter Tasks
    const visible = tasks.filter(t => {
      if (filter === "active") return !t.done;
      if (filter === "done") return t.done;
      return true;
    });

    const listEl = $("taskList");
    const emptyEl = $("emptyState");

    if (tasks.length === 0) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      $("emptyAddBtn").style.display = today ? "inline-flex" : "none";
    } else {
      emptyEl.style.display = "none";
      if (visible.length === 0) {
        listEl.innerHTML = '<div class="history-empty-text">Không có công việc nào trong mục lọc này.</div>';
      } else {
        listEl.innerHTML = visible.map(t => `
          <div class="task-card ${t.done ? "completed" : ""} ${today && selectedId === t.id ? "active-selected" : ""}" data-id="${escapeHtml(t.id)}">
            <button class="check-trigger" data-action="toggle" title="${t.done ? "Bỏ hoàn thành" : "Đánh dấu hoàn thành"}">
              ${t.done ? "✓" : ""}
            </button>
            <div class="task-body" data-action="select">
              <div class="task-text">${escapeHtml(t.name)}</div>
              <div class="task-meta-row">
                <span class="category-chip">${escapeHtml(t.category || "Học tập")}</span>
                <span class="duration-chip">⏱ ${t.minutes} phút</span>
              </div>
            </div>
            ${today ? `
            <div class="task-actions">
              <button class="task-tool-btn" data-action="edit" title="Sửa">✎</button>
              <button class="task-tool-btn" data-action="delete" title="Xóa">✕</button>
            </div>` : ""}
          </div>
        `).join("");
      }
    }
  }

  function renderTimerColumn() {
    const today = isTodayView();
    const task = today ? (activeTask() || currentTask()) : null;
    const active = today ? state.active : null;

    if (!task) {
      $("timerTaskName").textContent = "Chọn một việc ở bên trái";
      $("timerCategoryTag").textContent = "Chưa chọn mục";
      $("timerDurationTag").textContent = "--";
      $("timerDisplay").textContent = "00:00";
      $("timerStatusCaption").textContent = "CHỌN VIỆC ĐỂ FOCUS";
      $("timerModeTag").textContent = "SẴN SÀNG";
      $("startPauseBtn").disabled = true;
      $("resetTimerBtn").disabled = true;
      $("startPauseText").textContent = "Bắt đầu";
      $("startPauseIcon").textContent = "▶";
      setRing(0);
      return;
    }

    $("timerTaskName").textContent = task.name;
    $("timerCategoryTag").textContent = task.category || "Chung";
    $("timerDurationTag").textContent = `${task.minutes} phút`;

    const doneCount = state.tasks.filter(t => t.done).length;
    const totalCount = state.tasks.length;
    $("statDoneCount").textContent = `${doneCount}/${totalCount}`;
    $("statFocusTime").textContent = `${Math.floor(state.elapsedToday / 60)}m`;
    $("statProductivity").textContent = totalCount ? `${Math.round((doneCount / totalCount) * 100)}%` : "0%";

    if (!active) {
      $("timerDisplay").textContent = formatClock(task.minutes * 60);
      $("timerStatusCaption").textContent = task.done ? "ĐÃ HOÀN THÀNH" : "SẴN SÀNG BẮT ĐẦU";
      $("timerModeTag").textContent = task.done ? "HOÀN TẤT" : "CHỜ BẮT ĐẦU";
      $("startPauseBtn").disabled = !!task.done;
      $("resetTimerBtn").disabled = true;
      $("startPauseText").textContent = "Bắt đầu";
      $("startPauseIcon").textContent = "▶";
      setRing(0);
      return;
    }

    const remaining = remainingSeconds(active);
    $("timerDisplay").textContent = formatClock(remaining);
    $("timerStatusCaption").textContent = active.running ? "ĐANG TẬP TRUNG" : "TẠM DỪNG";
    $("timerModeTag").textContent = active.running ? "ĐANG CHẠY" : "TẠM DỪNG";
    $("startPauseBtn").disabled = false;
    $("resetTimerBtn").disabled = false;
    $("startPauseText").textContent = active.running ? "Tạm dừng" : "Tiếp tục";
    $("startPauseIcon").textContent = active.running ? "⏸" : "▶";

    setRing(1 - remaining / (task.minutes * 60));
  }

  function formatClock(seconds) {
    seconds = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function remainingSeconds(active) {
    const task = state.tasks.find(t => t.id === active.id);
    if (!task) return 0;
    const spent = active.elapsed + (active.running ? Math.max(0, (Date.now() - active.startedAt) / 1000) : 0);
    return Math.max(0, task.minutes * 60 - spent);
  }

  function setRing(fraction) {
    const circumference = 2 * Math.PI * 95; // r = 95
    const offset = circumference * (1 - Math.max(0, Math.min(1, fraction)));
    $("ringFill").style.strokeDasharray = circumference;
    $("ringFill").style.strokeDashoffset = offset;
  }

  function selectTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    if (state.active && state.active.id !== id) {
      showToast("Vui lòng hoàn thành hoặc đặt lại công việc đang chạy trước.");
      return;
    }
    selectedId = id;
    render();
  }

  function startPauseTimer() {
    if (!isTodayView()) return;
    const task = activeTask() || currentTask();
    if (!task || task.done) return;

    if (!state.active) {
      state.active = { id: task.id, elapsed: 0, startedAt: Date.now(), running: true };
    } else if (state.active.running) {
      state.active.elapsed += (Date.now() - state.active.startedAt) / 1000;
      state.active.running = false;
    } else {
      state.active.startedAt = Date.now();
      state.active.running = true;
    }

    selectedId = task.id;
    saveLocal();
    render();

    if (!ticker) ticker = setInterval(tick, 250);
  }

  function tick() {
    rolloverIfNeeded();
    if (!state.active) {
      clearInterval(ticker);
      ticker = null;
      render();
      return;
    }

    const remaining = remainingSeconds(state.active);
    if (remaining <= 0) {
      const task = activeTask();
      if (task) {
        task.done = true;
        task.completedAt = new Date().toISOString();
        state.elapsedToday += task.minutes * 60;
        playAlertSound();
        showToast(`Tuyệt vời! "${task.name}" đã hoàn thành! 🌿`);
      }
      state.active = null;
      saveLocal();
      render();
      clearInterval(ticker);
      ticker = null;
      return;
    }

    $("timerDisplay").textContent = formatClock(remaining);
    const task = activeTask();
    if (task) setRing(1 - remaining / (task.minutes * 60));
  }

  function resetTimer() {
    if (!state.active) return;
    state.active = null;
    saveLocal();
    render();
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
    showToast("Đã đặt lại đồng hồ tập trung.");
  }

  function toggleTaskDone(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    if (state.active?.id === id) resetTimer();

    task.done = !task.done;
    task.completedAt = task.done ? new Date().toISOString() : null;
    saveLocal();
    render();
    if (task.done) playAlertSound();
  }

  // ==========================================================
  // CALENDAR & HISTORY LOG
  // ==========================================================
  function renderCalendarColumn() {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();

    $("monthLabel").textContent = new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(calendarMonth);

    const firstDay = new Date(y, m, 1);
    const totalDays = new Date(y, m + 1, 0).getDate();
    // Monday first
    const startOffset = (firstDay.getDay() + 6) % 7;
    const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

    let html = weekdays.map(w => `<div class="cal-header-day">${w}</div>`).join("");

    for (let i = 0; i < startOffset; i++) {
      html += '<div class="cal-cell is-empty"></div>';
    }

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(y, m, day);
      const key = dateKey(d);
      const isFuture = key > todayKey();
      const hasData = !!getDayRecord(key);
      const isSelected = key === viewedDate;
      const isToday = key === todayKey();

      html += `
        <button class="cal-cell ${hasData ? "has-data" : ""} ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""} ${isFuture ? "is-future" : ""}"
          data-date="${key}" ${isFuture ? "disabled" : ""}>
          ${day}
        </button>
      `;
    }

    $("calendarGrid").innerHTML = html;
  }

  function renderHistoryDetail() {
    const rec = getDayRecord(viewedDate);
    $("detailDateText").textContent = isTodayView() ? "Hôm nay" : formatDisplayDate(viewedDate, { weekday: "short", day: "numeric", month: "numeric", year: "numeric" });

    if (!rec || !rec.tasks || rec.tasks.length === 0) {
      $("detailDoneText").textContent = "0/0";
      $("detailFocusText").textContent = "0m";
      $("detailRateText").textContent = "0%";
      $("detailRateBadge").textContent = "0% xong";
      $("historyTasksScroll").innerHTML = '<p class="history-empty-text">Chưa có bản ghi nào cho ngày này.</p>';
      return;
    }

    const tasks = rec.tasks;
    const done = tasks.filter(t => t.done).length;
    const rate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const focusMins = Math.floor((rec.focusSeconds || 0) / 60);

    $("detailDoneText").textContent = `${done}/${tasks.length}`;
    $("detailFocusText").textContent = `${focusMins}m`;
    $("detailRateText").textContent = `${rate}%`;
    $("detailRateBadge").textContent = `${rate}% xong`;

    $("historyTasksScroll").innerHTML = tasks.map(t => `
      <div class="history-task-row">
        <span class="history-task-name">${escapeHtml(t.name)} · ${t.minutes}m</span>
        <span class="history-task-badge ${t.done ? "done" : "pending"}">${t.done ? "✓ Xong" : "Chưa"}</span>
      </div>
    `).join("");
  }

  // ==========================================================
  // MODALS & ACTIONS
  // ==========================================================
  function openTaskDialog(task = null) {
    const form = $("taskForm");
    form.dataset.editId = task ? task.id : "";
    $("dialogTitle").textContent = task ? "Chỉnh sửa công việc" : "Thêm công việc mới";
    $("taskName").value = task ? task.name : "";
    $("taskMinutes").value = task ? task.minutes : 25;
    $("taskCategory").value = task ? task.category : "Học tập";
    $("taskDialog").showModal();
    $("taskName").focus();
  }

  function closeTaskDialog() {
    $("taskDialog").close();
  }

  // GITHUB WEB SYNC
  function openSyncDialog() {
    const token = localStorage.getItem(GITHUB_TOKEN_KEY) || "";
    $("githubTokenInput").value = token;
    $("tokenStatusNote").textContent = token ? "✓ Đã lưu token trên máy này." : "";
    $("syncDialog").showModal();
  }

  function closeSyncDialog() {
    $("syncDialog").close();
  }

  async function publishDataToGitHub() {
    const token = $("githubTokenInput").value.trim();
    if (!token) {
      alert("Vui lòng nhập GitHub Personal Access Token để xuất bản.");
      return;
    }

    localStorage.setItem(GITHUB_TOKEN_KEY, token);
    $("publishToGitHubBtn").disabled = true;
    $("publishToGitHubBtn").textContent = "Đang tải lên...";

    try {
      snapshot();
      const contentStr = JSON.stringify(state, null, 2);
      const contentB64 = btoa(unescape(encodeURIComponent(contentStr)));

      // Step 1: Get current file SHA
      const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE_PATH}`;
      const getRes = await fetch(getUrl, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github.v3+json"
        }
      });

      let sha = null;
      if (getRes.ok) {
        const fileInfo = await getRes.json();
        sha = fileInfo.sha;
      }

      // Step 2: Put update
      const putRes = await fetch(getUrl, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/vnd.github.v3+json"
        },
        body: JSON.stringify({
          message: `Update schedule: ${state.date} (${state.tasks.length} tasks)`,
          content: contentB64,
          sha: sha || undefined
        })
      });

      if (!putRes.ok) {
        const err = await putRes.json();
        throw new Error(err.message || "Lỗi cập nhật GitHub");
      }

      showToast("Đã đồng bộ lịch trình lên Web thành công! 🎉");
      $("tokenStatusNote").textContent = "✓ Đồng bộ thành công lúc " + new Date().toLocaleTimeString();
    } catch (err) {
      alert("Không thể cập nhật GitHub: " + err.message);
    } finally {
      $("publishToGitHubBtn").disabled = false;
      $("publishToGitHubBtn").textContent = "Lưu & Xuất bản";
    }
  }

  // ==========================================================
  // EVENT LISTENERS BINDING
  // ==========================================================
  $("taskForm").addEventListener("submit", e => {
    e.preventDefault();
    if (!isTodayView()) return;

    const name = $("taskName").value.trim();
    const minutes = parseInt($("taskMinutes").value, 10);
    const category = $("taskCategory").value;

    if (!name || isNaN(minutes) || minutes < 1 || minutes > 1440) {
      showToast("Vui lòng nhập tên việc và thời lượng hợp lệ.");
      return;
    }

    const editId = $("taskForm").dataset.editId;
    if (editId) {
      const t = state.tasks.find(x => x.id === editId);
      if (t) {
        t.name = name;
        t.minutes = minutes;
        t.category = category;
        showToast("Đã cập nhật công việc.");
      }
    } else {
      const newTask = {
        id: uid(),
        name,
        minutes,
        category,
        done: false,
        completedAt: null
      };
      state.tasks.push(newTask);
      selectedId = newTask.id;
      showToast("Đã thêm công việc mới!");
    }

    saveLocal();
    closeTaskDialog();
    render();
  });

  $("taskList").addEventListener("click", e => {
    const card = e.target.closest(".task-card");
    if (!card || !isTodayView()) return;
    const id = card.dataset.id;
    const action = e.target.closest("[data-action]")?.dataset.action;

    if (action === "toggle") {
      toggleTaskDone(id);
    } else if (action === "select") {
      selectTask(id);
    } else if (action === "edit") {
      const t = state.tasks.find(x => x.id === id);
      if (t) openTaskDialog(t);
    } else if (action === "delete") {
      if (state.active?.id === id) resetTimer();
      state.tasks = state.tasks.filter(t => t.id !== id);
      if (selectedId === id) selectedId = null;
      saveLocal();
      render();
      showToast("Đã xóa công việc.");
    }
  });

  $("filterGroup").addEventListener("click", e => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    filter = btn.dataset.filter;
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b === btn));
    renderTasksColumn();
  });

  $("calendarGrid").addEventListener("click", e => {
    const cell = e.target.closest(".cal-cell");
    if (!cell || cell.disabled || cell.classList.contains("is-empty")) return;
    viewedDate = cell.dataset.date;
    render();
  });

  $("prevMonthBtn").addEventListener("click", () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    renderCalendarColumn();
  });

  $("nextMonthBtn").addEventListener("click", () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    renderCalendarColumn();
  });

  $("returnTodayBtn").addEventListener("click", () => {
    viewedDate = todayKey();
    render();
  });

  $("openAddBtn").addEventListener("click", () => openTaskDialog());
  $("emptyAddBtn").addEventListener("click", () => openTaskDialog());
  $("closeDialogBtn").addEventListener("click", closeTaskDialog);
  $("cancelDialogBtn").addEventListener("click", closeTaskDialog);

  $("startPauseBtn").addEventListener("click", startPauseTimer);
  $("resetTimerBtn").addEventListener("click", resetTimer);

  // Sync modal
  $("openSyncModalBtn").addEventListener("click", openSyncDialog);
  $("closeSyncBtn").addEventListener("click", closeSyncDialog);
  $("publishToGitHubBtn").addEventListener("click", publishDataToGitHub);

  $("downloadDataJsonBtn").addEventListener("click", () => {
    snapshot();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Đã tải file data.json.");
  });

  $("reloadFromCloudBtn").addEventListener("click", async () => {
    await syncWithCloudData();
    closeSyncDialog();
  });

  // Export / Import
  $("exportBtn").addEventListener("click", () => {
    snapshot();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mint-day-kimoanh-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Đã xuất bản sao lưu đầy đủ lịch sử!");
  });

  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.tasks)) throw new Error("Format không hợp lệ");
      state = {
        version: 2,
        date: data.date || todayKey(),
        owner: data.owner || "Kim Oanh",
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        tasks: data.tasks,
        active: null,
        elapsedToday: Number(data.elapsedToday) || 0,
        history: data.history && typeof data.history === "object" ? data.history : {}
      };
      rolloverIfNeeded();
      viewedDate = todayKey();
      selectedId = null;
      saveLocal();
      render();
      showToast("Đã nhập dữ liệu thành công!");
    } catch {
      showToast("File sao lưu không hợp lệ.");
    }
    e.target.value = "";
  });

  // Background and tick handling
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.active?.running) tick();
  });

  window.addEventListener("beforeunload", saveLocal);

  // Auto snapshot every 20s
  setInterval(() => {
    rolloverIfNeeded();
    saveLocal();
    if (viewedDate === todayKey()) renderCalendarColumn();
  }, 20000);

  // Startup initialization
  rolloverIfNeeded();
  if (state.active?.running && remainingSeconds(state.active) <= 0) {
    tick();
  } else if (state.active?.running) {
    ticker = setInterval(tick, 250);
  }

  render();
  // Fetch cloud data on load
  syncWithCloudData();
})();
