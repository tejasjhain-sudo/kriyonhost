/* ═══════════════════════════════════════════════════════════════════════════
   KryonHost — Client Cloud Dashboard & Enterprise Infrastructure Controller
   ═══════════════════════════════════════════════════════════════════════════ */

let vpsMultiChart = null;
let currentVpsId = 'srv-7f3a9c2e';
let currentMcId = 'survival-1';
let userPurchasedMinecraft = true;

// VPS Metadata Dictionary
const vpsInstances = {
  'srv-7f3a9c2e': {
    name: 'Production App Node',
    ip: '103.10.180.129',
    os: 'Ubuntu 24.04 LTS',
    location: 'India (Mumbai Node)',
    specs: '4 vCPU · 8 GB RAM · 160 GB NVMe',
    disk: '67.2 / 160 GB (42%)',
    cpuPercent: 18,
    ramPercent: 34,
    diskPercent: 42
  },
  'srv-8d2e1b4a': {
    name: 'Database Cluster Master',
    ip: '103.189.89.44',
    os: 'Debian 12 Bookworm',
    location: 'India (Mumbai Node)',
    specs: '8 vCPU · 16 GB RAM · 320 GB NVMe',
    disk: '204.8 / 320 GB (64%)',
    cpuPercent: 26,
    ramPercent: 58,
    diskPercent: 64
  },
  'srv-3b9f1c7d': {
    name: 'Staging & CI/CD Pipeline',
    ip: '103.10.180.155',
    os: 'Ubuntu 22.04 LTS',
    location: 'Singapore (SG1 Node)',
    specs: '2 vCPU · 4 GB RAM · 80 GB NVMe',
    disk: '15.2 / 80 GB (19%)',
    cpuPercent: 12,
    ramPercent: 28,
    diskPercent: 19
  },
  'srv-5a1e8c9f': {
    name: 'Backup Storage Node',
    ip: '103.189.89.92',
    os: 'Rocky Linux 9',
    location: 'India (Mumbai Node)',
    specs: '2 vCPU · 4 GB RAM · 500 GB Storage',
    disk: '390.0 / 500 GB (78%)',
    cpuPercent: 6,
    ramPercent: 18,
    diskPercent: 78
  }
};

// Minecraft Metadata Dictionary
const mcServers = {
  'Survival-1': {
    name: 'Survival-1 (EnderCraft SMP)',
    ip: 'play.kryonhost.net:25565',
    software: 'Paper 1.21.5',
    players: '18 / 100 Players',
    banner: 'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=280&auto=format&fit=crop&q=80'
  },
  'Lobby-Hub': {
    name: 'Lobby-Hub (Main Proxy & Hub)',
    ip: 'hub.kryonhost.net:25565',
    software: 'Velocity / Purpur 1.21.5',
    players: '42 / 250 Players',
    banner: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=280&auto=format&fit=crop&q=80'
  },
  'Lifesteal-SMP': {
    name: 'Lifesteal-SMP (Hardcore Season 4)',
    ip: 'lifesteal.kryonhost.net:25565',
    software: 'Fabric 1.21.5',
    players: '31 / 150 Players',
    banner: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=280&auto=format&fit=crop&q=80'
  }
};

/* ── Panel Initialization ─────────────────────────────────────────────────── */
async function initPanel() {
  try {
    if (typeof supabaseClient !== 'undefined') {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        const email = session.user.email;
        const namePart = email.split('@')[0];
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        
        const uDisp = document.getElementById('u-display-name');
        const uInitial = document.getElementById('u-initial');
        const welcomeText = document.getElementById('welcome-user-text');
        
        if (uDisp) uDisp.textContent = formattedName.toLowerCase();
        if (uInitial) uInitial.textContent = formattedName.charAt(0).toUpperCase();
        if (welcomeText) welcomeText.textContent = `Welcome back, ${formattedName}!`;
      }
    }
  } catch (err) {
    console.warn('Auth state check:', err);
  }

  // Handle URL hash or default to dashboard
  const hash = window.location.hash.replace('#', '').toLowerCase();
  if (hash === 'sdx' || hash === 'storage') {
    navigateToView('sdx');
  } else if (hash === 'vps' || hash === 'vps-list') {
    navigateToView('vps-list');
  } else if (hash === 'mc' || hash === 'minecraft' || hash === 'mc-list') {
    navigateToView('mc-list');
  } else if (hash === 'ai') {
    navigateToView('ai');
  } else {
    navigateToView('dashboard');
  }

  initPendingOrdersTracker();
}


