dayjs.extend(dayjs_plugin_customParseFormat);

    // ====== CONFIG: Replace these 3 values ======
    // 1) CSV published link for the Events sheet
    const EVENTS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRWv-ZF8XtzA9K4jMm4wQL-oAO226SUqWWCFLsT0lwxobkMhQMWorDdAGbD_hVkLPj5XhUj9GNMngr-/pub?gid=0&single=true&output=csv";
    // 2) CSV published link for the Registrations sheet (used for charts; optional but recommended)
    const REGISTRATIONS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRWv-ZF8XtzA9K4jMm4wQL-oAO226SUqWWCFLsT0lwxobkMhQMWorDdAGbD_hVkLPj5XhUj9GNMngr-/pub?gid=172924638&single=true&output=csv";
    // 3) Google Apps Script Web App URL that appends a row into Registrations
    const REGISTER_ENDPOINT = "https://script.google.com/macros/s/AKfycbwX1RNJ3ZFrdEZMKBcBQdCi4pFx4Q_gYTFW3CN5Mg_5gzBhX3qbhdkBhg_D4Y454qg/exec";

    // ====== UTIL ======
    function parseDateFlexible(value) {
      if (!value) return null;
      // Try formats commonly used in Sheets
      const fmts = ["YYYY-MM-DD","DD/MM/YYYY","MM/DD/YYYY","D/M/YYYY","DD-MM-YYYY","MMM D, YYYY"];
      for (const f of fmts) {
        const d = dayjs(value, f, true);
        if (d.isValid()) return d.toDate();
      }
      // Fallback: Date.parse
      const parsed = new Date(value);
      return isNaN(parsed) ? null : parsed;
    }
    function fmtDateForDisplay(date) {
      if (!date) return "—";
      return dayjs(date).format("ddd, DD MMM YYYY");
    }
    function fmtDateForInput(date) {
      if (!date) return "";
      return dayjs(date).format("YYYY-MM-DD");
    }

    function csvToJson(csvText) {
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      return parsed.data;
    }

    async function fetchCSV(url) {
      const res = await fetch(url + (url.includes("?") ? "&" : "?") + "_cb=" + Date.now()); // cache-bust
      if (!res.ok) throw new Error("Failed to fetch " + url);
      return await res.text();
    }

    // ====== STATE ======
    let events = [];
    let registrations = [];
    let charts = { eventsByMonth: null, regsByEvent: null };

    // ====== RENDER EVENTS ======
    function renderEvents() {
      const grid = document.getElementById('eventsGrid');
      grid.innerHTML = '';
      const now = new Date();
      const sorted = [...events].sort((a,b) => (parseDateFlexible(a.Date) || 0) - (parseDateFlexible(b.Date) || 0));
      for (const ev of sorted) {
        const date = parseDateFlexible(ev.Date);
        const isPast = date && date < new Date(now.toDateString());
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <span class="badge">${isPast ? 'Past' : 'Upcoming'}</span>
          <div class="title">${ev['Event Name'] || 'Untitled Event'}</div>
          <div class="meta">
            <div class="meta-item">📅 ${fmtDateForDisplay(date)}</div>
            <div class="meta-item">📍 ${ev.Location || 'TBA'}</div>
            <div class="meta-item">⏰ ${ev.Time || 'TBA'}</div>
            <div class="meta-item">🎤 ${ev.Speaker || 'TBA'}</div>
          </div>
          <button class="btn btn-register" ${isPast ? 'disabled' : ''} data-ev='${encodeURIComponent(JSON.stringify(ev))}'>Register</button>
        `;
        const btn = card.querySelector('button');
        if (!isPast) {
          btn.addEventListener('click', () => openRegister(JSON.parse(decodeURIComponent(btn.getAttribute('data-ev')))));
        } else {
          btn.style.opacity = 0.6; btn.style.cursor = 'not-allowed';
        }
        grid.appendChild(card);
      }
    }

    // ====== MODAL ======
    const modal = document.getElementById('registerModal');
    const toast = document.getElementById('toast');

    function openRegister(ev) {
      document.getElementById('f_eventName').value = ev['Event Name'] || '';
      const d = parseDateFlexible(ev.Date);
      document.getElementById('f_eventDate').value = fmtDateForInput(d);
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }
    function closeRegister() {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.getElementById('registerForm').reset();
    }
    document.getElementById('btnCancel').addEventListener('click', closeRegister);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeRegister(); });

    function showToast(msg, timeout = 3000) {
      toast.textContent = msg; toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), timeout);
    }

    // ====== SUBMIT REGISTRATION ======
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        eventName: document.getElementById('f_eventName').value.trim(),
        eventDate: document.getElementById('f_eventDate').value, // yyyy-mm-dd
        studentName: document.getElementById('f_studentName').value.trim(),
        email: document.getElementById('f_email').value.trim(),
        contact: document.getElementById('f_contact').value.trim(),
        class: document.getElementById('f_class').value.trim(),
        year: document.getElementById('f_year').value
      };
      try {
        if (!endpointReady()) { showToast('Registration endpoint not configured. Please set REGISTER_ENDPOINT.'); return; }
const res = await fetch(REGISTER_ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },  // ✅ no preflight; Apps Script friendly
  body: JSON.stringify(payload),
  mode: 'cors'
});
        if (!res.ok) throw new Error('Failed to register');
        showToast('Registration submitted successfully ✅');
        closeRegister();
        // re-fetch registrations (if CSV is published, may take a moment to reflect)
        await loadRegistrations();
        renderCharts();
      } catch (err) {
        console.error(err);
        showToast('Could not submit registration. Please try again.', 4000);
      }
    });

    // ====== CHARTS ======
    function buildEventsByMonth() {
      const monthMap = new Map();
      for (const ev of events) {
        const d = parseDateFlexible(ev.Date);
        if (!d) continue;
        const key = dayjs(d).format('YYYY-MM');
        monthMap.set(key, (monthMap.get(key) || 0) + 1);
      }
      const keys = [...monthMap.keys()].sort();
      return { labels: keys.map(k => dayjs(k + '-01').format('MMM YYYY')), data: keys.map(k => monthMap.get(k)) };
    }
    function buildRegistrationsByEvent() {
      const map = new Map();
      for (const r of registrations) {
        const name = r['Event Name'] || r.eventName || 'Unknown';
        map.set(name, (map.get(name) || 0) + 1);
      }
      const entries = [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
      return { labels: entries.map(e=>e[0]), data: entries.map(e=>e[1]) };
    }
    function renderCharts() {
      const ctx1 = document.getElementById('chartEventsByMonth');
      const ctx2 = document.getElementById('chartRegistrationsByEvent');
      const eByM = buildEventsByMonth();
      const rByE = buildRegistrationsByEvent();

      if (charts.eventsByMonth) charts.eventsByMonth.destroy();
      if (charts.regsByEvent) charts.regsByEvent.destroy();

      charts.eventsByMonth = new Chart(ctx1, {
        type: 'bar',
        data: { labels: eByM.labels, datasets: [{ label: 'Events per Month', data: eByM.data }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
      charts.regsByEvent = new Chart(ctx2, {
        type: 'bar',
        data: { labels: rByE.labels, datasets: [{ label: 'Registrations (Top 8)', data: rByE.data }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }

    // ====== LOADERS ======
    async function loadEvents() {
      const csv = await fetchCSV(EVENTS_CSV_URL);
      events = csvToJson(csv);
      renderEvents();
    }
    async function loadRegistrations() {
      if (!REGISTRATIONS_CSV_URL) { registrations = []; return; }
      try {
        const csv = await fetchCSV(REGISTRATIONS_CSV_URL);
        registrations = csvToJson(csv);
      } catch (e) {
        registrations = [];
      }
    }
    async function init() {
      await Promise.all([loadEvents(), loadRegistrations()]);
      renderCharts();
    }
    init();

// ====== SAFETY: Check endpoint configured ======
function endpointReady() {
  return typeof REGISTER_ENDPOINT === 'string' && REGISTER_ENDPOINT && !/PASTE_APPS_SCRIPT_WEB_APP_URL_HERE/.test(REGISTER_ENDPOINT);
}

// ====== Ensure openRegister is defined early ======
function _openRegisterInternal(ev) {
  document.getElementById('f_eventName').value = ev['Event Name'] || '';
  const d = parseDateFlexible(ev.Date);
  document.getElementById('f_eventDate').value = fmtDateForInput(d);
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

// Replace previous openRegister wrapper if present
openRegister = function(ev) {
  if (typeof isSignedIn === 'function' && !isSignedIn()) {
    showToast('Please sign in first to register.');
    const m = document.getElementById('signinModal');
    if (m) { m.classList.add('open'); m.setAttribute('aria-hidden','false'); }
    return;
  }
  _openRegisterInternal(ev);
};

// Delegate clicks for dynamically rendered buttons (extra safety)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.textContent.trim() === 'Register' && btn.dataset.ev) {
    try {
      const ev = JSON.parse(decodeURIComponent(btn.dataset.ev));
      openRegister(ev);
    } catch (err) {
      console.error('Bad event payload', err);
      showToast('Could not open registration form.');
    }
  }
});



// ====== AUTH ======
const AUTH_KEY = "eventPortalAuth";
function isSignedIn() {
  try { const s = JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); return !!(s && s.user); } catch { return false; }
}
function getUser() {
  try { const s = JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); return s && s.user; } catch { return null; }
}
function signIn(user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ user }));
  updateAuthUI();
}
function signOut() {
  localStorage.removeItem(AUTH_KEY);
  updateAuthUI();
}
function updateAuthUI() {
  const btn = document.getElementById('btnSignIn');
  const status = document.getElementById('userStatus');
  if (isSignedIn()) {
    const u = getUser();
    btn.textContent = "Sign Out";
    status.style.display = 'inline-block';
    status.textContent = "Signed in: " + u;
  } else {
    btn.textContent = "Sign In";
    status.style.display = 'none';
    status.textContent = "";
  }
}

// Modal controls
const signinModal = document.getElementById('signinModal');
document.getElementById('btnSignIn').addEventListener('click', () => {
  if (isSignedIn()) { signOut(); return; }
  signinModal.classList.add('open');
  signinModal.setAttribute('aria-hidden', 'false');
});
document.getElementById('btnCancelSignin').addEventListener('click', () => {
  signinModal.classList.remove('open');
  signinModal.setAttribute('aria-hidden', 'true');
});
signinModal.addEventListener('click', (e) => { if (e.target === signinModal) { signinModal.classList.remove('open'); signinModal.setAttribute('aria-hidden', 'true'); }});

document.getElementById('signinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const u = document.getElementById('login_user').value.trim();
  const p = document.getElementById('login_pass').value.trim();
  if (u === 'ev101' && p === 'ev101') {
    signIn(u);
    showToast('Signed in successfully ✅');
    signinModal.classList.remove('open');
    signinModal.setAttribute('aria-hidden', 'true');
  } else {
    showToast('Invalid credentials', 3500);
  }
});

// Gate registration: require sign-in
const originalOpenRegister = openRegister;
openRegister = function(ev) {
  if (!isSignedIn()) {
    showToast('Please sign in first to register.');
    // open sign-in modal
    signinModal.classList.add('open');
    signinModal.setAttribute('aria-hidden', 'false');
    return;
  }
  originalOpenRegister(ev);
};

// On load
updateAuthUI();


// Global delegation for Register button
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-register');
  if (!btn || btn.disabled) return;
  try {
    const ev = JSON.parse(decodeURIComponent(btn.dataset.ev));
    if (typeof isSignedIn === 'function' && !isSignedIn()) {
      showToast('Please sign in first to register.');
      const m = document.getElementById('signinModal');
      if (m) { m.classList.add('open'); m.setAttribute('aria-hidden','false'); }
      return;
    }
    document.getElementById('f_eventName').value = ev['Event Name'] || '';
    const d = parseDateFlexible(ev.Date);
    document.getElementById('f_eventDate').value = fmtDateForInput(d);
    const modal = document.getElementById('registerModal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
  } catch (err) {
    console.error('Register click error', err);
    showToast('Could not open form.');
  }
});
