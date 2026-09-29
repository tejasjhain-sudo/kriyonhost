/* ═══════════════════════════════════════════════════════════════════════════
   KryonHost — Cloud VPS Infrastructure & Shulker API v2 Controller
   ═══════════════════════════════════════════════════════════════════════════ */

let vpsMultiChart = null;
let currentVpsId = 'srv-7f3a9c2e';
let isApiKeyRevealed = false;

/* ── Initialization ───────────────────────────────────────────────────────── */
async function initVpsPanel() {
  try {
    if (typeof supabaseClient !== 'undefined') {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        const email = session.user.email;
        const namePart = email.split('@')[0];
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        
        const uDisp = document.getElementById('u-display-name');
        const uEmail = document.getElementById('u-sub-email');
        const uInitial = document.getElementById('u-initial');
        
        if (uDisp) uDisp.textContent = formattedName;
        if (uEmail) uEmail.textContent = email;
        if (uInitial) uInitial.textContent = formattedName.charAt(0);
      }
    }
  } catch (err) {
    console.warn('Auth check note:', err);
  }

  initMultiLineChart();
}

/* ── Multi-Line Resource Usage Chart ──────────────────────────────────────── */
function initMultiLineChart() {
  const canvas = document.getElementById('vps-multiline-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  
  const timeLabels = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', 'Now'];
  
  vpsMultiChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: timeLabels,
      datasets: [
        {
          label: 'CPU',
          data: [12, 14, 15, 18, 14, 16, 22, 18, 18],
          borderColor: '#3b82f6',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 2,
          pointBackgroundColor: '#3b82f6'
        },
        {
          label: 'RAM',
          data: [32, 32, 33, 34, 34, 34, 35, 34, 34],
          borderColor: '#a855f7',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 2,
          pointBackgroundColor: '#a855f7'
        },
        {
          label: 'Disk',
          data: [42, 42, 42, 42, 42, 42, 42, 42, 42],
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 2,
          pointBackgroundColor: '#10b981'
        },
        {
          label: 'Network',
          data: [2, 3, 5, 8, 12, 18, 48, 14, 8],
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 2,
          pointBackgroundColor: '#f59e0b'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#13131c',
          titleColor: '#f4f4f5',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 8
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
          ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { size: 10, family: 'JetBrains Mono' } }
        },
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
          ticks: {
            color: 'rgba(255, 255, 255, 0.4)',
            font: { size: 10, family: 'JetBrains Mono' },
            callback: (val) => `${val}%`
          }
        }
      },
      interaction: { intersect: false, mode: 'index' }
    }
  });
}