/* ── View Routing ─────────────────────────────────────────────────────────── */
function navigateToView(viewName) {
  const viewDash = document.getElementById('view-dashboard');
  const viewVpsList = document.getElementById('view-vps-list');
  const viewMcList = document.getElementById('view-mc-list');
  const viewVps = document.getElementById('view-vps');
  const viewMc = document.getElementById('view-minecraft');
  const viewAi = document.getElementById('view-ai');
  const viewSdx = document.getElementById('view-sdx');

  if (viewDash) viewDash.style.display = 'none';
  if (viewVpsList) viewVpsList.style.display = 'none';
  if (viewMcList) viewMcList.style.display = 'none';
  if (viewVps) viewVps.style.display = 'none';
  if (viewMc) viewMc.style.display = 'none';
  if (viewAi) viewAi.style.display = 'none';
  if (viewSdx) viewSdx.style.display = 'none';

  document.querySelectorAll('.subnav-link-item').forEach(link => link.classList.remove('active'));

  if (viewName === 'dashboard') {
    if (viewDash) viewDash.style.display = 'block';
    const link = document.getElementById('nav-dash');
    if (link) link.classList.add('active');
  } else if (viewName === 'vps-list' || viewName === 'vps_list') {
    if (viewVpsList) viewVpsList.style.display = 'block';
    const link = document.getElementById('nav-vps');
    if (link) link.classList.add('active');
  } else if (viewName === 'vps' || viewName === 'vps-control') {
    if (viewVps) viewVps.style.display = 'block';
    const link = document.getElementById('nav-vps');
    if (link) link.classList.add('active');
    setTimeout(() => initMultiLineChart(), 60);
  } else if (viewName === 'mc-list' || viewName === 'mc_list') {
    if (viewMcList) viewMcList.style.display = 'block';
    const link = document.getElementById('nav-mc');
    if (link) link.classList.add('active');
  } else if (viewName === 'minecraft' || viewName === 'mc-control') {
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
  } else if (viewName === 'ai') {
    if (viewAi) viewAi.style.display = 'block';
    const link = document.getElementById('nav-ai');
    if (link) link.classList.add('active');
    loadAiKeyStatus();
  } else if (viewName === 'sdx' || viewName === 'storage') {
    if (viewSdx) viewSdx.style.display = 'block';
    const link = document.getElementById('nav-sdx');
    if (link) link.classList.add('active');
    loadSdxOverview();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Search Filter for Rows ───────────────────────────────────────────────── */
function filterDashboardRows(query) {
  const q = (query || '').toLowerCase().trim();
  document.querySelectorAll('.table-data-row').forEach(row => {
    const text = row.textContent.toLowerCase();
    if (!q || text.includes(q)) {
      row.style.display = 'grid';
    } else {
      row.style.display = 'none';
    }
  });
}

/* ── Platform Dark/Light Theme Switcher ───────────────────────────────────── */
function togglePlatformTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  showVpsToast(`Switched to ${next} theme mode`);
}

/* ── Dynamic Instance Switching ───────────────────────────────────────────── */
function openSpecificVps(id, name, ip, os) {
  currentVpsId = id;
  const select = document.getElementById('vps-instance-selector');
  if (select) select.value = id;
  renderVpsData(id);
  navigateToView('vps');
}

function onVpsSelectChange(id) {
  currentVpsId = id;
  renderVpsData(id);
  showVpsToast(`Switched active context to ${id}`);
}

function renderVpsData(id) {
  const meta = vpsInstances[id] || vpsInstances['srv-7f3a9c2e'];

  const breadcrumb = document.getElementById('vps-breadcrumb-id');
  if (breadcrumb) breadcrumb.textContent = id;

  const heroTitle = document.getElementById('vps-hero-title');
  if (heroTitle) heroTitle.textContent = id;

  const heroSpecs = document.getElementById('vps-hero-specs');
  if (heroSpecs) heroSpecs.textContent = `${meta.os} · AMD Ryzen 9 7950X Zen 4 · Dedicated KVM Node`;

  const dtIp = document.getElementById('vps-dt-ip');
  if (dtIp) dtIp.textContent = meta.ip;

  const dtOs = document.getElementById('vps-dt-os');
  if (dtOs) dtOs.textContent = meta.os;

  const dtLoc = document.getElementById('vps-dt-loc');
  if (dtLoc) dtLoc.textContent = meta.location;

  const term = document.getElementById('vps-term-window');
  if (term) {
    term.textContent = `root@${id}:~# neofetch
          \`o/\`                   root@${id}
         \`ooo/                   -----------------
        \`+oooo:                  OS: ${meta.os} x86_64
       \`+oooooo:                 Host: KVM Hypervisor Zen 4
       -+oooooo+:                Kernel: 6.8.0-45-generic
     \`/:-:++oooo+:               Uptime: 2 days, 14 hours, 32 mins
    \`/++++/+++++++:              Packages: 1087 (dpkg)
   \`/++++++++++++++:             Shell: bash 5.2.21
  \`/+++ooooooooooooo/\`           CPU: AMD Ryzen 9 7950X @ 4.500GHz (5.7GHz Boost)
 ./ooosssso++osssssso+\`          Memory: ${(meta.ramPercent * 0.08).toFixed(1)}GiB / 8.0GiB (${meta.ramPercent}%)
.oossssso-\`\`\`\`/ossssss+\`         Disk: ${meta.disk}
root@${id}:~# `;
  }
}

function openSpecificMc(name, ip, players) {
  currentMcId = name;
  const select = document.getElementById('mc-server-selector');
  if (select) select.value = name;
  renderMcData(name);
  navigateToView('minecraft');
}

function onMcSelectChange(name) {
  currentMcId = name;
  renderMcData(name);
  showVpsToast(`Switched active context to ${name}`);
}

function renderMcData(name) {
  const meta = mcServers[name] || mcServers['Survival-1'];

  const breadcrumb = document.getElementById('mc-breadcrumb-name');
  if (breadcrumb) breadcrumb.textContent = name;

  const heroName = document.getElementById('mc-hero-name');
  if (heroName) heroName.textContent = name;

  const heroSub = document.getElementById('mc-hero-sub');
  if (heroSub) {
    heroSub.textContent = `${meta.ip} · ${meta.software} · 92 Tbps Anycast Shield`;
  }

  const con = document.getElementById('mc-console-window');
  if (con) {
    const now = new Date().toTimeString().slice(0, 8);
    con.textContent = `[${now}] [Server] Server node '${name}' running on 0.0.0.0:25565
[${now}] [Server] Using Java 21 OpenJDK (AMD Ryzen 9 7950X 5.7GHz)
[${now}] [Server] 92 Tbps Anycast Shield: Packet filtering ACTIVE
[${now}] [Server] Connected players: ${meta.players} online. TPS: 20.0 (100% tick health)`;
  }
}

/* ── Sub-Tab Switchers ────────────────────────────────────────────────────── */
function switchVpsTab(tabId, btn) {
  document.querySelectorAll('.vps-tab-pane').forEach(el => el.style.display = 'none');
  const target = document.getElementById(`vps-tab-${tabId}`);
  if (target) target.style.display = 'block';

  document.querySelectorAll('#view-vps .subnav-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  if (tabId === 'overview') {
    setTimeout(() => initMultiLineChart(), 40);
  }
}

function switchMcTab(tabId, btn) {
  document.querySelectorAll('.mc-tab-pane').forEach(el => el.style.display = 'none');
  const target = document.getElementById(`mc-tab-${tabId}`);
  if (target) target.style.display = 'block';

  document.querySelectorAll('#view-minecraft .subnav-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

/* ── Multi-Line Telemetry Chart (VPS) ─────────────────────────────────────── */
function initMultiLineChart(datasetRange) {
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
          label: 'CPU Usage',
          data: [12, 14, 15, 18, 14, 16, 22, 18, 18],
          borderColor: '#111827',
          backgroundColor: 'transparent',
          borderWidth: 1.8,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#111827'
        },
        {
          label: 'RAM Allocation',
          data: [32, 32, 33, 34, 34, 34, 35, 34, 34],
          borderColor: '#6b7280',
          backgroundColor: 'transparent',
          borderWidth: 1.8,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#6b7280'
        },
        {
          label: 'Disk I/O %',
          data: [42, 42, 42, 42, 42, 42, 42, 42, 42],
          borderColor: '#0284c7',
          backgroundColor: 'transparent',
          borderWidth: 1.8,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#0284c7'
        },
        {
          label: 'Network Mb/s',
          data: [4, 6, 8, 12, 18, 24, 64, 20, 14],
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 1.8,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#10b981'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#111827',
          titleColor: '#ffffff',
          bodyColor: '#e5e7eb',
          padding: 8
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0, 0, 0, 0.04)', drawBorder: false },
          ticks: { color: '#6b7280', font: { size: 10, family: 'JetBrains Mono' } }
        },
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(0, 0, 0, 0.04)', drawBorder: false },
          ticks: {
            color: '#6b7280',
            font: { size: 10, family: 'JetBrains Mono' },
            callback: (val) => `${val}%`
          }
        }
      },
      interaction: { intersect: false, mode: 'index' }
    }
  });
}

function filterVpsChart(range) {
  showVpsToast(`Telemetry timescale set to ${range}`);
  initMultiLineChart(range);
}

/* ── Interactive Terminal Engine (VPS) ────────────────────────────────────── */
async function executeVpsCommandDirect() {
  const input = document.getElementById('vps-cmd-input');
  if (!input || !input.value.trim()) return;

  const cmd = input.value.trim();
  input.value = '';

  const term = document.getElementById('vps-term-window');
  if (term) {
    term.textContent += `\nroot@${currentVpsId}:~# ${cmd}`;
    term.scrollTop = term.scrollHeight;
  }

  setTimeout(() => {
    if (!term) return;
    if (cmd === 'uname -a') {
      term.textContent += `\nLinux ${currentVpsId} 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux`;
    } else if (cmd === 'df -h') {
      term.textContent += `\nFilesystem      Size  Used Avail Use% Mounted on\n/dev/vda1       158G   28G  124G  19% /\n/dev/vda15       98M  6.3M   92M   7% /boot/efi`;
    } else if (cmd === 'htop' || cmd === 'top') {
      term.textContent += `\nTasks: 114 total, 1 running, 113 sleeping\n%Cpu(s): 18.2 us, 2.1 sy, 0.0 ni, 79.7 id\nMiB Mem : 8192.0 total, 2742.1 used, 5449.9 free`;
    } else if (cmd === 'uptime') {
      term.textContent += `\n 18:52:04 up 2 days, 14:32,  1 user,  load average: 0.18, 0.14, 0.11`;
    } else if (cmd === 'docker ps') {
      term.textContent += `\nCONTAINER ID   IMAGE          COMMAND                  CREATED        STATUS        PORTS                    NAMES\n7f82b14c9a2e   nginx:alpine   "/docker-entrypoint.…"   2 days ago     Up 2 days     0.0.0.0:80->80/tcp       web-frontend\n9e14a2b8c34f   redis:7-alpine "docker-entrypoint.s…"   2 days ago     Up 2 days     0.0.0.0:6379->6379/tcp   redis-cache`;
    } else if (cmd === 'clear') {
      term.textContent = `root@${currentVpsId}:~# `;
      return;
    } else {
      term.textContent += `\n[Command executed]: ${cmd}`;
    }
    term.scrollTop = term.scrollHeight;
  }, 120);
}

function clearVpsTerminal() {
  const term = document.getElementById('vps-term-window');
  if (term) term.textContent = `root@${currentVpsId}:~# `;
}

/* ── Interactive Minecraft Console ────────────────────────────────────────── */
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

  setTimeout(() => {
    if (!con) return;
    const respTime = new Date().toTimeString().slice(0, 8);
    if (cmd.startsWith('say ')) {
      con.textContent += `\n[${respTime}] [Server] [Broadcast] ${cmd.slice(4)}`;
    } else if (cmd === 'tps') {
      con.textContent += `\n[${respTime}] [Server] TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0 (Memory: 4.8 GB / 16.0 GB)`;
    } else if (cmd === 'list') {
      con.textContent += `\n[${respTime}] [Server] 18 / 100 players online: KryonMaster, StevePro_99, DiamondMiner...`;
    } else {
      con.textContent += `\n[${respTime}] [Server] Command '${cmd}' dispatched.`;
    }
    con.scrollTop = con.scrollHeight;
  }, 120);
}

function clearMcConsole() {
  const con = document.getElementById('mc-console-window');
  if (con) con.textContent = '[Console cleared]';
}

/* ── Power Actions ────────────────────────────────────────────────────────── */
async function handleVpsPowerAction(action) {
  showVpsToast(`Dispatched '${action.toUpperCase()}' signal to KVM Zen 4 Hypervisor`);
  const term = document.getElementById('vps-term-window');
  const now = new Date().toTimeString().slice(0, 8);
  if (term) {
    term.textContent += `\n[${now}] Hypervisor power action: ${action.toUpperCase()} applied.`;
    term.scrollTop = term.scrollHeight;
  }
}

/* ── Modals & Utilities ───────────────────────────────────────────────────── */
function openFileEditModal(fileName, content) {
  const title = document.getElementById('modal-file-title');
  const text = document.getElementById('modal-file-textarea');
  const modal = document.getElementById('modal-file-editor');
  
  if (title) title.textContent = fileName;
  if (text) text.value = content || '';
  if (modal) modal.style.display = 'flex';
}

