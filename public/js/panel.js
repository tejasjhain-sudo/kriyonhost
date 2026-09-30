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
    location: 'India (Mumbai Tier-4)',
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
    location: 'India (Mumbai Tier-4)',
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
    location: 'Singapore Edge Node',
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
    location: 'India (Mumbai Tier-4)',
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

  // Default to deployments overview
  navigateToView('dashboard');
}

/* ── View Routing ─────────────────────────────────────────────────────────── */
function navigateToView(viewName) {
  const viewDash = document.getElementById('view-dashboard');
  const viewVps = document.getElementById('view-vps');
  const viewMc = document.getElementById('view-minecraft');
  const viewAi = document.getElementById('view-ai');

  if (viewDash) viewDash.style.display = 'none';
  if (viewVps) viewVps.style.display = 'none';
  if (viewMc) viewMc.style.display = 'none';
  if (viewAi) viewAi.style.display = 'none';

  document.querySelectorAll('.subnav-link-item').forEach(link => link.classList.remove('active'));

  if (viewName === 'dashboard') {
    if (viewDash) viewDash.style.display = 'block';
    const link = document.getElementById('nav-dash');
    if (link) link.classList.add('active');
  } else if (viewName === 'vps') {
    if (viewVps) viewVps.style.display = 'block';
    const link = document.getElementById('nav-vps');
    if (link) link.classList.add('active');
    setTimeout(() => initMultiLineChart(), 60);
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
  } else if (viewName === 'ai') {
    if (viewAi) viewAi.style.display = 'block';
    const link = document.getElementById('nav-ai');
    if (link) link.classList.add('active');
    loadAiKeyStatus();
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
      const localCached = localStorage.getItem(`colide_key_${userId}`);
      if (localCached) {
        const name = localStorage.getItem(`colide_name_${userId}`) || 'My Production AI';
        const region = localStorage.getItem(`colide_region_${userId}`) || 'India (Mumbai Tier-4 Datacenter)';
        renderClaimedAiKey(localCached, name, region);
      } else {
        renderUnclaimedAiKey();
      }
    }
  } catch (err) {
    console.warn('AI key status fetch:', err);
    const localCached = localStorage.getItem(`colide_key_${userId}`);
    if (localCached) {
      const name = localStorage.getItem(`colide_name_${userId}`) || 'My Production AI';
      const region = localStorage.getItem(`colide_region_${userId}`) || 'India (Mumbai Tier-4 Datacenter)';
      renderClaimedAiKey(localCached, name, region);
    } else {
      renderUnclaimedAiKey();
    }
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

document.addEventListener('DOMContentLoaded', initPanel);
