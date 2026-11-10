(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "mint-day-v1";
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  let state = loadState();
  let filter = "all";
  let selectedId = null;
  let ticker = null;
  let toastTimer = null;

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return { date: parsed.date || todayKey(), tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [], active: parsed.active || null, elapsedToday: Number(parsed.elapsedToday) || 0 };
    } catch { return { date: todayKey(), tasks: [], active: null, elapsedToday: 0 }; }
  }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function rollDayIfNeeded() {
    if (state.date !== todayKey()) {
      // Keep the task list as a daily checklist, but reset completion for the new date.
      state.date = todayKey();
      state.tasks = state.tasks.map(t => ({...t, done:false, completedAt:null}));
      state.active = null;
      state.elapsedToday = 0;
      selectedId = null;
      save();
    }
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function formatDate() {
    const d = new Date();
    return new Intl.DateTimeFormat("vi-VN", { weekday:"long", day:"numeric", month:"long", year:"numeric" }).format(d);
  }
  function showToast(message) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2400);
  }
  function currentTask() { return state.tasks.find(t => t.id === selectedId) || null; }
  function activeTask() { return state.active ? state.tasks.find(t => t.id === state.active.id) : null; }

  function render() {
    rollDayIfNeeded();
    $("todayLabel").textContent = formatDate();
    $("dateChip").textContent = formatDate();
    const done = state.tasks.filter(t => t.done).length;
    $("doneCount").textContent = done;
    $("totalCount").textContent = state.tasks.length;
    $("allFilterCount").textContent = state.tasks.length;
    $("progressFill").style.width = `${state.tasks.length ? done/state.tasks.length*100 : 0}%`;
    $("progressNote").textContent = state.tasks.length && done === state.tasks.length ? "Bạn đã hoàn thành mọi việc. Tuyệt vời! ✨" : done ? `Bạn đã hoàn thành ${done} việc. Cứ tiếp tục nhé 🌱` : "Bắt đầu bằng một việc nhỏ nhé 🌱";
    $("focusMinutes").textContent = Math.floor(state.elapsedToday / 60);
    document.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b.dataset.filter === filter));

    const visible = state.tasks.filter(t => filter === "all" || (filter === "done" ? t.done : !t.done));
    $("taskList").innerHTML = visible.map(t => `
      <article class="task-item ${t.done ? "completed" : ""} ${selectedId === t.id ? "selected" : ""}" data-id="${escapeHtml(t.id)}">
        <button class="check-btn" data-action="toggle" aria-label="${t.done ? "Bỏ hoàn thành" : "Đánh dấu hoàn thành"}">${t.done ? "✓" : ""}</button>
        <div class="task-main" data-action="select">
          <div class="task-name">${escapeHtml(t.name)}</div>
          <div class="task-meta"><span class="category-tag">${escapeHtml(t.category)}</span><span>◷ ${t.minutes} min</span></div>
        </div>
        <div class="task-tools"><span class="duration">${t.done ? "Done ✓" : " "}</span><button class="mini-btn" data-action="edit" title="Sửa task">✎</button><button class="mini-btn" data-action="delete" title="Xóa task">×</button></div>
      </article>`).join("");
    $("emptyState").style.display = state.tasks.length ? "none" : "block";
    if (state.tasks.length && !visible.length) {
      $("taskList").innerHTML = `<div class="empty-state"><div class="empty-illustration">✿</div><h3>Chưa có task ở đây</h3><p>Thử chọn bộ lọc khác nhé.</p></div>`;
    }
    renderTimer();
  }

  function renderTimer() {
    const task = currentTask();
    const active = state.active;
    if (active && !activeTask()) state.active = null;
    const runningTask = activeTask();
    const displayTask = runningTask || task;
    $("timerTaskName").textContent = displayTask ? displayTask.name : "Choose a task";
    $("timerHint").textContent = runningTask ? `${runningTask.category} · ${runningTask.minutes} phút` : task ? `${task.category} · ${task.minutes} phút · Sẵn sàng bắt đầu` : "Chọn một task bên trái để bắt đầu tập trung.";
    $("startPauseBtn").disabled = !displayTask || !!(task && task.done && !runningTask);
    $("resetTimerBtn").disabled = !active;
    if (!active || !runningTask) {
      const seconds = displayTask ? displayTask.minutes * 60 : 0;
      $("timerDisplay").textContent = clock(seconds);
      $("timerStatus").textContent = displayTask ? "READY WHEN YOU ARE" : "READY WHEN YOU ARE";
      $("startPauseBtn").textContent = "▶ Start";
      setRing(0);
      return;
    }
    const remaining = remainingSeconds(active);
    $("timerDisplay").textContent = clock(remaining);
    $("timerStatus").textContent = active.running ? "FOCUS IN PROGRESS" : "PAUSED";
    $("startPauseBtn").textContent = active.running ? "Ⅱ Pause" : "▶ Resume";
    setRing(1 - remaining / (runningTask.minutes * 60));
  }
  function clock(seconds) {
    seconds = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  }
  function remainingSeconds(active) {
    const task = state.tasks.find(t => t.id === active.id);
    if (!task) return 0;
    const spent = active.elapsed + (active.running ? Math.max(0, (Date.now()-active.startedAt)/1000) : 0);
    return Math.max(0, task.minutes*60-spent);
  }
  function setRing(fraction) {
    const circumference = 2*Math.PI*96;
    $("ringProgress").style.strokeDasharray = circumference;
    $("ringProgress").style.strokeDashoffset = circumference * (1-Math.max(0,Math.min(1,fraction)));
  }
  function selectTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    if (state.active && state.active.id !== id) {
      showToast("Hãy hoàn thành hoặc đặt lại timer hiện tại trước nhé.");
      return;
    }
    selectedId = id;
    render();
  }
  function startPause() {
    const task = activeTask() || currentTask();
    if (!task || task.done) return;
    if (!state.active) {
      state.active = { id:task.id, elapsed:0, startedAt:Date.now(), running:true };
    } else if (state.active.running) {
      state.active.elapsed += (Date.now()-state.active.startedAt)/1000;
      state.active.running = false;
    } else {
      state.active.startedAt = Date.now();
      state.active.running = true;
    }
    selectedId = task.id;
    save(); render();
    if (!ticker) ticker = setInterval(tick, 250);
  }
  function tick() {
    if (!state.active) { clearInterval(ticker); ticker=null; return; }
    const remaining = remainingSeconds(state.active);
    if (remaining <= 0) {
      const task = activeTask();
      if (task) {
        task.done = true;
        task.completedAt = new Date().toISOString();
        state.elapsedToday += task.minutes * 60;
        showToast(`"${task.name}" đã hoàn thành. Giỏi lắm! ✨`);
      }
      state.active = null;
      save(); render();
      clearInterval(ticker); ticker=null;
      return;
    }
    $("timerDisplay").textContent = clock(remaining);
    const task = activeTask();
    if (task) setRing(1-remaining/(task.minutes*60));
  }
  function resetTimer() {
    if (!state.active) return;
    state.active = null;
    save(); render();
    clearInterval(ticker); ticker=null;
    showToast("Timer đã được đặt lại.");
  }
  function toggleDone(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    if (state.active && state.active.id === id) resetTimer();
    task.done = !task.done;
    task.completedAt = task.done ? new Date().toISOString() : null;
    save(); render();
  }
  function openDialog(task=null) {
    $("taskForm").dataset.editId = task ? task.id : "";
    $("dialogTitle").textContent = task ? "Edit your task" : "Add a little task";
    $("taskName").value = task ? task.name : "";
    $("taskMinutes").value = task ? task.minutes : 5;
    $("taskCategory").value = task ? task.category : "Morning";
    $("taskDialog").showModal();
    $("taskName").focus();
  }
  function closeDialog() { $("taskDialog").close(); }
  $("taskForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("taskName").value.trim();
    const minutes = Number($("taskMinutes").value);
    if (!name || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      showToast("Nhập tên task và thời gian từ 1 đến 1440 phút nhé.");
      return;
    }
    const editId = $("taskForm").dataset.editId;
    if (editId) {
      const task = state.tasks.find(t => t.id === editId);
      if (task) { task.name=name; task.minutes=minutes; task.category=$("taskCategory").value; }
      showToast("Đã cập nhật task.");
    } else {
      const task = {id:uid(), name, minutes, category:$("taskCategory").value, done:false, completedAt:null};
      state.tasks.push(task); selectedId=task.id;
      showToast("Đã thêm task mới!");
    }
    save(); closeDialog(); render();
  });
  $("taskList").addEventListener("click", e => {
    const item = e.target.closest(".task-item");
    if (!item) return;
    const id = item.dataset.id;
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "toggle") toggleDone(id);
    else if (action === "select") selectTask(id);
    else if (action === "edit") {
      const task = state.tasks.find(t => t.id === id);
      if (task) openDialog(task);
    } else if (action === "delete") {
      if (state.active?.id === id) resetTimer();
      state.tasks = state.tasks.filter(t => t.id !== id);
      if (selectedId === id) selectedId=null;
      save(); render(); showToast("Đã xóa task.");
    }
  });
  $("filters").addEventListener("click", e => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    filter=b.dataset.filter; render();
  });
  $("openAdd").addEventListener("click", () => openDialog());
  $("emptyAdd").addEventListener("click", () => openDialog());
  $("closeDialog").addEventListener("click", closeDialog);
  $("cancelDialog").addEventListener("click", closeDialog);
  $("startPauseBtn").addEventListener("click", startPause);
  $("resetTimerBtn").addEventListener("click", resetTimer);
  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
    const url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url; a.download=`mint-day-backup-${todayKey()}.json`; a.click(); URL.revokeObjectURL(url);
    showToast("Đã xuất bản sao dữ liệu.");
  });
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async e => {
    const file=e.target.files[0]; if (!file) return;
    try {
      const data=JSON.parse(await file.text());
      if (!Array.isArray(data.tasks)) throw new Error("invalid");
      state={date:todayKey(),tasks:data.tasks.map(t=>({...t,done:false,completedAt:null})),active:null,elapsedToday:0};
      selectedId=null; save(); render(); showToast("Đã nhập dữ liệu. Checklist hôm nay được làm mới.");
    } catch { showToast("File không hợp lệ."); }
    e.target.value="";
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.active?.running) tick();
  });
  window.addEventListener("beforeunload", save);
  render();
  if (state.active?.running) {
    // Recover elapsed time from timestamps if the tab/browser was closed.
    if (remainingSeconds(state.active) <= 0) tick();
    else ticker=setInterval(tick,250);
  }
})();