function saveFileContent() {
  const title = document.getElementById('modal-file-title')?.textContent || 'file';
  closeModal('modal-file-editor');
  showVpsToast(`Saved changes to /home/container/${title}`);
}

function openAddFirewallModal() {
  const modal = document.getElementById('modal-add-firewall');
  if (modal) modal.style.display = 'flex';
}

function submitAddFirewallRule() {
  const name = document.getElementById('fw-rule-name')?.value || 'Custom Rule';
  const proto = document.getElementById('fw-protocol')?.value || 'TCP';
  const port = document.getElementById('fw-port')?.value || '8080';

  closeModal('modal-add-firewall');

  const tbody = document.querySelector('#vps-firewall-table tbody');
  if (tbody) {
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid var(--border-subtle)';
    row.innerHTML = `<td style="padding:10px 14px;"><strong>${name}</strong></td><td style="padding:10px 14px;">${proto}</td><td style="padding:10px 14px;">${port}</td><td style="padding:10px 14px;"><span class="status-badge-live">ALLOW</span></td>`;
    tbody.insertBefore(row, tbody.lastElementChild);
  }

  showVpsToast(`Firewall rule '${name}' created and applied!`);
}

function openCreateSnapshotModal() {
  const modal = document.getElementById('modal-create-snapshot');
  if (modal) modal.style.display = 'flex';
}

function submitCreateSnapshot() {
  const name = document.getElementById('snap-name')?.value || 'instant-snapshot';
  closeModal('modal-create-snapshot');
  showVpsToast(`Snapshot '${name}' created successfully on NVMe pool`);
}

function confirmReinstallOS(osName) {
  showVpsToast(`Reinstalling ${osName}... Server will reboot in 25 seconds.`);
  setTimeout(() => {
    const dtOs = document.getElementById('vps-dt-os');
    if (dtOs) dtOs.textContent = osName;
    const heroSpecs = document.getElementById('vps-hero-specs');
    if (heroSpecs) heroSpecs.textContent = `${osName} · AMD Ryzen 9 7950X Zen 4 · Dedicated KVM Node`;
    showVpsToast(`${osName} installed! New root credentials generated.`);
  }, 2000);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

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

/* ── AI Studio Controller (ColideLabs Gateway) ────────────────────────────── */
let currentAiKey = '';
let isAiKeyRevealed = false;

function getActiveUserIdentifier() {
  const uDisp = document.getElementById('u-display-name');
  if (uDisp && uDisp.textContent.trim()) {
    return uDisp.textContent.trim().toLowerCase();
  }
  let localId = localStorage.getItem('colidelabs_user_id');
  if (!localId) {
    localId = 'usr_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('colidelabs_user_id', localId);
  }
  return localId;
}

async function loadAiKeyStatus() {
  const userId = getActiveUserIdentifier();
  try {
    const res = await fetch(`/api/ai/key?user=${encodeURIComponent(userId)}`);
    const data = await res.json();
    if (data.success && data.hasKey && data.data) {
      const name = data.data.metadata?.name || localStorage.getItem(`colide_name_${userId}`) || 'My Production AI';
      const region = data.data.metadata?.region || localStorage.getItem(`colide_region_${userId}`) || 'India (Mumbai Tier-4 Datacenter)';
      renderClaimedAiKey(data.data.key, name, region);
    } else {
      localStorage.removeItem(`colide_key_${userId}`);
      localStorage.removeItem(`colide_name_${userId}`);
      localStorage.removeItem(`colide_region_${userId}`);
      renderUnclaimedAiKey();
    }
  } catch (err) {
    console.warn('AI key status fetch:', err);
    renderUnclaimedAiKey();
  }
}

async function generateAiKey() {
  const terms = document.getElementById('ai-terms-check');
  if (terms && !terms.checked) {
    showVpsToast('Please accept the Free Tier usage agreement to proceed');
    return;
  }

  const nameInput = document.getElementById('ai-app-name-input');
  const regionSelect = document.getElementById('ai-region-select');

  const appName = nameInput ? (nameInput.value.trim() || 'My Production AI') : 'My Production AI';
  const appRegion = regionSelect ? regionSelect.value : 'India (Mumbai Tier-4 Datacenter)';

  const userId = getActiveUserIdentifier();
  const btn = document.getElementById('btn-generate-ai-key');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generating Key...';
  }

  try {
    const res = await fetch('/api/ai/key/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: userId, name: appName, region: appRegion })
    });
    const data = await res.json();

    if (data.success && data.data) {
      const key = data.data.key;
      localStorage.setItem(`colide_key_${userId}`, key);
      localStorage.setItem(`colide_name_${userId}`, appName);
      localStorage.setItem(`colide_region_${userId}`, appRegion);
      renderClaimedAiKey(key, appName, appRegion);
      showVpsToast('ColideLabs AI Key created! 800 req/day quota activated.');
    } else {
      showVpsToast(data.error || 'Unable to generate API key. Quota full.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Create API Key';
      }
    }
  } catch (err) {
    console.error('Key generation error:', err);
    showVpsToast('Connection error generating key. Please try again.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Create API Key';
    }
  }
}

function renderClaimedAiKey(key, name, region) {
  currentAiKey = key;
  const unclaimed = document.getElementById('ai-key-unclaimed-view');
  const claimed = document.getElementById('ai-key-claimed-view');
  const input = document.getElementById('ai-key-display-input');
  const tag = document.getElementById('ai-key-status-tag');
  const nameDisp = document.getElementById('ai-display-app-name');
  const regionDisp = document.getElementById('ai-display-region');

  if (unclaimed) unclaimed.style.display = 'none';
  if (claimed) claimed.style.display = 'block';
  if (tag) {
    tag.textContent = 'ACTIVE (1 KEY PER CUSTOMER)';
    tag.style.color = 'var(--color-emerald-text)';
    tag.style.borderColor = 'var(--color-emerald-border)';
  }

  if (nameDisp && name) nameDisp.textContent = name;
  if (regionDisp && region) regionDisp.textContent = region;

  if (input) {
    input.value = key;
    input.type = isAiKeyRevealed ? 'text' : 'password';
  }
}

function renderUnclaimedAiKey() {
  currentAiKey = '';
  const unclaimed = document.getElementById('ai-key-unclaimed-view');
  const claimed = document.getElementById('ai-key-claimed-view');
  const tag = document.getElementById('ai-key-status-tag');
  const btn = document.getElementById('btn-generate-ai-key');

  if (unclaimed) unclaimed.style.display = 'block';
  if (claimed) claimed.style.display = 'none';
  if (tag) {
    tag.textContent = '1 KEY PER CUSTOMER';
    tag.style.color = 'var(--text-muted)';
    tag.style.borderColor = 'var(--border-subtle)';
  }
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Create API Key';
  }
}

function toggleAiKeyVisibility() {
  isAiKeyRevealed = !isAiKeyRevealed;
  const input = document.getElementById('ai-key-display-input');
  const label = document.getElementById('ai-key-mask-label');
  if (input) {
    input.type = isAiKeyRevealed ? 'text' : 'password';
  }
  if (label) {
    label.textContent = isAiKeyRevealed ? 'Hide' : 'Reveal';
  }
}

function copyAiKey() {
  if (!currentAiKey) {
    showVpsToast('No active API key to copy');
    return;
  }
  navigator.clipboard.writeText(currentAiKey);
  showVpsToast('ColideLabs API key copied to clipboard');
}

/* ═══════════════════════════════════════════════════════════════════════════
   SDX OBJECT STORAGE & FILE MANAGER CONTROLLER (SHULKER REPLICA SYSTEM)
   ═══════════════════════════════════════════════════════════════════════════ */
let currentSdxNode = 'node-3';
let currentSdxPath = '/';
let currentSdxItems = [];
let isSdxUploading = false;
let isSdxKeyRevealed = false;
let currentSdxRawKey = '';
let allSdxNodesList = [];

// Entrypoint from subnav
async function initSdxConsole() {
  await loadSdxOverview();
}

let trialCountdownInterval = null;

