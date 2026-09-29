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
    console.warn('Auth state check:', err);
  }

  // Land on overview by default
  navigateToView('dashboard');
}

/* ── View Routing ─────────────────────────────────────────────────────────── */
function navigateToView(viewName) {
  const viewDash = document.getElementById('view-dashboard');
  const viewVps = document.getElementById('view-vps');
  const viewMc = document.getElementById('view-minecraft');
  const viewShare = document.getElementById('view-share');

  if (viewDash) viewDash.style.display = 'none';
  if (viewVps) viewVps.style.display = 'none';
  if (viewMc) viewMc.style.display = 'none';
  if (viewShare) viewShare.style.display = 'none';

  document.querySelectorAll('.sidebar-item-link').forEach(link => link.classList.remove('active'));

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
  } else if (viewName === 'share') {
    if (viewShare) viewShare.style.display = 'block';
    const link = document.getElementById('nav-share');
    if (link) link.classList.add('active');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const ipMetric = document.getElementById('vps-metric-ip');
  if (ipMetric) {
    ipMetric.textContent = meta.ip;
    ipMetric.setAttribute('onclick', `copyVpsText('${meta.ip}')`);
  }

  const locMetric = document.getElementById('vps-metric-loc');
  if (locMetric) locMetric.textContent = meta.location;

  const specsMetric = document.getElementById('vps-metric-specs');
  if (specsMetric) specsMetric.textContent = meta.specs.split('·')[0].trim() + ' / ' + meta.specs.split('·')[1].trim();

  const diskMetric = document.getElementById('vps-metric-disk');
  if (diskMetric) diskMetric.textContent = `${meta.diskPercent}% Allocated`;

  const dtId = document.getElementById('vps-dt-id');
  if (dtId) dtId.textContent = id;

  const dtOs = document.getElementById('vps-dt-os');
  if (dtOs) dtOs.textContent = meta.os;

  const netIp = document.getElementById('net-cfg-ip');
  if (netIp) netIp.value = meta.ip;

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
    heroSub.innerHTML = `IP: <strong style="color:#fff; font-family:'JetBrains Mono'; cursor:pointer;" onclick="copyVpsText('${meta.ip}')">${meta.ip}</strong> &nbsp;|&nbsp; Engine: <strong>${meta.software}</strong> &nbsp;|&nbsp; <strong>India (Mumbai)</strong>`;
  }

  const heroBanner = document.getElementById('mc-hero-banner');
  if (heroBanner && meta.banner) heroBanner.src = meta.banner;

  const playersMetric = document.getElementById('mc-metric-players');
  if (playersMetric) playersMetric.textContent = meta.players.split(' ')[0];

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
          borderColor: '#6366f1',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 2,
          pointBackgroundColor: '#6366f1'
        },
        {
          label: 'RAM Allocation',
          data: [32, 32, 33, 34, 34, 34, 35, 34, 34],
          borderColor: '#a855f7',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 2,
          pointBackgroundColor: '#a855f7'
        },
        {
          label: 'Disk I/O %',
          data: [42, 42, 42, 42, 42, 42, 42, 42, 42],
          borderColor: '#38bdf8',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 2,
          pointBackgroundColor: '#38bdf8'
        },
        {
          label: 'Network Mb/s',
          data: [4, 6, 8, 12, 18, 24, 64, 20, 14],
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 2,
          pointBackgroundColor: '#10b981'
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
          backgroundColor: '#12141f',
          titleColor: '#f8fafc',
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

function filterVpsChart(range) {
  showVpsToast(`Telemetry timescale set to ${range}`);
  initMultiLineChart(range);
}

/* ── Interactive Terminal Engine (VPS) ────────────────────────────────────── */
function insertVpsCmd(cmd) {
  const input = document.getElementById('vps-cmd-input');
  if (input) {
    input.value = cmd;
    input.focus();
  }
}

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
    } else if (cmd === 'systemctl status nginx') {
      term.textContent += `\n● nginx.service - A high performance web server and a reverse proxy server\n   Loaded: loaded (/lib/systemd/system/nginx.service; enabled; vendor preset: enabled)\n   Active: active (running) since Sat 2026-09-27 04:18:10 UTC; 2 days ago`;
    } else if (cmd === 'iptables -L') {
      term.textContent += `\nChain INPUT (policy DROP)\ntarget     prot opt source               destination         \nACCEPT     tcp  --  anywhere             anywhere             tcp dpt:ssh\nACCEPT     tcp  --  anywhere             anywhere             tcp dpt:http\nACCEPT     tcp  --  anywhere             anywhere             tcp dpt:https`;
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
function insertMcCmd(cmd) {
  const input = document.getElementById('mc-cmd-input');
  if (input) {
    input.value = cmd;
    input.focus();
  }
}

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
    } else if (cmd.startsWith('op ')) {
      con.textContent += `\n[${respTime}] [Server] Made ${cmd.slice(3)} a server operator`;
    } else if (cmd === 'tps') {
      con.textContent += `\n[${respTime}] [Server] TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0 (Memory: 4.8 GB / 16.0 GB)`;
    } else if (cmd === 'list') {
      con.textContent += `\n[${respTime}] [Server] 18 / 100 players online: KryonMaster, StevePro_99, DiamondMiner, AlexCrafter...`;
    } else if (cmd === 'save-all') {
      con.textContent += `\n[${respTime}] [Server] Saving the game (all chunks, player data, and world containers flushed to NVMe)`;
    } else if (cmd === 'weather clear') {
      con.textContent += `\n[${respTime}] [Server] Set the weather to clear`;
    } else if (cmd === 'time set day') {
      con.textContent += `\n[${respTime}] [Server] Set the time to 1000`;
    } else {
      con.textContent += `\n[${respTime}] [Server] Command '${cmd}' dispatched and acknowledged.`;
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
  const src = document.getElementById('fw-source')?.value || '0.0.0.0/0';

  closeModal('modal-add-firewall');

  const tbody = document.querySelector('#vps-firewall-table tbody');
  if (tbody) {
    const row = document.createElement('tr');
    row.innerHTML = `<td><strong>${name}</strong></td><td>${proto}</td><td>${port}</td><td>${src}</td><td style="color:var(--color-emerald); font-weight:600;">ALLOW</td><td><span class="status-badge-running" style="font-size:0.65rem;">Active</span></td>`;
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

  const tbody = document.querySelector('#vps-snapshot-table tbody');
  if (tbody) {
    const row = document.createElement('tr');
    row.innerHTML = `<td><strong>${name}</strong></td><td>21.4 GB</td><td>NVMe Pool Mumbai-01</td><td>Just now</td><td><button class="btn-restore-pill" onclick="showVpsToast('Restoring snapshot...')">Restore</button></td>`;
    tbody.insertBefore(row, tbody.firstChild);
  }

  showVpsToast(`Snapshot '${name}' created successfully on NVMe pool`);
}

function confirmReinstallOS(osName) {
  showVpsToast(`Reinstalling ${osName}... Server will reboot in 25 seconds.`);
  setTimeout(() => {
    const dtOs = document.getElementById('vps-dt-os');
    if (dtOs) dtOs.textContent = osName;
    const heroSpecs = document.getElementById('vps-hero-specs');
    if (heroSpecs) heroSpecs.textContent = `${osName} · AMD Ryzen 9 7950X Zen 4 · Dedicated KVM Node`;
    showVpsToast(`${osName} installed! New root password dispatched.`);
  }, 2500);
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

document.addEventListener('DOMContentLoaded', initPanel);
