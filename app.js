/**
 * PNU Workbench - Main Application Logic
 * Dashboard Version 2.0
 */

const state = {
  currentStep: 1, 
  sourceFileName: "",
  sourceRows: [],
  generatedRows: [],
  headers: [],
  bjdCache: [], // Local copy of BJD database
  showOnlyErrors: false,
  useBackend: false
};

// UI Elements
const getEls = () => ({
  fileInput: document.getElementById("fileInput"),
  fileMeta: document.getElementById("fileMeta"),
  regionHeaderSelect: document.getElementById("regionHeaderSelect"),
  jibunHeaderSelect: document.getElementById("jibunHeaderSelect"),
  generateBtn: document.getElementById("generateBtn"),
  resetAppBtn: document.getElementById("resetAppBtn"),
  extractPnuBtn: document.getElementById("extractPnuBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  copyBtn: document.getElementById("copyBtn"),
  previewTable: document.getElementById("previewTable"),
  pnuListArea: document.getElementById("pnuListArea"),
  pnuListStats: document.getElementById("pnuListStats"),
  totalCount: document.getElementById("totalCount"),
  successCount: document.getElementById("successCount"),
  failCount: document.getElementById("failCount"),
  dbStatus: document.getElementById("dbStatus"),
  dbUpdateBtn: document.getElementById("dbUpdateBtn"),
  dbResetBtn: document.getElementById("dbResetBtn"),
  dbUploadBtn: document.getElementById("dbUploadBtn"),
  dbFileInput: document.getElementById("dbFileInput"),
  logArea: document.getElementById("logArea"),
  progressArea: document.getElementById("progressArea"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  progressPercent: document.getElementById("progressPercent"),
  // New Dashboard Elements
  consolePanel: document.getElementById("consolePanel"),
  consoleHandle: document.getElementById("consoleHandle"),
  toggleConsoleBtn: document.getElementById("toggleConsoleBtn"),
  toggleDbPanel: document.getElementById("toggleDbPanel"),
  emptyState: document.getElementById("emptyState"),
  steps: document.querySelectorAll(".stepper .step"),
  stepCards: {
    1: document.getElementById("step1"),
    2: document.getElementById("step2")
  },
  openHelpBtn: document.getElementById("openHelpBtn"),
  closeHelpBtn: document.getElementById("closeHelpBtn"),
  helpModal: document.getElementById("helpModal"),
  helpContent: document.getElementById("helpContent"),
  errorFilterBtn: document.getElementById("errorFilterBtn"),
  useBackendToggle: document.getElementById("useBackendToggle"),
  splashScreen: document.getElementById("splashScreen"),
  splashText: document.getElementById("splashText")
});

let els = {};

/**
 * Utility: Logging
 */
function log(message, level = "info") {
  if (!els.logArea) return;
  const time = new Date().toLocaleTimeString();
  
  // Auto-expand console for critical messages
  if ((level === "error" || level === "warn") && els.consolePanel) {
    if (!els.consolePanel.classList.contains("expanded")) {
      els.consolePanel.classList.add("expanded");
      if (els.toggleConsoleBtn) {
        els.toggleConsoleBtn.innerHTML = '<i data-lucide="chevron-down"></i>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    }
  }

  let colorClass = "log-info";
  if (level === "error") colorClass = "log-error";
  else if (level === "warn") colorClass = "log-warn";
  else if (level === "success") colorClass = "log-success";

  const entry = `<div class="${colorClass}">[${time}] ${message}</div>`;
  els.logArea.innerHTML += entry;
  els.logArea.scrollTop = els.logArea.scrollHeight;
}

/**
 * UI State Management
 */
function setStep(step) {
  state.currentStep = step;
  
  // Update Stepper
  els.steps.forEach((el, idx) => {
    const sNum = idx + 1;
    el.classList.remove("active", "done");
    if (sNum < step) el.classList.add("done");
    if (sNum === step) el.classList.add("active");
  });

  // Update Sidebar Cards
  Object.entries(els.stepCards).forEach(([num, el]) => {
    el.classList.remove("active", "disabled");
    const n = parseInt(num);
    if (n < step) el.classList.add("disabled");
    if (n === step) el.classList.add("active");
    if (n > step && step < 2) el.classList.add("disabled");
  });

  // Visibility logic
  if (step >= 2) {
    els.emptyState.style.display = "none";
    els.generateBtn.disabled = false;
  } else {
    els.emptyState.style.display = "flex";
    els.generateBtn.disabled = true;
  }

  if (step === 4) {
    els.downloadBtn.disabled = false;
    els.copyBtn.disabled = false;
  }
}

/**
 * Logic: Normalize names
 */
function normalizeRegionName(name) {
  return String(name || "")
    .replace(/[.,]/g, " ") 
    .replace(/[()\[\]]/g, "") 
    .replace(/\s+/g, " ")
    .trim()
    .replace(/특별자치/g, "")
    .replace(/전라(북|남)도/g, "전$1") 
    .replace(/경상(북|남)도/g, "경$1")
    .replace(/충청(북|남)도/g, "충$1")
    .replace(/(강원|경기|제주)도/g, "$1")
    .replace(/(서울|부산|대구|인천|광주|대전|울산)특별시/g, "$1")
    .replace(/(서울|부산|대구|인천|광주|대전|울산)광역시/g, "$1")
    .replace(/세종시/g, "세종");
}

/**
 * Logic: Convert jibun to code
 */
function convertJibunToCode(jibunText) {
  let jibun = String(jibunText || "").trim();
  if (!jibun) return null;
  let mt = "1";
  if (jibun.startsWith("산")) { mt = "2"; jibun = jibun.slice(1).trim(); }
  const parts = jibun.split("-");
  const mainStr = parts[0].replace(/[^0-9]/g, "");
  if (!mainStr) return null;
  const bon = mainStr.padStart(4, "0");
  const bu = (parts[1] || "0").replace(/[^0-9]/g, "").padStart(4, "0");
  return mt + bon + bu;
}

/**
 * Logic: Auto-pick headers
 */
function autoPickHeader(headers, keywords) {
  const lowerHeaders = headers.map((h) => String(h).toLowerCase());
  for (let i = 0; i < lowerHeaders.length; i += 1) {
    const header = lowerHeaders[i];
    if (keywords.some((k) => header.includes(k))) return headers[i];
  }
  return headers[0] || "";
}

function renderHeaderSelects(headers) {
  const optionsHtml = headers.map((h) => `<option value="${h}">${h}</option>`).join("");
  els.regionHeaderSelect.innerHTML = optionsHtml;
  els.jibunHeaderSelect.innerHTML = optionsHtml;

  els.regionHeaderSelect.value = autoPickHeader(headers, ["행정", "법정", "동", "주소", "시도", "시군구"]);
  els.jibunHeaderSelect.value = autoPickHeader(headers, ["지번", "번지"]);
}

/**
 * API: Search
 */
async function fetchBjdCandidates(query) {
  const res = await fetch(`/api/bjd/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("검색 실패");
  return res.json();
}

/**
 * API: Fetch entire BJD cache for local matching
 */
async function fetchBjdCache() {
  log("로컬 엔진용 DB 데이터를 서버에서 가져오는 중...", "info");
  try {
    const res = await fetch("/api/bjd/all");
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      state.bjdCache = data;
      log(`DB 로드 성공: ${state.bjdCache.length.toLocaleString()}건`, "success");
      // 진단용: 첫 3개 데이터 출력
      const samples = data.slice(0, 3).map(i => i.name).join(", ");
      log(`데이터 샘플: ${samples}`, "info");
      return true;
    } else {
      log("서버로부터 받은 DB 데이터가 비어있습니다. DB 동기화를 먼저 진행하세요.", "error");
      return false;
    }
  } catch (e) {
    log(`DB 로드 실패: ${e.message}`, "error");
    return false;
  }
}



/**
 * UI: Render Table
 */
function renderPreview(rows, showPnuCols) {
  if (!els.previewTable) return;
  const head = els.previewTable.querySelector("thead");
  const body = els.previewTable.querySelector("tbody");
  body.innerHTML = "";
  if (rows.length === 0) return;

  let filteredRows = rows;
  if (state.showOnlyErrors) {
    filteredRows = rows.filter(r => r.PNU_ERROR && String(r.PNU_ERROR).startsWith("FAIL"));
  }

  const displayRows = filteredRows.slice(0, 100);
  const columns = Object.keys(rows[0] || {});
  
  head.innerHTML = `<tr>${columns.map((k) => `<th>${k}</th>`).join("")}</tr>`;
  
  if (displayRows.length === 0 && state.showOnlyErrors) {
    body.innerHTML = `<tr><td colspan="${columns.length}" style="text-align:center; padding: 40px; color: var(--muted);">오류 데이터가 없습니다.</td></tr>`;
    return;
  }

  displayRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = columns
      .map((k) => {
        const val = row[k] === undefined ? "" : row[k];
        let cls = [];
        if (k === "PNU_ERROR" && String(val).startsWith("FAIL")) cls.push("warn");
        if (k === "PNU" && val) { cls.push("ok"); cls.push("mono"); }
        const clsAttr = cls.length > 0 ? ` class="${cls.join(" ")}"` : "";
        return `<td${clsAttr}>${val}</td>`;
      })
      .join("");
    body.appendChild(tr);
  });
}

function updateStats(rows) {
  const ok = rows.filter((r) => r.PNU).length;
  const failed = rows.length - ok;
  
  els.totalCount.textContent = rows.length.toLocaleString();
  els.successCount.textContent = ok.toLocaleString();
  els.failCount.textContent = failed.toLocaleString();

  if (failed > 0) {
    const errors = {};
    rows.forEach(r => {
      if (r.PNU_ERROR && r.PNU_ERROR.startsWith("FAIL")) {
        const type = r.PNU_ERROR.split(":")[1]?.trim() || "알 수 없는 오류";
        errors[type] = (errors[type] || 0) + 1;
      }
    });
    
    log(`오류 분석 완료:`, "warn");
    Object.entries(errors).forEach(([type, count]) => {
      log(` - ${type}: ${count.toLocaleString()}건`, "warn");
    });
  }
}

function renderPnuList(rows) {
  if (rows.length === 0) {
    els.pnuListArea.value = "";
    els.copyBtn.disabled = true;
    els.pnuListStats.textContent = "가져온 데이터가 없습니다.";
    return;
  }
  const pnuKey = Object.keys(rows[0] || {}).find(k => k.toLowerCase() === "pnu") || "PNU";
  
  // Validation: Only 19 digits are valid PNU
  const pnus = rows.map((r) => String(r[pnuKey] || "").trim()).filter(p => /^\d{19}$/.test(p));
  
  const total = rows.length;
  const success = pnus.length;
  const fail = total - success;
  
  els.pnuListStats.innerHTML = `검증 완료: 총 <strong>${total.toLocaleString()}</strong>건 중 ` +
    `<span class="ok">정상 <strong>${success.toLocaleString()}</strong>건</span>, ` +
    `<span class="warn">오류/누락 <strong>${fail.toLocaleString()}</strong>건</span>`;

  if (success === 0) {
    els.pnuListArea.value = "";
    els.copyBtn.disabled = true;
    return;
  }
  const formatted = pnus.map((p) => `'${p}'`).join(", ");
  els.pnuListArea.value = `(${formatted})`;
  els.copyBtn.disabled = false;
}

/**
 * DB Status
 */
async function refreshDbStatus() {
  els.dbStatus.textContent = "확인 중...";
  try {
    const res = await fetch("/api/bjd/status");
    const data = await res.json();
    els.dbStatus.innerHTML = `<span class="ok">●</span> 온라인: ${data.count.toLocaleString()}건`;
    log(`DB 상태 확인 완료: ${data.count.toLocaleString()}개 법정동 로드됨.`, "success");
  } catch (e) {
    els.dbStatus.innerHTML = `<span class="warn">●</span> 오프라인`;
    log("DB 연결 실패.", "error");
  }
}

/**
 * Init App
 */
function initApp() {
  els = getEls();
  
  // Console Toggling via Icon Only
  const updateConsoleIcon = (isExpanded) => {
    els.toggleConsoleBtn.innerHTML = isExpanded 
      ? '<i data-lucide="chevron-down"></i>' 
      : '<i data-lucide="chevron-up"></i>';
    lucide.createIcons();
  };

  els.toggleConsoleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isExpanded = els.consolePanel.classList.toggle("expanded");
    updateConsoleIcon(isExpanded);
  });

  els.toggleDbPanel.addEventListener("click", (e) => {
    e.stopPropagation();
    els.consolePanel.classList.add("expanded");
    updateConsoleIcon(true);
    document.querySelector(".tab-btn[data-target='dbTab']").click();
  });

  // Tab switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.target).classList.add("active");
    });
  });

  // Help Modal Handlers
  const showHelp = async () => {
    try {
      const res = await fetch("help.md");
      const md = await res.text();
      // Use Showdown for more predictable parsing
      const converter = new showdown.Converter({
        tables: true,
        strikethrough: true,
        simplifiedAutoLink: true
      });
      const html = converter.makeHtml(md);
      els.helpContent.innerHTML = html;
      els.helpModal.style.display = "flex";
      lucide.createIcons();
    } catch (e) { log("도움말을 불러올 수 없습니다.", "error"); }
  };

  els.openHelpBtn.addEventListener("click", showHelp);
  els.closeHelpBtn.addEventListener("click", () => els.helpModal.style.display = "none");
  els.helpModal.addEventListener("click", (e) => {
    if (e.target === els.helpModal) els.helpModal.style.display = "none";
  });

  // Flow Events
  els.fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    log(`파일 분석 중: ${file.name}`);
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      let rows = [];
      if (ext === "csv") {
        const text = await file.text();
        rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
      } else {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
      }
      state.sourceFileName = file.name;
      state.sourceRows = rows;
      state.headers = Object.keys(rows[0]);
      els.fileMeta.textContent = `${rows.length.toLocaleString()} 행 로드됨`;
      renderHeaderSelects(state.headers);
      renderPreview(rows);
      updateStats(rows);

      // Auto-activate PNU list if already exists in file
      const hasPnu = state.headers.some(h => h.toLowerCase() === "pnu");
      if (hasPnu) {
        renderPnuList(rows);
        log("파일 내 PNU 컬럼 감지됨. 리스트가 활성화되었습니다.", "success");
      } else {
        renderPnuList([]);
      }

      setStep(2);
      log("Step 1 완료: 데이터가 로드되었습니다.", "success");
    } catch (err) { log(`오류: ${err.message}`, "error"); }
  });

  els.useBackendToggle.addEventListener("change", () => {
    if (els.useBackendToggle.checked) {
      log("백엔드 엔진 안내: 10만 건 이상의 대규모 데이터 처리 시 브라우저 멈춤 방지를 위해 권장합니다. 일반적인 건수(5만 건 이하)는 '로컬 엔진'이 훨씬 빠릅니다.", "warn");
    }
  });

  els.generateBtn.addEventListener("click", async () => {
    if (state.sourceRows.length === 0) return;
    if (state.bjdCache.length === 0) {
      const ok = await fetchBjdCache();
      if (!ok) return log("DB 데이터를 불러올 수 없습니다.", "error");
    }

    const regionKey = els.regionHeaderSelect.value;
    const jibunKey = els.jibunHeaderSelect.value;
    const useBackend = els.useBackendToggle && els.useBackendToggle.checked;
    
    setStep(3);
    els.progressArea.style.display = "block";
    els.generateBtn.disabled = true;
    
    const startTime = performance.now();
    log(`PNU 추출 시작 (${state.sourceRows.length.toLocaleString()}건, 엔진: ${useBackend ? '백엔드' : '로컬'})...`);

    if (useBackend) {
      try {
        const chunkSize = 500;
        const totalRows = state.sourceRows.length;
        const resultRows = [];
        
        for (let i = 0; i < totalRows; i += chunkSize) {
          const chunk = state.sourceRows.slice(i, i + chunkSize);
          
          // Pre-normalize for backend safety
          const safeChunk = chunk.map(r => ({
            ...r,
            _normReg: normalizeRegionName(r[regionKey]),
            _landCode: convertJibunToCode(r[jibunKey])
          }));

          const res = await fetch(`/api/process/rows?regionKey=${encodeURIComponent(regionKey)}&jibunKey=${encodeURIComponent(jibunKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(safeChunk)
          });
          
          if (!res.ok) throw new Error("백엔드 엔진 오류");
          const processedChunk = await res.json();
          resultRows.push(...processedChunk);
          
          const pct = Math.round(((i + chunk.length) / totalRows) * 100);
          els.progressBar.style.width = `${pct}%`;
          els.progressPercent.textContent = `${pct}%`;
          els.progressText.textContent = `백엔드 처리 중 (${resultRows.length}/${totalRows})`;
        }
        
        state.generatedRows = resultRows;
        renderPreview(state.generatedRows, true);
        updateStats(state.generatedRows);
        renderPnuList(state.generatedRows);
        setStep(4);
        const duration = ((performance.now() - startTime) / 1000).toFixed(2);
        log(`PNU 생성이 완료되었습니다 (백엔드 엔진, 소요시간: ${duration}초).`, "success");
        setTimeout(() => els.progressArea.style.display = "none", 2000);
      } catch (err) {
        log(`백엔드 처리 실패: ${err.message}`, "error");
        setStep(2);
      } finally {
        els.generateBtn.disabled = false;
      }
      return;
    }

    // Use Web Worker for background processing
    const worker = new Worker("pnu-worker.js");
    
    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === "PROGRESS") {
        const pct = msg.percent;
        els.progressBar.style.width = `${pct}%`;
        els.progressPercent.textContent = `${pct}%`;
        
        if (msg.phase === "LOOKUP") {
          els.progressText.textContent = `BJD 코드 매칭 중 (${msg.current}/${msg.total})`;
        } else {
          els.progressText.textContent = `PNU 생성 중 (${msg.current}/${msg.total})`;
        }
      } 
      else if (msg.type === "DONE") {
        state.generatedRows = msg.result;
        renderPreview(state.generatedRows, true);
        updateStats(state.generatedRows);
        updateStats(state.generatedRows);
        renderPnuList(state.generatedRows);
        
        setStep(4);
        const duration = ((performance.now() - startTime) / 1000).toFixed(2);
        log(`PNU 생성이 완료되었습니다 (로컬 엔진, 소요시간: ${duration}초).`, "success");
        setTimeout(() => {
          els.progressArea.style.display = "none";
          els.progressBar.style.width = "0%";
        }, 2000);
        els.generateBtn.disabled = false;
        worker.terminate();
      }
      else if (msg.type === "ERROR") {
        log(`추출 오류: ${msg.message}`, "error");
        setStep(2);
        els.generateBtn.disabled = false;
        worker.terminate();
      }
    };

    worker.postMessage({
      type: "PROCESS",
      rows: state.sourceRows,
      bjdCache: state.bjdCache,
      regionKey,
      jibunKey
    });
  });

  els.errorFilterBtn.addEventListener("click", () => {
    state.showOnlyErrors = !state.showOnlyErrors;
    
    if (state.showOnlyErrors) {
      els.errorFilterBtn.innerHTML = '<i data-lucide="check-circle"></i> 전체 보기';
      els.errorFilterBtn.classList.replace("ghost", "primary");
      log("필터 활성화: 오류 데이터만 표시합니다.", "info");
    } else {
      els.errorFilterBtn.innerHTML = '<i data-lucide="alert-circle"></i> 오류만 보기';
      els.errorFilterBtn.classList.replace("primary", "ghost");
      log("필터 해제: 모든 데이터를 표시합니다.", "info");
    }
    lucide.createIcons();
    
    const targetRows = state.generatedRows.length > 0 ? state.generatedRows : state.sourceRows;
    renderPreview(targetRows);
  });

  els.downloadBtn.addEventListener("click", () => {
    const exportType = document.querySelector("input[name='exportType']:checked").value;
    const stamp = new Date().toISOString().replace(/[-:TZ]/g, "").slice(0, 14);
    const fileName = `${state.sourceFileName.split(".")[0]}_PNU_${stamp}`;
    if (exportType === "csv") {
      const csv = Papa.unparse(state.generatedRows);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${fileName}.csv`;
      a.click();
    } else {
      const ws = XLSX.utils.json_to_sheet(state.generatedRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Result");
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    }
    log("파일 다운로드 완료.", "success");
  });

  els.copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(els.pnuListArea.value);
      log("클립보드 복사 완료", "success");
      const originalText = els.copyBtn.innerHTML;
      els.copyBtn.innerHTML = '<i data-lucide="check"></i> 완료';
      setTimeout(() => {
        els.copyBtn.innerHTML = originalText;
        lucide.createIcons();
      }, 2000);
      lucide.createIcons();
    } catch (e) { log("복사 실패", "error"); }
  });

  // DB Handlers
  if (els.dbUpdateBtn) {
    els.dbUpdateBtn.onclick = async () => {
      if(!confirm("서버에서 최신 법정동 데이터를 다운로드하고 동기화하시겠습니까?\n(약 수초~수십초 소요될 수 있습니다)")) return;
      
      try {
        els.dbUpdateBtn.disabled = true;
        log("최신 DB 다운로드 및 동기화 시작...", "info");
        
        const res = await fetch("/db/update-official", { method: "POST" });
        const result = await res.json();
        
        if (res.ok && result.status === "success") {
          log(`성공: ${result.message}`, "success");
          refreshDbStatus();
        } else {
          log(`실패: ${result.message || "서버 오류"}`, "error");
        }
      } catch (err) {
        log("연결 실패: 서버 상태를 확인하세요.", "error");
      } finally {
        els.dbUpdateBtn.disabled = false;
      }
    };
  }



  // Reset App
  const resetApp = () => {
    // If there's data, ask for confirmation
    if (state.sourceRows && state.sourceRows.length > 0) {
      if (!confirm("진행 중인 모든 데이터가 삭제됩니다. 새 작업을 시작하시겠습니까?")) {
        return;
      }
    }
    
    log("새 작업을 시작합니다. 모든 데이터를 초기화합니다.", "info");

    state.sourceFileName = "";
    state.sourceRows = [];
    state.generatedRows = [];
    state.headers = [];
    
    if (els.fileInput) els.fileInput.value = "";
    if (els.fileMeta) els.fileMeta.textContent = ".xlsx, .xls, .csv 지원";
    if (els.regionHeaderSelect) els.regionHeaderSelect.innerHTML = "";
    if (els.jibunHeaderSelect) els.jibunHeaderSelect.innerHTML = "";
    if (els.previewTable) {
      const Head = els.previewTable.querySelector("thead");
      const Body = els.previewTable.querySelector("tbody");
      if (Head) Head.innerHTML = "";
      if (Body) Body.innerHTML = "";
    }
    if (els.emptyState) els.emptyState.style.display = "flex";
    if (els.pnuListArea) els.pnuListArea.value = "";
    if (els.pnuListStats) els.pnuListStats.textContent = "PNU가 생성되면 목록이 여기에 표시됩니다.";
    if (els.copyBtn) els.copyBtn.disabled = true;
    if (els.downloadBtn) els.downloadBtn.disabled = true;
    
    updateStats([]);
    setStep(1);

    // Scroll to top to show the upload area
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    log("시스템이 초기화되었습니다. 새로운 파일을 업로드해 주세요.", "success");
  };

  if (els.resetAppBtn) {
    els.resetAppBtn.addEventListener("click", resetApp);
  }

  // Splash Screen Hider / Poller
  const checkInitialReady = async () => {
    try {
      const res = await fetch("/api/bjd/status");
      if (!res.ok && res.status !== 503) throw new Error("Connection failed");
      
      const data = await res.json();
      const isReady = data.isReady || data.IsReady;
      const count = data.count || data.Count || 0;
      
      if (isReady) {
        if (els.splashText) els.splashText.textContent = "브라우저 캐시 동기화 중...";
        
        // Default is False (Local Engine), so we MUST fetch cache before hiding splash
        state.useBackend = false;
        if (els.useBackendToggle) els.useBackendToggle.checked = false;

        fetchBjdCache().then(() => {
          if (els.splashText) els.splashText.textContent = "준비 완료!";
          setTimeout(() => {
            if (els.splashScreen) {
               els.splashScreen.classList.add("fade-out");
               setTimeout(() => {
                 els.splashScreen.remove();
                 log("시스템 준비가 완료되었습니다. (로컬 엔진 활성)", "success");
               }, 1000);
            }
          }, 500);
          refreshDbStatus();
        });
      } else {
        if (els.splashText) {
          if (count > 0) {
            els.splashText.textContent = `데이터 엔진 빌드 중... (${count.toLocaleString()}건)`;
          } else {
            els.splashText.textContent = "데이터베이스 연결 중...";
          }
        }
        setTimeout(checkInitialReady, 800);
      }
    } catch (e) {
      setTimeout(checkInitialReady, 1000);
    }
  };


  // Start polling
  checkInitialReady();
}

document.addEventListener("DOMContentLoaded", initApp);