async function loadSdxOverview() {
  const overviewView = document.getElementById('sdx-subview-overview');
  const detailView = document.getElementById('sdx-subview-detail');
  if (overviewView) overviewView.style.display = 'block';
  if (detailView) detailView.style.display = 'none';

  try {
    const res = await fetch('/api/storage/nodes');
    const data = await res.json();
    if (data.success && data.nodes) {
      allSdxNodesList = data.nodes;
      renderSdxOverviewCards(allSdxNodesList);

      let totalQuota = 0;
      let totalUsed = 0;
      const count = allSdxNodesList.length;

      allSdxNodesList.forEach(n => {
        totalQuota += (n.maxQuotaGb || 0);
        totalUsed += (n.usedGb || 0);
      });

      const quotaEl = document.getElementById('sdx-overview-total-quota');
      const usedEl = document.getElementById('sdx-overview-total-used');
      const countEl = document.getElementById('sdx-overview-total-count');
      const countBadge = document.getElementById('sdx-cards-count-badge');
      const slotBar = document.getElementById('sdx-slots-progress-fill');
      const slotText = document.getElementById('sdx-slots-text-label');
      const slotLeftText = document.getElementById('sdx-slots-left-label');
      const remainingAlert = document.getElementById('sdx-slots-remaining-alert');

      if (quotaEl) quotaEl.innerHTML = `${totalQuota} <span style="font-size:0.85rem; font-weight:400; color:var(--text-muted);">GB</span>`;
      if (usedEl) usedEl.innerHTML = `${totalUsed.toFixed(2)} <span style="font-size:0.85rem; font-weight:400; color:var(--text-muted);">GB</span>`;
      if (countEl) countEl.innerHTML = `${count} <span style="font-size:0.85rem; font-weight:400; color:var(--text-muted);">/ 5</span>`;
      if (countBadge) countBadge.textContent = count;

      const slotsLeft = Math.max(0, 5 - count);
      const slotPercent = Math.min(100, Math.round((count / 5) * 100));

      if (slotBar) slotBar.style.width = `${slotPercent}%`;
      if (slotText) slotText.innerHTML = `${count} <span style="font-weight:400; color:var(--text-muted);">/ 5</span>`;
      if (slotLeftText) slotLeftText.textContent = `${slotsLeft} slot(s) left`;
      if (remainingAlert) {
        remainingAlert.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ${slotsLeft === 0 ? 'All 5 SDX slots allocated.' : `Only ${slotsLeft} SDX slot(s) remaining.`}
        `;
      }
    }
  } catch (err) {
    console.warn('Could not load SDX nodes overview:', err);
  }
}

function formatCountdown(sec) {
  if (sec <= 0) return '00:00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderSdxOverviewCards(nodes) {
  const container = document.getElementById('sdx-cards-grid');
  if (!container) return;

  if (trialCountdownInterval) clearInterval(trialCountdownInterval);

  if (!nodes || nodes.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1 / -1; padding:54px 24px; text-align:center; background:var(--bg-surface); border:1px dashed var(--border-subtle); border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,0.02);">
        <div style="width:54px; height:54px; border-radius:14px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:center; margin:0 auto 16px auto; color:var(--text-muted);">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        </div>
        <h3 style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin:0 0 6px 0;">No SDX Storage Deployed Yet</h3>
        <p style="font-size:0.82rem; color:var(--text-muted); max-width:480px; margin:0 auto 22px auto; line-height:1.5;">
          You haven't deployed any storage instance yet. Launch a <strong>Free 2-Hour Sandbox Trial</strong> to test immediately, or deploy permanent production NVMe storage.
        </p>
        <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
          <button class="btn-restore-pill" style="background:#f59e0b; color:#111; font-weight:700; border:none; padding:8px 18px; font-size:0.82rem; display:inline-flex; align-items:center; gap:6px;" onclick="claimSdxFreeTrial()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span>⚡ Launch Free Trial (2h)</span>
          </button>
          <button class="btn-primary-deploy" style="background:#7c6aff; color:#fff; font-weight:700; border:none; padding:8px 18px; font-size:0.82rem; display:inline-flex; align-items:center; gap:6px;" onclick="openBuySdxModal()">
            <span>🚀 Buy Production SDX &rarr;</span>
          </button>
        </div>
      </div>
    `;
    return;
  }

  // Order: Trial first, then 3 node, 2 node, 1
  const sorted = [...nodes].sort((a, b) => {
    if (a.isTrial && !b.isTrial) return -1;
    if (!a.isTrial && b.isTrial) return 1;
    return b.id.localeCompare(a.id);
  });

  container.innerHTML = sorted.map(node => {
    const isTrial = !!node.isTrial;
    const isExpired = node.status === 'Expired' || (isTrial && node.remainingSeconds <= 0);

    return `
      <div class="clean-box-card" style="padding:20px; display:flex; flex-direction:column; justify-content:space-between; border-radius:12px; transition:all 0.2s; ${isTrial ? 'border: 1px solid rgba(245, 158, 11, 0.35); background: linear-gradient(180deg, rgba(245, 158, 11, 0.03) 0%, var(--bg-surface) 100%);' : ''}">
        
        <!-- Top Card Row -->
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:38px; height:38px; border-radius:10px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:center; color:${isTrial ? '#f59e0b' : 'var(--text-muted)'}; flex-shrink:0;">
                ${isTrial
                  ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
                  : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`
                }
              </div>
              <div>
                <h4 style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin:0 0 3px 0; display:flex; align-items:center; gap:6px;">
                  ${escapeHtml(node.name)}
                </h4>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <span style="display:inline-flex; align-items:center; gap:4px; font-size:0.68rem; font-weight:600; padding:1px 6px; border-radius:4px; background:rgba(59,130,246,0.12); color:#60a5fa; border:1px solid rgba(59,130,246,0.25);">
                    ${escapeHtml(node.region)}
                  </span>
                  ${isTrial ? `
                    <span style="display:inline-flex; align-items:center; gap:4px; font-size:0.68rem; font-weight:700; padding:1px 6px; border-radius:4px; background:${isExpired ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}; color:${isExpired ? '#ef4444' : '#f59e0b'}; border:1px solid ${isExpired ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'};">
                      ${isExpired ? 'EXPIRED (2h OVER)' : `<span class="trial-ticker" data-sec="${node.remainingSeconds || 7200}">⚡ 2h Trial: ${formatCountdown(node.remainingSeconds || 7200)}</span>`}
                    </span>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- Storage line -->
          <div style="margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-muted); margin-bottom:4px;">
              <span>Storage</span>
              <span style="font-family:'JetBrains Mono', monospace; color:var(--text-primary); font-weight:600;">${node.usedGb || '0.00'} / ${node.maxQuotaGb || '0'} GB</span>
            </div>
            <div style="width:100%; height:4px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden;">
              <div style="width:${Math.max(0, node.usedPercent || 0)}%; height:100%; background:${isTrial ? '#f59e0b' : '#4b5563'}; border-radius:2px;"></div>
            </div>
          </div>

          <!-- 2 Stat Tiles inside card -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px;">
            <div style="background:var(--bg-surface-elevated); padding:10px 12px; border-radius:8px; border:1px solid var(--border-subtle);">
              <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">UPLOADS</div>
              <div style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin-top:2px;">${node.totalFiles || 0}</div>
            </div>
            <div style="background:var(--bg-surface-elevated); padding:10px 12px; border-radius:8px; border:1px solid var(--border-subtle);">
              <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">REQUESTS</div>
              <div style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin-top:2px;">${node.apiRequests || 0}</div>
            </div>
          </div>
        </div>

        <!-- Card Action Buttons -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); margin-top:auto; padding-top:14px;">
          <button class="btn-restore-pill" style="padding:6px 14px; font-size:0.78rem; font-weight:600; display:flex; align-items:center; gap:5px;" onclick="openSdxNodeDetail('${escapeHtml(node.id)}')">
            Manage <span>&rarr;</span>
          </button>
          ${isTrial ? `
            <button class="btn-restore-pill" style="padding:6px 9px; color:var(--color-rose); border-color:rgba(244,63,94,0.35);" onclick="deleteSdxTrialNode('${escapeHtml(node.id)}')" title="Delete Trial SDX">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          ` : `
            <button class="btn-restore-pill" style="padding:6px 9px; color:var(--color-rose); border-color:rgba(244,63,94,0.25);" onclick="deleteSdxTrialNode('${escapeHtml(node.id)}')" title="Delete SDX Node">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          `}
        </div>

      </div>
    `;
  }).join('');

  // Start countdown ticker for all active trial badges
  trialCountdownInterval = setInterval(() => {
    document.querySelectorAll('.trial-ticker').forEach(el => {
      let sec = parseInt(el.getAttribute('data-sec') || '0', 10);
      if (sec > 0) {
        sec--;
        el.setAttribute('data-sec', sec);
        el.textContent = `⚡ 2h Trial: ${formatCountdown(sec)}`;
      } else {
        el.textContent = 'EXPIRED (2h OVER)';
      }
    });
  }, 1000);
}

function openSdxDeployModal() {
  const modal = document.getElementById('modal-sdx-deploy-options');
  if (modal) modal.style.display = 'flex';
}

async function claimSdxFreeTrial() {
  const user = getActiveUserIdentifier();
  showVpsToast('Provisioning your 2-hour Free Trial SDX node...');
  
  try {
    const res = await fetch('/api/storage/create-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: user })
    });
    const data = await res.json();
    if (data.success) {
      closeModal('modal-sdx-deploy-options');
      showVpsToast(data.message || 'Free Trial SDX created! (2 Hours usage)');
      await loadSdxOverview();
    } else {
      showVpsToast(data.error || 'Could not claim trial');
    }
  } catch (err) {
    showVpsToast('Network error claiming free trial');
  }
}

async function deleteSdxTrialNode(nodeId) {
  if (!confirm('Are you sure you want to delete this trial SDX node?')) return;
  try {
    const res = await fetch(`/api/storage/delete-trial?node=${encodeURIComponent(nodeId)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      showVpsToast('Trial SDX node deleted successfully');
      loadSdxOverview();
    } else {
      showVpsToast(data.error || 'Failed to delete node');
    }
  } catch (e) {
    showVpsToast('Error deleting trial node');
  }
}

function openBuySdxModal() {
  closeModal('modal-sdx-deploy-options');
  const user = getActiveUserIdentifier();
  
  // Trigger order checkout flow for SDX Production storage
  if (typeof openCustomVpsOrderModal === 'function') {
    openCustomVpsOrderModal('SDX Production Object Storage (25 GB NVMe)', 99, {
      service_type: 'sdx',
      storage_limit: '25 GB',
      bandwidth: 'Unmetered'
    });
  } else {
    // Show direct order modal
    const email = localStorage.getItem('kryon_customer_email') || `${user}@kryonhost.net`;
    fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: user,
        customer_email: email,
        service_type: 'sdx',
        plan_name: 'SDX Production Storage (25 GB NVMe)',
        specs: { storage: '25 GB', region: 'India (in-north-1)', sla: '99.99%' },
        amount: 99
      })
    }).then(r => r.json()).then(d => {
      if (d.success) {
        showVpsToast('Production SDX order initiated! Please complete payment verification.');
        initPendingOrdersTracker();
      }
    });
  }
}

function filterSdxCards(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    renderSdxOverviewCards(allSdxNodesList);
    return;
  }
  const filtered = allSdxNodesList.filter(n => n.name.toLowerCase().includes(q) || n.bucket.toLowerCase().includes(q));
  renderSdxOverviewCards(filtered);
}

// ─── Single Node Management View ──────────────────────────────────────────────
async function openSdxNodeDetail(nodeId) {
  currentSdxNode = nodeId || 'node-3';
  currentSdxPath = '/';

  const overviewView = document.getElementById('sdx-subview-overview');
  const detailView = document.getElementById('sdx-subview-detail');
  if (overviewView) overviewView.style.display = 'none';
  if (detailView) detailView.style.display = 'block';

  await loadSdxNodeDetailData();
  await loadSdxCurrentDirectory();
}

function closeSdxNodeDetail() {
  loadSdxOverview();
}

async function loadSdxNodeDetailData() {
  try {
    const res = await fetch(`/api/storage/account-info?node=${encodeURIComponent(currentSdxNode)}`);
    const data = await res.json();
    if (data.success) {
      currentSdxRawKey = data.key_full || '';

      const titleEl = document.getElementById('sdx-detail-node-title');
      const createdDateEl = document.getElementById('sdx-detail-created-date');
      const usageTextEl = document.getElementById('sdx-detail-usage-text');
      const progressBarEl = document.getElementById('sdx-detail-progress-bar');
      const availableTextEl = document.getElementById('sdx-detail-available-text');

      const uploadsCountEl = document.getElementById('sdx-detail-total-uploads');
      const requestsCountEl = document.getElementById('sdx-detail-api-requests');
      const lastRequestEl = document.getElementById('sdx-detail-last-request');

      const endpointInput = document.getElementById('sdx-api-endpoint-val');
      const keyInput = document.getElementById('sdx-key-val-input');
      const bucketDirInput = document.getElementById('sdx-bucket-dir-input');

      const tabUploadsCount = document.getElementById('sdx-tab-uploads-count');
      const tabRequestsCount = document.getElementById('sdx-tab-requests-count');

      if (titleEl) titleEl.textContent = data.node_name;
      if (createdDateEl) createdDateEl.textContent = data.created_date || 'Sep 30, 2026';
      if (usageTextEl) usageTextEl.textContent = `${data.storage_used_gb || '0.00'} / ${data.storage_limit_gb || 0} GB`;
      if (progressBarEl) progressBarEl.style.width = `${Math.max(0, data.storage_used_percent || 0)}%`;
      if (availableTextEl) availableTextEl.textContent = `${data.storage_available_percent || '100.0'}% available`;

      if (uploadsCountEl) uploadsCountEl.textContent = data.total_files || 0;
      if (requestsCountEl) requestsCountEl.textContent = data.api_requests || 0;
      if (lastRequestEl) lastRequestEl.textContent = data.last_request || '-';

      if (endpointInput) endpointInput.value = data.endpoint || (window.location.origin + '/api/storage');
      if (bucketDirInput) bucketDirInput.value = data.bucket_directory || '';
      
      if (keyInput) {
        isSdxKeyRevealed = false;
        keyInput.type = 'password';
        keyInput.value = data.key_masked || '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••';
      }

      if (tabUploadsCount) tabUploadsCount.textContent = data.total_files || 0;
      if (tabRequestsCount) tabRequestsCount.textContent = data.api_requests || 0;
    }
  } catch (err) {
    console.warn('Error loading SDX node detail:', err);
  }
}

function toggleSdxKeyReveal() {
  isSdxKeyRevealed = !isSdxKeyRevealed;
  const keyInput = document.getElementById('sdx-key-val-input');
  if (keyInput) {
    if (isSdxKeyRevealed) {
      keyInput.type = 'text';
      keyInput.value = currentSdxRawKey;
    } else {
      keyInput.type = 'password';
      keyInput.value = '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••';
    }
  }
}

function copySdxActualKey() {
  if (currentSdxRawKey) {
    navigator.clipboard.writeText(currentSdxRawKey);
    showVpsToast('SDX Key copied to clipboard');
  } else {
    showVpsToast('No key available to copy');
  }
}

function copySdxFieldValue(elementId, toastMsg) {
  const el = document.getElementById(elementId);
  if (el) {
    navigator.clipboard.writeText(el.value);
    showVpsToast(toastMsg || 'Copied to clipboard');
  }
}

function switchSdxDetailTab(tabName) {
  const tabUploadsBtn = document.getElementById('tab-sdx-uploads');
  const tabRequestsBtn = document.getElementById('tab-sdx-requests');
  const contentUploads = document.getElementById('sdx-content-uploads');
  const contentRequests = document.getElementById('sdx-content-requests');

  if (tabName === 'uploads') {
    if (tabUploadsBtn) {
      tabUploadsBtn.classList.add('active');
      tabUploadsBtn.style.borderBottom = '2px solid #7c6aff';
      tabUploadsBtn.style.color = '#fff';
      tabUploadsBtn.style.fontWeight = '600';
    }
    if (tabRequestsBtn) {
      tabRequestsBtn.classList.remove('active');
      tabRequestsBtn.style.borderBottom = 'none';
      tabRequestsBtn.style.color = 'var(--text-muted)';
      tabRequestsBtn.style.fontWeight = '400';
    }
    if (contentUploads) contentUploads.style.display = 'block';
    if (contentRequests) contentRequests.style.display = 'none';
  } else {
    if (tabRequestsBtn) {
      tabRequestsBtn.classList.add('active');
      tabRequestsBtn.style.borderBottom = '2px solid #7c6aff';
      tabRequestsBtn.style.color = '#fff';
      tabRequestsBtn.style.fontWeight = '600';
    }
    if (tabUploadsBtn) {
      tabUploadsBtn.classList.remove('active');
      tabUploadsBtn.style.borderBottom = 'none';
      tabUploadsBtn.style.color = 'var(--text-muted)';
      tabUploadsBtn.style.fontWeight = '400';
    }
    if (contentUploads) contentUploads.style.display = 'none';
    if (contentRequests) contentRequests.style.display = 'block';
  }
}

function updateSdxBreadcrumbs() {
  const container = document.getElementById('sdx-detail-breadcrumbs');
  if (!container) return;

  const parts = currentSdxPath.split('/').filter(Boolean);
  let html = `
    <button class="btn-restore-pill" style="padding:4px 8px; font-size:0.75rem; display:flex; align-items:center; gap:4px;" onclick="navigateSdxPath('/')">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      <span>root</span>
    </button>
  `;

  let accum = '';
  for (let i = 0; i < parts.length; i++) {
    accum += '/' + parts[i];
    const isLast = i === parts.length - 1;
    html += `<span style="color:var(--text-muted); font-size:0.8rem;">/</span>`;
    if (isLast) {
      html += `<span style="font-size:0.75rem; font-weight:600; color:var(--text-primary); padding:3px 6px; background:rgba(255,255,255,0.04); border-radius:4px;">${escapeHtml(parts[i])}</span>`;
    } else {
      const clickPath = accum;
      html += `<button class="btn-restore-pill" style="padding:3px 7px; font-size:0.75rem;" onclick="navigateSdxPath('${escapeHtml(clickPath)}')">${escapeHtml(parts[i])}</button>`;
    }
  }

  container.innerHTML = html;
}

async function loadSdxCurrentDirectory() {
  updateSdxBreadcrumbs();

  const tbody = document.getElementById('sdx-file-list-tbody');
  const emptyState = document.getElementById('sdx-empty-folder-state');
  const table = document.getElementById('sdx-file-table');

  try {
    const res = await fetch(`/api/storage/list-contents?node=${encodeURIComponent(currentSdxNode)}&path=${encodeURIComponent(currentSdxPath)}`);
    const data = await res.json();

    if (data.success) {
      currentSdxItems = data.items || [];
      renderSdxFileTableRows(currentSdxItems);
    }
  } catch (err) {
    console.warn('Directory fetch error:', err);
  }
}

function renderSdxFileTableRows(items) {
  const tbody = document.getElementById('sdx-file-list-tbody');
  const emptyState = document.getElementById('sdx-empty-folder-state');
  const table = document.getElementById('sdx-file-table');
  if (!tbody) return;

  const isSubdir = currentSdxPath !== '/' && currentSdxPath !== '';
  let rowsHtml = '';

  // Add ".." Parent Directory row if inside subfolder
  if (isSubdir) {
    const parentPath = currentSdxPath.split('/').slice(0, -1).join('/') || '/';
    rowsHtml += `
      <tr style="border-bottom:1px solid var(--border-subtle); cursor:pointer; background:rgba(255,255,255,0.01);" onclick="navigateSdxPath('${escapeHtml(parentPath)}')">
        <td style="padding:10px 18px; display:flex; align-items:center; gap:8px; font-weight:600; color:#a78bfa;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          .. (Parent Directory)
        </td>
        <td style="padding:10px 18px; font-size:0.75rem; color:var(--text-muted);">-</td>
        <td style="padding:10px 18px; font-size:0.75rem; color:var(--text-muted);">folder</td>
        <td style="padding:10px 18px; font-size:0.75rem; color:var(--text-muted);">-</td>
        <td style="padding:10px 18px; text-align:right;"></td>
      </tr>
    `;
  }

  if (!items || items.length === 0) {
    if (!isSubdir) {
      if (emptyState) emptyState.style.display = 'block';
      if (table) table.style.display = 'none';
      return;
    }
  }

  if (emptyState) emptyState.style.display = 'none';
  if (table) table.style.display = 'table';

  for (const item of items) {
    const isFolder = item.type === 'folder';
    const iconSvg = isFolder
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`
      : getFileIconSvg(item.name);

    const fullItemPath = item.path.startsWith('/') ? item.path : '/' + item.path;

    rowsHtml += `
      <tr style="border-bottom:1px solid var(--border-subtle); transition:background 0.15s;" class="sdx-file-row">
        <td style="padding:10px 18px; display:flex; align-items:center; gap:8px; font-weight:500;">
          ${iconSvg}
          ${isFolder
            ? `<a onclick="navigateSdxPath('${escapeHtml(fullItemPath)}')" style="color:var(--text-primary); cursor:pointer; text-decoration:none; font-weight:600; hover:underline;">${escapeHtml(item.name)}</a>`
            : `<span style="font-family:'JetBrains Mono', monospace; font-size:0.78rem; color:var(--text-primary);">${escapeHtml(item.name)}</span>`
          }
        </td>
        <td style="padding:10px 18px; font-size:0.78rem; color:var(--text-secondary); font-family:'JetBrains Mono', monospace;">
          ${escapeHtml(item.size_formatted || '-')}
        </td>
        <td style="padding:10px 18px; font-size:0.75rem; color:var(--text-muted);">
          ${escapeHtml(item.type === 'folder' ? 'Folder' : (item.mime_type || 'File'))}
        </td>
        <td style="padding:10px 18px; font-size:0.75rem; color:var(--text-muted);">
          ${escapeHtml(item.modified_formatted || '-')}
        </td>
        <td style="padding:10px 18px; text-align:right;">
          <div style="display:inline-flex; gap:5px;">
            ${!isFolder ? `
              <button class="btn-restore-pill" style="font-size:0.7rem; padding:3px 7px;" onclick="downloadSdxFile('${escapeHtml(fullItemPath)}')" title="Download File">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </button>
            ` : ''}

            ${(!isFolder && item.can_read) ? `
              <button class="btn-restore-pill" style="font-size:0.7rem; padding:3px 7px;" onclick="viewOrEditSdxFile('${escapeHtml(fullItemPath)}')" title="View/Edit Text">
                Edit
              </button>
            ` : ''}

            <button class="btn-restore-pill" style="font-size:0.7rem; padding:3px 7px;" onclick="openRenameSdxModal('${escapeHtml(fullItemPath)}', '${escapeHtml(item.name)}')" title="Rename">
              Rename
            </button>

            <button class="btn-restore-pill" style="font-size:0.7rem; padding:3px 7px;" onclick="openMoveSdxModal('${escapeHtml(fullItemPath)}')" title="Move">
              Move
            </button>

            <button class="btn-restore-pill" style="font-size:0.7rem; padding:3px 7px; color:var(--color-rose);" onclick="deleteSdxItem('${escapeHtml(fullItemPath)}', '${escapeHtml(item.name)}')" title="Delete">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  tbody.innerHTML = rowsHtml;
}

function getFileIconSvg(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext)) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  }
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
  }
  if (['zip', 'tar', 'gz', 'rar', '7z', 'jar'].includes(ext)) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`;
  }
  if (['json', 'js', 'py', 'yml', 'yaml', 'sh', 'txt', 'md', 'html', 'css', 'env', 'conf'].includes(ext)) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
  }
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
}

function navigateSdxPath(newPath) {
  currentSdxPath = newPath || '/';
  loadSdxCurrentDirectory();
}

function downloadSdxFile(filePath) {
  const url = `/api/storage/download?node=${encodeURIComponent(currentSdxNode)}&path=${encodeURIComponent(filePath)}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filePath.split('/').pop();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── Modal Operations ─────────────────────────────────────────────────────────
function openCreateFolderModal() {
  const input = document.getElementById('sdx-new-folder-input');
  if (input) input.value = '';
  openModal('modal-sdx-new-folder');
}

async function submitCreateSdxFolder() {
  const input = document.getElementById('sdx-new-folder-input');
  const folderName = input ? input.value.trim() : '';
  if (!folderName) {
    showVpsToast('Please enter a folder name');
    return;
  }

  try {
    const res = await fetch(`/api/storage/create-folder?node=${encodeURIComponent(currentSdxNode)}&path=${encodeURIComponent(currentSdxPath)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderName })
    });
    const data = await res.json();
    if (data.success) {
      showVpsToast(`Folder "${folderName}" created successfully`);
      closeModal('modal-sdx-new-folder');
      loadSdxCurrentDirectory();
      loadSdxNodeDetailData();
    } else {
      showVpsToast(data.error || 'Failed to create folder');
    }
  } catch (err) {
    showVpsToast('Network error creating folder');
  }
}