/* ── Tab Navigation ───────────────────────────────────────────────────────── */
function switchVpsTab(tabName, btnElement) {
  document.querySelectorAll('.vps-tab-btn').forEach(btn => btn.classList.remove('active'));
  if (btnElement) {
    btnElement.classList.add('active');
  } else {
    const matchingBtn = Array.from(document.querySelectorAll('.vps-tab-btn')).find(b => 
      b.textContent.toLowerCase().includes(tabName)
    );
    if (matchingBtn) matchingBtn.classList.add('active');
  }

  if (tabName === 'console') {
    const el = document.getElementById('pane-console-card');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    const input = document.getElementById('vps-cmd-input');
    if (input) input.focus();
  } else if (tabName === 'graphs') {
    const el = document.getElementById('pane-graphs-card');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  } else if (tabName === 'snapshots') {
    const el = document.getElementById('pane-snapshots-card');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  } else if (tabName === 'networking') {
    const el = document.getElementById('pane-networking-card');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  } else if (tabName === 'api') {
    const el = document.getElementById('pane-api-card');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/* ── Shell Command Execution ──────────────────────────────────────────────── */
async function executeVpsCommandDirect() {
  const input = document.getElementById('vps-cmd-input');
  if (!input || !input.value.trim()) return;

  const cmd = input.value.trim();
  input.value = '';

  const term = document.getElementById('vps-term-window');
  if (term) {
    term.textContent += `\nroot@srv-7f3a9c2e:~# ${cmd}`;
    term.scrollTop = term.scrollHeight;
  }

  // Communicate with backend VPS terminal route
  try {
    const res = await fetch(`/api/servers/${currentVpsId}/terminal/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    const data = await res.json();
    if (term && data.output) {
      term.textContent += `\n${data.output}`;
      term.scrollTop = term.scrollHeight;
      return;
    }
  } catch (err) {
    // Local simulation fallback
  }

  // Simulated shell outputs
  setTimeout(() => {
    if (!term) return;
    if (cmd === 'uname -a') {
      term.textContent += `\nLinux srv-7f3a9c2e 5.15.0-130-generic #140-Ubuntu SMP x86_64 GNU/Linux`;
    } else if (cmd === 'df -h') {
      term.textContent += `\nFilesystem      Size  Used Avail Use% Mounted on\n/dev/vda1        59G   21G   36G  37% /\n/dev/vda15       98M  6.3M   92M   7% /boot/efi`;
    } else if (cmd === 'htop' || cmd === 'top') {
      term.textContent += `\nTasks: 104 total, 1 running, 103 sleeping\n%Cpu(s): 18.2 us, 2.1 sy, 0.0 ni, 79.7 id\nMiB Mem : 4096.0 total, 842.1 used, 3253.9 free`;
    } else if (cmd === 'uptime') {
      term.textContent += `\n 14:32:01 up 2 days, 14:32,  1 user,  load average: 0.18, 0.14, 0.11`;
    } else if (cmd === 'free -m') {
      term.textContent += `\n               total        used        free      shared  buff/cache   available\nMem:            4096         842        2814          12         440        3254\nSwap:              0           0           0`;
    } else if (cmd === 'clear') {
      term.textContent = 'root@srv-7f3a9c2e:~# ';
      return;
    } else {
      term.textContent += `\n[Command executed]: ${cmd}`;
    }
    term.scrollTop = term.scrollHeight;
  }, 120);
}

function toggleConsoleExpand() {
  const term = document.getElementById('vps-term-window');
  if (!term) return;
  term.style.height = term.style.height === '420px' ? '240px' : '420px';
}

/* ── Power Actions (Reboot, Stop, Start) ───────────────────────────────────── */
async function handleVpsPowerAction(action) {
  showVpsToast(`Dispatched '${action}' signal to KVM Zen 4 Hypervisor...`);

  try {
    await fetch(`/api/servers/${currentVpsId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
  } catch (err) {
    // Handled
  }

  const term = document.getElementById('vps-term-window');
  const now = new Date().toTimeString().slice(0, 8);
  if (term) {
    term.textContent += `\n[${now}] Hypervisor power signal: ${action.toUpperCase()} acknowledged.`;
    term.scrollTop = term.scrollHeight;
  }
}

/* ── API Key Masking & Clipboard ──────────────────────────────────────────── */
function toggleApiKeyVisibility() {
  const span = document.getElementById('api-key-masked-val');
  if (!span) return;

  if (isApiKeyRevealed) {
    span.textContent = 'shk_live_••••••••••••••';
    isApiKeyRevealed = false;
  } else {
    span.textContent = 'shk_live_89f2a4b10e7c3d2891';
    isApiKeyRevealed = true;
  }
}

function copyVpsText(text) {
  navigator.clipboard.writeText(text);
  showVpsToast(`Copied "${text}" to clipboard`);
}

/* ── Toast Feedback ───────────────────────────────────────────────────────── */
function showVpsToast(msg) {
  const toast = document.getElementById('vps-toast');
  const text = document.getElementById('vps-toast-msg');
  if (toast && text) {
    text.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3000);
  }
}

document.addEventListener('DOMContentLoaded', initVpsPanel);
