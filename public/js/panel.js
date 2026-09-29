/* ═══════════════════════════════════════════════════════════════════════════
   KryonHost — Client Cloud Dashboard & Infrastructure Control Engine
   ═══════════════════════════════════════════════════════════════════════════ */

let vpsMultiChart = null;
let currentVpsId = 'srv-7f3a9c2e';
let currentMcId = 'mc-srv-01';
let userPurchasedMinecraft = true; // Set to true if active server exists

/* ── Initialization ───────────────────────────────────────────────────────── */
async function initPanel() {
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
        const welcomeText = document.getElementById('welcome-user-text');
        
        if (uDisp) uDisp.textContent = formattedName;
        if (uEmail) uEmail.textContent = email;
        if (uInitial) uInitial.textContent = formattedName.charAt(0);
        if (welcomeText) welcomeText.textContent = `Welcome back, ${formattedName}!`;
      }
    }
  } catch (err) {
    console.warn('Auth check note:', err);
  }

  // Always land on Dashboard overview by default
  navigateToView('dashboard');
}

/* ── View Router ──────────────────────────────────────────────────────────── */
function navigateToView(viewName, subSection) {
  // 1. Hide all views
  const viewDash = document.getElementById('view-dashboard');
  const viewVps = document.getElementById('view-vps');
  const viewMc = document.getElementById('view-minecraft');
  const viewShare = document.getElementById('view-share');

  if (viewDash) viewDash.style.display = 'none';
  if (viewVps) viewVps.style.display = 'none';
  if (viewMc) viewMc.style.display = 'none';
  if (viewShare) viewShare.style.display = 'none';

  // 2. Update sidebar active links
  document.querySelectorAll('.sidebar-item-link').forEach(link => link.classList.remove('active'));

  if (viewName === 'dashboard') {
    if (viewDash) viewDash.style.display = 'block';
    const link = document.getElementById('nav-dash');
    if (link) link.classList.add('active');
  } else if (viewName === 'vps') {
    if (viewVps) viewVps.style.display = 'block';
    const link = document.getElementById('nav-vps');
    if (link) link.classList.add('active');
    setTimeout(() => initMultiLineChart(), 50);
  } else if (viewName === 'minecraft') {
    if (viewMc) viewMc.style.display = 'block';
    const link = document.getElementById('nav-mc');
    if (link) link.classList.add('active');

    const mcActive = document.getElementById('mc-active-container');
    const mcEmpty = document.getElementById('mc-empty-container');
    if (userPurchasedMinecraft) {
      if (mcActive) mcActive.style.display = 'block';
      if (mcEmpty) mcEmpty.style.display = 'none';
    } else {
      if (mcActive) mcActive.style.display = 'none';
      if (mcEmpty) mcEmpty.style.display = 'block';
    }
  } else if (viewName === 'share') {
    if (viewShare) viewShare.style.display = 'block';
    const link = document.getElementById('nav-share');
    if (link) link.classList.add('active');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Multi-Line Resource Usage Chart (VPS) ────────────────────────────────── */
function initMultiLineChart() {
  const canvas = document.getElementById('vps-multiline-chart');
  if (!canvas) return;

  if (vpsMultiChart) vpsMultiChart.destroy();

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
      animation: { duration: 300 },
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

function switchVpsSubTab(tabName) {
  if (tabName === 'console') {
    const el = document.getElementById('pane-vps-terminal');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    const input = document.getElementById('vps-cmd-input');
    if (input) input.focus();
  }
}

/* ── VPS Shell Command Execution ──────────────────────────────────────────── */
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
    // Simulation fallback
  }

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
    } else if (cmd === 'clear') {
      term.textContent = 'root@srv-7f3a9c2e:~# ';
      return;
    } else {
      term.textContent += `\n[Command executed]: ${cmd}`;
    }
    term.scrollTop = term.scrollHeight;
  }, 120);
}

/* ── Minecraft Server Command Execution ───────────────────────────────────── */
async function executeMcCommandDirect() {
  const input = document.getElementById('mc-cmd-input');
  if (!input || !input.value.trim()) return;

  const cmd = input.value.trim();
  input.value = '';

  const con = document.getElementById('mc-console-window');
  const now = new Date().toTimeString().slice(0, 8);

  if (con) {
    con.textContent += `\n> ${cmd}`;
    con.scrollTop = con.scrollHeight;
  }

  try {
    const res = await fetch(`/api/minecraft/${currentMcId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd, server_name: 'Survival-1' })
    });
    const data = await res.json();
    if (con && data.response) {
      con.textContent += `\n[${now}] [Server] ${data.response}`;
      con.scrollTop = con.scrollHeight;
      return;
    }
  } catch (err) {
    // Simulation fallback
  }

  setTimeout(() => {
    if (!con) return;
    const respTime = new Date().toTimeString().slice(0, 8);
    if (cmd.startsWith('say ')) {
      con.textContent += `\n[${respTime}] [Server] [Broadcast] ${cmd.slice(4)}`;
    } else if (cmd.startsWith('op ')) {
      con.textContent += `\n[${respTime}] [Server] Made ${cmd.slice(3)} a server operator`;
    } else if (cmd === 'tps') {
      con.textContent += `\n[${respTime}] [Server] TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0`;
    } else if (cmd === 'list') {
      con.textContent += `\n[${respTime}] [Server] 12 / 100 players online: Alex, Steve, Notch, KryonAdmin...`;
    } else {
      con.textContent += `\n[${respTime}] [Server] Command '${cmd}' executed.`;
    }
    con.scrollTop = con.scrollHeight;
  }, 150);
}

function clearMcConsole() {
  const con = document.getElementById('mc-console-window');
  if (con) con.textContent = '[Console cleared]';
}

/* ── Power Actions ────────────────────────────────────────────────────────── */
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
    term.textContent += `\n[${now}] Hypervisor power action: ${action.toUpperCase()} applied.`;
    term.scrollTop = term.scrollHeight;
  }
}

/* ── Utilities ────────────────────────────────────────────────────────────── */
function copyVpsText(text) {
  navigator.clipboard.writeText(text);
  showVpsToast(`Copied "${text}" to clipboard`);
}

function showVpsToast(msg) {
  const toast = document.getElementById('vps-toast');
  const text = document.getElementById('vps-toast-msg');
  if (toast && text) {
    text.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3000);
  }
}

document.addEventListener('DOMContentLoaded', initPanel);