function openRenameSdxModal(itemPath, currentName) {
  const input = document.getElementById('sdx-rename-input');
  const pathHidden = document.getElementById('sdx-rename-target-path');
  if (input) input.value = currentName;
  if (pathHidden) pathHidden.value = itemPath;
  openModal('modal-sdx-rename');
}

async function submitRenameSdxItem() {
  const input = document.getElementById('sdx-rename-input');
  const pathHidden = document.getElementById('sdx-rename-target-path');
  const newName = input ? input.value.trim() : '';
  const oldPath = pathHidden ? pathHidden.value : '';

  if (!newName || !oldPath) {
    showVpsToast('Please enter a new name');
    return;
  }

  try {
    const res = await fetch(`/api/storage/rename?node=${encodeURIComponent(currentSdxNode)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newName })
    });
    const data = await res.json();
    if (data.success) {
      showVpsToast(`Renamed to "${newName}"`);
      closeModal('modal-sdx-rename');
      loadSdxCurrentDirectory();
    } else {
      showVpsToast(data.error || 'Rename failed');
    }
  } catch (err) {
    showVpsToast('Network error renaming item');
  }
}

function openMoveSdxModal(sourcePath) {
  const destInput = document.getElementById('sdx-move-destination-input');
  const srcHidden = document.getElementById('sdx-move-source-path');
  if (destInput) destInput.value = currentSdxPath;
  if (srcHidden) srcHidden.value = sourcePath;
  openModal('modal-sdx-move');
}

async function submitMoveSdxItem() {
  const destInput = document.getElementById('sdx-move-destination-input');
  const srcHidden = document.getElementById('sdx-move-source-path');
  const sourcePath = srcHidden ? srcHidden.value : '';
  const targetDir = destInput ? destInput.value.trim() : '/';

  if (!sourcePath) return;

  try {
    const res = await fetch(`/api/storage/move?node=${encodeURIComponent(currentSdxNode)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath, targetDir })
    });
    const data = await res.json();
    if (data.success) {
      showVpsToast(`Moved successfully to ${targetDir}`);
      closeModal('modal-sdx-move');
      loadSdxCurrentDirectory();
    } else {
      showVpsToast(data.error || 'Move failed');
    }
  } catch (err) {
    showVpsToast('Network error moving item');
  }
}

