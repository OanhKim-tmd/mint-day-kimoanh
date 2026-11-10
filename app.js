(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = "mint-day-v2";
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const blankState = () => ({version:2,date:todayKey(),tasks:[],active:null,elapsedToday:0,history:{}});
  let state = loadState();
  let filter = "all", selectedId = null, ticker = null, toastTimer = null;
  let viewedDate = todayKey();
  let calendarMonth = new Date();

  function loadState() {
    try {
      let old = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      // One-time migration from the first release so existing tasks are not lost.
      if (!old) {
        const v1 = JSON.parse(localStorage.getItem("mint-day-v1") || "null");
        if (v1 && Array.isArray(v1.tasks)) {
          old = {...v1, history:{}};
          localStorage.setItem(STORAGE_KEY, JSON.stringify({version:2,date:old.date||todayKey(),tasks:old.tasks,active:old.active||null,elapsedToday:Number(old.elapsedToday)||0,history:{}}));
        }
      }
      if (!old || !Array.isArray(old.tasks)) return blankState();
      return {version:2,date:old.date || todayKey(),tasks:old.tasks,active:old.active || null,elapsedToday:Number(old.elapsedToday)||0,history:old.history && typeof old.history==="object" ? old.history : {}};
    } catch { return blankState(); }
  }
  function snapshot(date=state.date) {
    state.history[date] = {
      tasks: state.tasks.map(t => ({id:t.id,name:t.name,minutes:t.minutes,category:t.category,done:!!t.done,completedAt:t.completedAt||null})),
      focusSeconds: Math.max(0,Math.floor(state.elapsedToday)),
      savedAt: new Date().toISOString()
    };
  }
  function save() {
    snapshot();
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
    catch { showToast("Không thể lưu thêm dữ liệu. Hãy xuất bản sao và kiểm tra dung lượng trình duyệt."); }
  }
  function rolloverIfNeeded() {
    const today=todayKey();
    if(state.date===today) return;
    // Archive the previous day before resetting today's checklist.
    snapshot(state.date);
    state.date=today;
    state.tasks=state.tasks.map(t=>({...t,done:false,completedAt:null}));
    state.active=null;
    state.elapsedToday=0;
    selectedId=null;
    save();
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function dateObj(key) { const [y,m,d]=key.split("-").map(Number); return new Date(y,m-1,d); }
  function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function prettyDate(key,opts={weekday:"long",day:"numeric",month:"long",year:"numeric"}) {
    return new Intl.DateTimeFormat("vi-VN",opts).format(dateObj(key));
  }
  function showToast(message) {
    $("toast").textContent=message; $("toast").classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>$("toast").classList.remove("show"),2600);
  }
  function currentTask() { return state.tasks.find(t=>t.id===selectedId)||null; }
  function activeTask() { return state.active ? state.tasks.find(t=>t.id===state.active.id)||null : null; }
  function isTodayView() { return viewedDate===todayKey(); }
  function dayRecord(key) {
    if(key===state.date) {
      return {tasks:state.tasks,focusSeconds:state.elapsedToday};
    }
    return state.history[key] || null;
  }
  function render() {
    rolloverIfNeeded();
    $("todayLabel").textContent=prettyDate(todayKey(),{weekday:"short",day:"numeric",month:"short",year:"numeric"});
    $("dateChip").textContent=prettyDate(todayKey(),{day:"numeric",month:"long",year:"numeric"});
    renderTasks(); renderTimer(); renderCalendar(); renderHistoryDetail();
  }
  function renderTasks() {
    const today=isTodayView();
    const tasks=today?state.tasks:(dayRecord(viewedDate)?.tasks||[]);
    const done=tasks.filter(t=>t.done).length;
    if(today) {
      $("doneCount").textContent=done; $("totalCount").textContent=tasks.length;
      $("allFilterCount").textContent=tasks.length;
      $("progressFill").style.width=`${tasks.length?done/tasks.length*100:0}%`;
      $("progressNote").textContent=tasks.length&&done===tasks.length?"Bạn đã hoàn thành mọi việc. Tuyệt vời!":done?`Bạn đã hoàn thành ${done} việc. Cứ tiếp tục nhé.`:"Bắt đầu bằng một việc nhỏ nhé.";
      $("focusMinutes").textContent=Math.floor(state.elapsedToday/60);
    } else {
      $("doneCount").textContent=done; $("totalCount").textContent=tasks.length;
      $("allFilterCount").textContent=tasks.length;
      $("progressFill").style.width=`${tasks.length?done/tasks.length*100:0}%`;
      $("progressNote").textContent=`Đang xem lịch sử ngày ${prettyDate(viewedDate,{day:"numeric",month:"short"})}`;
      $("focusMinutes").textContent=Math.floor((dayRecord(viewedDate)?.focusSeconds||0)/60);
    }
    $("taskHeading").innerHTML=today?"Today's tasks <span class=\"heading-flower\">✿</span>":`${escapeHtml(prettyDate(viewedDate,{day:"numeric",month:"long"}))} <span class="heading-flower">✿</span>`;
    $("taskDescription").textContent=today?"Chọn một việc để bắt đầu đếm giờ.":"Bản ghi checklist đã lưu của ngày này.";
    $("openAdd").hidden=!today;
    $("historyReadonly").hidden=today;
    const visible=tasks.filter(t=>filter==="all"||(filter==="done"?t.done:!t.done));
    $("taskList").innerHTML=visible.map(t=>`
      <article class="task-item ${t.done?"completed":""} ${today&&selectedId===t.id?"selected":""}" data-id="${escapeHtml(t.id)}">
        ${today?`<button class="check-btn" data-action="toggle" aria-label="${t.done?"Bỏ hoàn thành":"Đánh dấu hoàn thành"}">${t.done?"✓":""}</button>`:`<span class="check-btn" aria-hidden="true">${t.done?"✓":""}</span>`}
        <div class="task-main" ${today?'data-action="select"':""}>
          <div class="task-name">${escapeHtml(t.name)}</div>
          <div class="task-meta"><span class="category-tag">${escapeHtml(t.category)}</span><span>◷ ${t.minutes} min</span></div>
        </div>
        <div class="task-tools"><span class="duration">${t.done?"Done ✓":""}</span>${today?`<button class="mini-btn" data-action="edit" title="Sửa task">✎</button><button class="mini-btn" data-action="delete" title="Xóa task">×</button>`:""}</div>
      </article>`).join("");
    $("emptyState").style.display=tasks.length?"none":"block";
    $("emptyState").querySelector("h3").textContent=today?"Chưa có task nào":"Không có dữ liệu cho ngày này";
    $("emptyState").querySelector("p").textContent=today?"Thêm việc đầu tiên để tạo checklist hằng ngày của bạn.":"Ngày này chưa có bản ghi được lưu.";
    $("emptyAdd").hidden=!today;
    if(tasks.length&&!visible.length) $("taskList").innerHTML='<div class="no-history">Không có task trong bộ lọc này.</div>';
    document.querySelectorAll(".filter").forEach(b=>b.classList.toggle("active",b.dataset.filter===filter));
  }
  function renderTimer() {
    const task=isTodayView()?(activeTask()||currentTask()):null, active=isTodayView()?state.active:null;
    $("timerTaskName").textContent=task?task.name:"Choose a task";
    $("timerHint").textContent=active?`${task.category} · ${task.minutes} phút`:task?`${task.category} · ${task.minutes} phút · Sẵn sàng bắt đầu`:"Chọn một task hôm nay để bắt đầu.";
    $("startPauseBtn").disabled=!task||!!(currentTask()?.done&&!active);
    $("resetTimerBtn").disabled=!active;
    if(!active||!task) {
      $("timerDisplay").textContent=clock(task?task.minutes*60:0);
      $("timerStatus").textContent="READY WHEN YOU ARE";
      $("startPauseBtn").textContent="▶ Start"; setRing(0); return;
    }
    const remaining=remainingSeconds(active);
    $("timerDisplay").textContent=clock(remaining);
    $("timerStatus").textContent=active.running?"FOCUS IN PROGRESS":"PAUSED";
    $("startPauseBtn").textContent=active.running?"Ⅱ Pause":"▶ Resume";
    setRing(1-remaining/(task.minutes*60));
  }
  function clock(seconds) { seconds=Math.max(0,Math.ceil(seconds)); return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`; }
  function remainingSeconds(active) {
    const task=state.tasks.find(t=>t.id===active.id); if(!task)return 0;
    const spent=active.elapsed+(active.running?Math.max(0,(Date.now()-active.startedAt)/1000):0);
    return Math.max(0,task.minutes*60-spent);
  }
  function setRing(fraction) {
    const c=2*Math.PI*96;
    $("ringProgress").style.strokeDasharray=c;
    $("ringProgress").style.strokeDashoffset=c*(1-Math.max(0,Math.min(1,fraction)));
  }
  function selectTask(id) {
    const task=state.tasks.find(t=>t.id===id); if(!task||task.done)return;
    if(state.active&&state.active.id!==id){showToast("Hãy hoàn thành hoặc đặt lại timer hiện tại trước nhé.");return;}
    selectedId=id; render();
  }
  function startPause() {
    if(!isTodayView())return;
    const task=activeTask()||currentTask(); if(!task||task.done)return;
    if(!state.active) state.active={id:task.id,elapsed:0,startedAt:Date.now(),running:true};
    else if(state.active.running){state.active.elapsed+=(Date.now()-state.active.startedAt)/1000;state.active.running=false;}
    else {state.active.startedAt=Date.now();state.active.running=true;}
    selectedId=task.id; save(); render();
    if(!ticker)ticker=setInterval(tick,250);
  }
  function tick() {
    rolloverIfNeeded();
    if(!state.active){clearInterval(ticker);ticker=null;render();return;}
    const remaining=remainingSeconds(state.active);
    if(remaining<=0){
      const task=activeTask();
      if(task){task.done=true;task.completedAt=new Date().toISOString();state.elapsedToday+=task.minutes*60;showToast(`"${task.name}" đã hoàn thành. Giỏi lắm!`);}
      state.active=null;save();render();clearInterval(ticker);ticker=null;return;
    }
    $("timerDisplay").textContent=clock(remaining);
    const task=activeTask();if(task)setRing(1-remaining/(task.minutes*60));
  }
  function resetTimer() {
    if(!state.active)return;
    state.active=null;save();render();clearInterval(ticker);ticker=null;showToast("Timer đã được đặt lại.");
  }
  function toggleDone(id) {
    const task=state.tasks.find(t=>t.id===id);if(!task)return;
    if(state.active?.id===id)resetTimer();
    task.done=!task.done;task.completedAt=task.done?new Date().toISOString():null;
    save();render();
  }
  function openDialog(task=null) {
    $("taskForm").dataset.editId=task?task.id:"";
    $("dialogTitle").textContent=task?"Edit task":"Add a task";
    $("taskName").value=task?task.name:"";$("taskMinutes").value=task?task.minutes:5;$("taskCategory").value=task?task.category:"Morning";
    $("taskDialog").showModal();$("taskName").focus();
  }
  function closeDialog(){$("taskDialog").close();}
  function renderCalendar() {
    const year=calendarMonth.getFullYear(),month=calendarMonth.getMonth();
    $("monthLabel").textContent=new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric"}).format(calendarMonth);
    const first=new Date(year,month,1),days=new Date(year,month+1,0).getDate();
    // Monday-first calendar
    const offset=(first.getDay()+6)%7;
    const weekdays=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    let out=weekdays.map(d=>`<div class="weekday">${d}</div>`).join("");
    for(let i=0;i<offset;i++)out+='<div class="calendar-day empty"></div>';
    for(let day=1;day<=days;day++){
      const d=new Date(year,month,day),key=dateKey(d),future=key>todayKey();
      const record=dayRecord(key),has=!!record;
      out+=`<button class="calendar-day ${has?"has-data":""} ${key===viewedDate?"selected":""} ${key===todayKey()?"today":""} ${future?"future":""}" data-date="${key}" ${future?"disabled":""}>${day}</button>`;
    }
    $("calendar").innerHTML=out;
  }
  function renderHistoryDetail() {
    const rec=dayRecord(viewedDate);
    $("detailDate").textContent=prettyDate(viewedDate);
    if(!rec){
      $("historyDone").textContent="0/0";$("historyFocus").textContent="0 min";$("historyRate").textContent="0%";
      $("historyTaskList").innerHTML='<p class="no-history">Chưa có dữ liệu được lưu cho ngày này.</p>';return;
    }
    const tasks=rec.tasks||[],done=tasks.filter(t=>t.done).length,rate=tasks.length?Math.round(done/tasks.length*100):0;
    $("historyDone").textContent=`${done}/${tasks.length}`;
    $("historyFocus").textContent=`${Math.floor((rec.focusSeconds||0)/60)} min`;
    $("historyRate").textContent=`${rate}%`;
    $("historyTaskList").innerHTML=tasks.length?tasks.map(t=>`<div class="history-task"><span>${escapeHtml(t.name)} · ${t.minutes}m</span><span class="history-status ${t.done?"done":"pending"}">${t.done?"✓ Done":"○ Not done"}</span></div>`).join(""):'<p class="no-history">Không có task trong ngày này.</p>';
  }
  $("taskForm").addEventListener("submit",e=>{
    e.preventDefault();if(!isTodayView())return;
    const name=$("taskName").value.trim(),minutes=Number($("taskMinutes").value);
    if(!name||!Number.isInteger(minutes)||minutes<1||minutes>1440){showToast("Nhập tên task và thời gian từ 1 đến 1440 phút nhé.");return;}
    const editId=$("taskForm").dataset.editId;
    if(editId){const t=state.tasks.find(x=>x.id===editId);if(t){t.name=name;t.minutes=minutes;t.category=$("taskCategory").value;}showToast("Đã cập nhật task.");}
    else{const t={id:uid(),name,minutes,category:$("taskCategory").value,done:false,completedAt:null};state.tasks.push(t);selectedId=t.id;showToast("Đã thêm task mới!");}
    save();closeDialog();render();
  });
  $("taskList").addEventListener("click",e=>{
    const item=e.target.closest(".task-item");if(!item||!isTodayView())return;
    const id=item.dataset.id,action=e.target.closest("[data-action]")?.dataset.action;
    if(action==="toggle")toggleDone(id);
    else if(action==="select")selectTask(id);
    else if(action==="edit"){const t=state.tasks.find(x=>x.id===id);if(t)openDialog(t);}
    else if(action==="delete"){
      if(state.active?.id===id)resetTimer();
      state.tasks=state.tasks.filter(t=>t.id!==id);if(selectedId===id)selectedId=null;
      save();render();showToast("Đã xóa task khỏi checklist hiện tại.");
    }
  });
  $("filters").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(!b)return;filter=b.dataset.filter;renderTasks();});
  $("calendar").addEventListener("click",e=>{
    const b=e.target.closest("[data-date]");if(!b||b.disabled)return;
    viewedDate=b.dataset.date;filter="all";render();
  });
  $("prevMonth").addEventListener("click",()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);renderCalendar();});
  $("nextMonth").addEventListener("click",()=>{const next=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);if(next<=new Date(new Date().getFullYear(),new Date().getMonth(),1)){calendarMonth=next;renderCalendar();}});
  $("openAdd").addEventListener("click",()=>openDialog());
  $("emptyAdd").addEventListener("click",()=>openDialog());
  $("closeDialog").addEventListener("click",closeDialog);$("cancelDialog").addEventListener("click",closeDialog);
  $("startPauseBtn").addEventListener("click",startPause);$("resetTimerBtn").addEventListener("click",resetTimer);
  $("exportBtn").addEventListener("click",()=>{
    snapshot();const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=`mint-day-backup-${todayKey()}.json`;a.click();URL.revokeObjectURL(url);showToast("Đã xuất bản sao gồm cả lịch sử.");
  });
  $("importBtn").addEventListener("click",()=>$("importFile").click());
  $("importFile").addEventListener("change",async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(!Array.isArray(data.tasks))throw new Error("invalid");
      state={version:2,date:data.date||todayKey(),tasks:data.tasks,active:null,elapsedToday:Number(data.elapsedToday)||0,history:data.history&&typeof data.history==="object"?data.history:{}};
      rolloverIfNeeded();viewedDate=todayKey();selectedId=null;save();render();showToast("Đã nhập dữ liệu và lịch sử.");
    }catch{showToast("File không hợp lệ hoặc không đúng định dạng Mint Day.");}
    e.target.value="";
  });
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state.active?.running)tick();});
  window.addEventListener("beforeunload",save);
  // Capture a live snapshot periodically; this makes today's record available in the calendar.
  setInterval(()=>{rolloverIfNeeded();save();if(viewedDate===todayKey())renderCalendar();},15000);
  rolloverIfNeeded();
  // Recover timer from timestamps after refresh or browser close.
  if(state.active?.running&&remainingSeconds(state.active)<=0)tick();
  else if(state.active?.running)ticker=setInterval(tick,250);
  render();
})();