async function deleteSdxItem(itemPath, itemName) {
  if (!confirm(`Are you sure you want to permanently delete "${itemName}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/storage/delete?node=${encodeURIComponent(currentSdxNode)}&path=${encodeURIComponent(itemPath)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      showVpsToast(`"${itemName}" removed from SDX storage`);
      loadSdxCurrentDirectory();
      loadSdxNodeDetailData();
    } else {
      showVpsToast(data.error || 'Delete failed');
    }
  } catch (err) {
    showVpsToast('Network error deleting item');
  }
}

async function viewOrEditSdxFile(filePath) {
  try {
    const res = await fetch(`/api/storage/read-file?node=${encodeURIComponent(currentSdxNode)}&path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (data.success) {
      const titleEl = document.getElementById('modal-sdx-editor-title');
      const textarea = document.getElementById('modal-sdx-editor-textarea');
      const pathHidden = document.getElementById('modal-sdx-editor-path');
      const sizeEl = document.getElementById('modal-sdx-editor-size');

      if (titleEl) titleEl.textContent = data.file_name;
      if (textarea) textarea.value = data.content;
      if (pathHidden) pathHidden.value = filePath;
      if (sizeEl) sizeEl.textContent = `Size: ${data.file_size} bytes`;

      openModal('modal-sdx-editor');
    } else {
      showVpsToast(data.error || 'Cannot read file');
    }
  } catch (err) {
    showVpsToast('Error fetching file content');
  }
}

async function saveSdxEditedFile() {
  const textarea = document.getElementById('modal-sdx-editor-textarea');
  const pathHidden = document.getElementById('modal-sdx-editor-path');
  const filePath = pathHidden ? pathHidden.value : '';
  const content = textarea ? textarea.value : '';

  if (!filePath) return;

  try {
    const res = await fetch(`/api/storage/save-file?node=${encodeURIComponent(currentSdxNode)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content })
    });
    const data = await res.json();
    if (data.success) {
      showVpsToast('File saved successfully');
      closeModal('modal-sdx-editor');
      loadSdxCurrentDirectory();
      loadSdxNodeDetailData();
    } else {
      showVpsToast(data.error || 'Save failed');
    }
  } catch (err) {
    showVpsToast('Network error saving file');
  }
}

// ─── File Upload & Chunked Engine ─────────────────────────────────────────────
function triggerSdxUpload() {
  const fileInput = document.getElementById('sdx-hidden-file-input');
  if (fileInput) fileInput.click();
}

function handleSdxDragOver(event) {
  event.preventDefault();
  const overlay = document.getElementById('sdx-drag-overlay');
  if (overlay) overlay.style.display = 'flex';
}

function handleSdxDragLeave(event) {
  event.preventDefault();
  const overlay = document.getElementById('sdx-drag-overlay');
  if (overlay) overlay.style.display = 'none';
}

function handleSdxDrop(event) {
  event.preventDefault();
  const overlay = document.getElementById('sdx-drag-overlay');
  if (overlay) overlay.style.display = 'none';

  const files = event.dataTransfer ? event.dataTransfer.files : null;
  if (files && files.length > 0) {
    processSdxUploadFiles(files);
  }
}

function handleSdxFilesSelected(event) {
  const files = event.target.files;
  if (files && files.length > 0) {
    processSdxUploadFiles(files);
  }
  event.target.value = '';
}

async function processSdxUploadFiles(fileList) {
  if (isSdxUploading) {
    showVpsToast('An upload is currently in progress...');
    return;
  }

  isSdxUploading = true;
  const tracker = document.getElementById('sdx-upload-tracker');
  const filenameEl = document.getElementById('sdx-upload-filename');
  const pctEl = document.getElementById('sdx-upload-percentage');
  const barEl = document.getElementById('sdx-upload-tracker-bar');

  if (tracker) tracker.style.display = 'block';

  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB standard chunk

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (filenameEl) filenameEl.textContent = `Uploading ${file.name} (${i + 1}/${fileList.length})...`;

    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;

      if (totalChunks === 1 && file.size <= 2 * 1024 * 1024) {
        // Fast path for small files: direct upload
        const base64 = await readFileAsBase64(file);
        await fetch(`/api/storage/upload-direct?node=${encodeURIComponent(currentSdxNode)}&path=${encodeURIComponent(currentSdxPath)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, base64 })
        });
      } else {
        // Chunked upload protocol
        const initRes = await fetch(`/api/storage/upload-init?node=${encodeURIComponent(currentSdxNode)}&path=${encodeURIComponent(currentSdxPath)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            totalChunks,
            mimeType: file.type || 'application/octet-stream'
          })
        });
        const initData = await initRes.json();
        const uploadId = initData.upload_id;

        for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
          const start = chunkIdx * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunkBlob = file.slice(start, end);

          const progress = Math.min(100, Math.round(((chunkIdx + 1) / totalChunks) * 100));
          if (pctEl) pctEl.textContent = `${progress}%`;
          if (barEl) barEl.style.width = `${progress}%`;

          await fetch(`/api/storage/upload-chunk`, {
            method: 'POST',
            headers: {
              'X-Upload-ID': uploadId,
              'X-Chunk-Index': chunkIdx.toString(),
              'Content-Type': 'application/octet-stream'
            },
            body: chunkBlob
          });
        }

        // Finalize merge
        await fetch(`/api/storage/upload-complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId })
        });
      }

      showVpsToast(`"${file.name}" uploaded successfully`);
    } catch (err) {
      showVpsToast(`Upload failed for "${file.name}"`);
    }
  }

  isSdxUploading = false;
  if (tracker) tracker.style.display = 'none';
  if (pctEl) pctEl.textContent = '0%';
  if (barEl) barEl.style.width = '0%';

  loadSdxCurrentDirectory();
  loadSdxNodeDetailData();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ── Manual Order Tracking & Live Approval Listener ───────────────────────── */
let orderPollInterval = null;
const injectedOrderIds = new Set();
const seenOrderStates = new Map();

function showTopRightPopup(type, order) {
  const container = document.getElementById('top-right-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `order-popup-toast ${type}`;
  
  if (type === 'approved') {
    toast.innerHTML = `
      <div style="width:36px; height:36px; border-radius:50%; background:rgba(34,197,94,0.18); border:1px solid rgba(34,197,94,0.4); display:flex; align-items:center; justify-content:center; color:#22c55e; flex-shrink:0;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="color:#22c55e; font-size:0.88rem;">Order #${escapeHtml(order.id)} Approved!</strong>
          <span style="font-size:0.7rem; color:var(--text-muted); font-family:'DM Mono',monospace;">Just now</span>
        </div>
        <div style="font-size:0.78rem; color:var(--text-secondary); line-height:1.4; margin-bottom:10px;">
          Your <strong>${escapeHtml(order.plan_name)}</strong> instance has been provisioned and added to your dashboard.
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-restore-pill" style="background:#22c55e; color:#051a0e; font-weight:700; font-size:0.72rem; padding:4px 10px; border:none;" onclick="navigateToView('${order.service_type === 'minecraft' ? 'mc-list' : 'vps-list'}'); this.closest('.order-popup-toast').remove();">Manage Server &rarr;</button>
          <button class="btn-restore-pill" style="font-size:0.72rem; padding:4px 8px; color:var(--text-muted);" onclick="this.closest('.order-popup-toast').remove()">Dismiss</button>
        </div>
      </div>
      <button style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; padding:2px;" onclick="this.closest('.order-popup-toast').remove()">✕</button>
    `;
  } else if (type === 'rejected') {
    toast.innerHTML = `
      <div style="width:36px; height:36px; border-radius:50%; background:rgba(239,68,68,0.18); border:1px solid rgba(239,68,68,0.4); display:flex; align-items:center; justify-content:center; color:#ef4444; flex-shrink:0;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="color:#ef4444; font-size:0.88rem;">Order #${escapeHtml(order.id)} Declined</strong>
          <span style="font-size:0.7rem; color:var(--text-muted); font-family:'DM Mono',monospace;">Just now</span>
        </div>
        <div style="font-size:0.78rem; color:var(--text-secondary); line-height:1.4; margin-bottom:6px;">
          Payment verification failed: <span style="color:#fff;">${escapeHtml(order.rejection_reason || 'UTR could not be verified in bank records')}</span>
        </div>
      </div>
      <button style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; padding:2px;" onclick="this.closest('.order-popup-toast').remove()">✕</button>
    `;
  }

  container.appendChild(toast);

  // Auto remove after 10 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'toastSlideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }
  }, 10000);
}

function injectApprovedServiceToDashboard(o) {
  if (!o || !o.server_details || injectedOrderIds.has(o.id)) return;
  injectedOrderIds.add(o.id);

  const isMc = o.service_type === 'minecraft';
  const instanceId = o.specs?.server_name || `srv-${o.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toLowerCase()}`;
  const instanceName = o.specs?.server_name || o.plan_name;
  const ip = o.server_details.ip || '103.189.89.100';
  const os = o.server_details.os || o.specs?.os || 'Ubuntu 24.04 LTS';
  const region = o.server_details.region || o.specs?.region || 'India (Mumbai Node)';
  const cpu = o.specs?.cpu || 4;
  const ram = o.specs?.ram || 8;
  const disk = o.specs?.disk || 80;

  if (isMc) {
    mcServers[instanceId] = {
      name: `${instanceName} (${o.specs?.os || 'Paper 1.21.1'})`,
      ip: `${ip}:${o.server_details.port || '25565'}`,
      software: o.specs?.os || 'Paper 1.21.1',
      players: '0 / 100 Players',
      banner: 'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=280&auto=format&fit=crop&q=80'
    };
    userPurchasedMinecraft = true;

    // Add to selector if exists
    const mcSel = document.getElementById('mc-server-selector');
    if (mcSel && !mcSel.querySelector(`option[value="${instanceId}"]`)) {
      const opt = document.createElement('option');
      opt.value = instanceId;
      opt.textContent = `${instanceName} (Active)`;
      mcSel.appendChild(opt);
    }
  } else {
    vpsInstances[instanceId] = {
      name: instanceName,
      ip: ip,
      os: os,
      location: region,
      specs: `${cpu} vCPU · ${ram} GB RAM · ${disk} GB NVMe`,
      disk: `2.4 / ${disk} GB (3%)`,
      cpuPercent: 8,
      ramPercent: 16,
      diskPercent: 3
    };

    // Add to VPS selector if exists
    const vpsSel = document.getElementById('vps-instance-selector');
    if (vpsSel && !vpsSel.querySelector(`option[value="${instanceId}"]`)) {
      const opt = document.createElement('option');
      opt.value = instanceId;
      opt.textContent = `${instanceId} — ${instanceName}`;
      vpsSel.appendChild(opt);
    }

    // Prepend to VPS table on dashboard
    const vpsTable = document.querySelector('#view-dashboard .table-container-card');
    if (vpsTable) {
      const row = document.createElement('div');
      row.className = 'table-data-row grid-vps-cols';
      row.id = `dyn-row-${o.id}`;
      row.style.background = 'rgba(16,185,129,0.03)';
      row.onclick = () => openSpecificVps(instanceId, instanceName, ip, os);
      row.innerHTML = `
        <div class="cell-identity">
          <div class="cell-icon-wrap" style="color:#22c55e;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/></svg>
          </div>
          <div>
            <div class="cell-title-text" style="color:#22c55e;">${escapeHtml(instanceId)} <span style="font-size:0.68rem; background:rgba(34,197,94,0.15); color:#22c55e; padding:1px 5px; border-radius:3px; margin-left:4px;">NEW</span></div>
            <div class="cell-sub-text">${escapeHtml(instanceName)} · ${escapeHtml(os)}</div>
          </div>
        </div>
        <div>
          <div style="font-family:'JetBrains Mono'; font-size:0.82rem; font-weight:600;">${escapeHtml(ip)}</div>
          <div style="font-size:0.72rem; color:var(--text-muted);">${escapeHtml(region)}</div>
        </div>
        <div>
          <div style="font-size:0.82rem; font-weight:500;">${cpu} vCPU · ${ram} GB RAM</div>
          <div style="font-size:0.72rem; color:var(--text-muted);">${disk} GB NVMe Gen4</div>
        </div>
        <div>
          ${o.status === 'suspended' ? `
            <span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; padding:3px 8px; border-radius:12px; font-weight:700; display:inline-flex; align-items:center; gap:4px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ef4444;"></span> Suspended</span>
          ` : `
            <span class="status-badge-live"><span class="status-dot-solid"></span> Running</span>
          `}
        </div>
        <div style="display:flex; justify-content:flex-end;">
          <button class="btn-restore-pill" style="font-weight:600; font-size:0.75rem; padding:4px 12px;" onclick="event.stopPropagation(); openSpecificVps('${instanceId}', '${instanceName}', '${ip}', '${os}')">Manage &rarr;</button>
        </div>
      `;
      // Insert after header row
      const headerRow = vpsTable.querySelector('.table-header-row');
      if (headerRow && headerRow.nextSibling) {
        vpsTable.insertBefore(row, headerRow.nextSibling);
      } else {
        vpsTable.appendChild(row);
      }
    }
  }
}

async function initPendingOrdersTracker() {
  const container = document.getElementById('pending-orders-container');
  if (!container) return;

  // Determine user email
  const urlParams = new URLSearchParams(window.location.search);
  let email = urlParams.get('email') || localStorage.getItem('kryon_customer_email');

  if (!email && typeof supabaseClient !== 'undefined') {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user?.email) email = session.user.email;
  }

  if (!email) email = 'tejasjha.in@gmail.com'; // default account demo

  async function checkOrders() {
    try {
      const res = await fetch(`/api/orders?email=${encodeURIComponent(email)}`);
      const json = await res.json();
      if (!json.success || !json.data || json.data.length === 0) {
        container.style.display = 'none';
        return;
      }

      const orders = json.data;

      // Check for real-time status transitions to trigger top-right popup
      orders.forEach(o => {
        const prevStatus = seenOrderStates.get(o.id);
        if (prevStatus && prevStatus !== o.status) {
          if (o.status === 'approved') {
            showTopRightPopup('approved', o);
          } else if (o.status === 'rejected') {
            showTopRightPopup('rejected', o);
          }
        }
        seenOrderStates.set(o.id, o.status);
      });

      const pendingOrders = orders.filter(o => o.status === 'pending_approval' || o.status === 'pending_payment');
      const approvedOrders = orders.filter(o => o.status === 'approved' && o.server_details);

      // Dynamically inject all approved orders into client's dashboard state
      approvedOrders.forEach(o => injectApprovedServiceToDashboard(o));

      if (pendingOrders.length === 0 && approvedOrders.length === 0) {
        container.style.display = 'none';
        return;
      }

      container.style.display = 'block';
      let html = '';

      // 1. Render Pending Approvals Banner
      pendingOrders.forEach(o => {
        html += `
          <div style="background:#161208; border:1px solid rgba(245,158,11,0.4); border-radius:12px; padding:18px 22px; margin-bottom:14px; box-shadow:0 4px 18px rgba(245,158,11,0.08);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:10px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#f59e0b; box-shadow:0 0 8px #f59e0b;"></span>
                <span style="font-weight:700; font-size:0.95rem; color:#f59e0b;">Order #${o.id} · Payment Under Verification</span>
              </div>
              <span style="font-size:0.75rem; color:#9ca3af; font-family:'JetBrains Mono',monospace;">${new Date(o.created_at).toLocaleString()}</span>
            </div>
            
            <div style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:12px; line-height:1.5;">
              Plan: <strong style="color:var(--text-primary);">${escapeHtml(o.plan_name)}</strong> (₹${o.amount.toLocaleString('en-IN')}) &bull; UTR: <strong style="color:#f59e0b; font-family:'JetBrains Mono',monospace;">${escapeHtml(o.utr_number || 'Awaiting Payment')}</strong>${o.sender_upi_id ? ` &bull; Sender UPI: <strong style="color:#a78bfa; font-family:'JetBrains Mono',monospace;">${escapeHtml(o.sender_upi_id)}</strong>` : ''}
            </div>

            <div style="background:rgba(255,255,255,0.03); border:1px dashed rgba(245,158,11,0.25); border-radius:8px; padding:10px 14px; font-size:0.78rem; color:#d1d5db; display:flex; align-items:center; gap:10px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Our administrator is verifying your UTR & receipt against the bank gateway. Your server will be provisioned and added to your dashboard list below automatically once approved.</span>
            </div>
          </div>
        `;
      });

      // 2. Render Clean "Done / Delivered" Banner (No raw credentials exposed)
      approvedOrders.forEach(o => {
        html += `
          <div style="background:rgba(16,185,129,0.07); border:1px solid rgba(16,185,129,0.35); border-radius:12px; padding:16px 20px; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
            <div style="display:flex; align-items:center; gap:14px;">
              <div style="width:36px; height:36px; border-radius:50%; background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.35); display:flex; align-items:center; justify-content:center; color:#22c55e; flex-shrink:0;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <div style="font-weight:700; font-size:0.92rem; color:#22c55e;">✓ Order #${o.id} Done — Service Added to Dashboard</div>
                <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">
                  Your <strong style="color:var(--text-primary);">${escapeHtml(o.plan_name)}</strong> instance is provisioned and active in your server list below.
                </div>
              </div>
            </div>
            <button class="btn-restore-pill" style="font-weight:600; font-size:0.78rem; padding:6px 14px; background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.35); color:#22c55e;" onclick="navigateToView('${o.service_type === 'minecraft' ? 'mc-list' : 'vps-list'}')">Manage Instance &rarr;</button>
          </div>
        `;
      });

      container.innerHTML = html;

    } catch (err) {
      console.warn('Order poll error:', err);
    }
  }

  // Initial check
  checkOrders();

  // Poll every 5 seconds for real-time approval detection
  if (orderPollInterval) clearInterval(orderPollInterval);
  orderPollInterval = setInterval(checkOrders, 5000);
}

document.addEventListener('DOMContentLoaded', initPanel);

