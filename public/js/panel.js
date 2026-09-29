/* ═══════════════════════════════════════════════════════════════════════════
   KryonHost — Enterprise Multi-Service Client Cloud Dashboard Engine
   ═══════════════════════════════════════════════════════════════════════════ */

let currentServer = null;
let currentUser = null;
let activeServiceMode = 'minecraft'; // 'vps' or 'minecraft'

// Chart.js Instances & Config
let cpuChart = null;
let ramChart = null;
const MAX_DATA_POINTS = 20;

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300, easing: 'linear' },
  scales: {
    x: { display: false },
    y: { 
      beginAtZero: true, 
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: 'rgba(255,255,255,0.35)', font: { size: 10, family: 'JetBrains Mono' } }
    }
  },
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
  elements: { point: { radius: 0 }, line: { tension: 0.35, borderWidth: 1.8 } },
  interaction: { intersect: false, mode: 'index' }
};

/* ── Initialization & Authentication ─────────────────────────────────────── */
async function initPanel() {
  try {
    if (typeof supabaseClient !== 'undefined') {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        currentUser = session.user;
        const uEmail = document.getElementById('u-sub-email');
        const uInitial = document.getElementById('u-initial');
        const uDisp = document.getElementById('u-display-name');
        const welcomeText = document.getElementById('welcome-user-text');
        
        const namePart = currentUser.email.split('@')[0];
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        
        if (uEmail) uEmail.textContent = currentUser.email;
        if (uInitial) uInitial.textContent = formattedName.charAt(0);
        if (uDisp) uDisp.textContent = formattedName;
        if (welcomeText) welcomeText.textContent = `Welcome back, ${formattedName}!`;
      }
    }
  } catch (err) {
    console.warn('Auth session note:', err);
  }

  // Load default sample server.properties in files tab
  const fileArea = document.getElementById('file-textarea');
  if (fileArea && !fileArea.value) {
    fileArea.value = `# Minecraft server properties
# KryonHost AMD Ryzen 9 7950X High-Performance Node
server-port=25565
gamemode=survival
difficulty=hard
pvp=true
max-players=100
view-distance=10
simulation-distance=8
enable-command-block=true
motd=§a§lEnderCraft SMP §7- §bAMD Ryzen 9 7950X §8| §d92 Tbps DDoS Shield
online-mode=true
allow-flight=false
white-list=false
spawn-protection=0
`;
  }
}

/* ── Category & View Navigation ───────────────────────────────────────────── */
function filterCategory(category, btnElement) {
  // Update sidebar active link
  document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
  if (btnElement) {
    btnElement.classList.add('active');
  } else {
    const matchingLink = Array.from(document.querySelectorAll('.sidebar-link')).find(l => 
      l.getAttribute('onclick') && l.getAttribute('onclick').includes(category)
    );
    if (matchingLink) matchingLink.classList.add('active');
  }

  // Ensure overview is visible and detail view is hidden
  closeDetailView();

  const secVps = document.getElementById('section-vps-showcase');
  const secMc = document.getElementById('section-mc-showcase');
  const secShare = document.getElementById('section-share-showcase');

  if (category === 'dashboard' || category === 'all') {
    if (secVps) secVps.style.display = 'block';
    if (secMc) secMc.style.display = 'block';
    if (secShare) secShare.style.display = 'block';
  } else if (category === 'vps') {
    if (secVps) secVps.style.display = 'block';
    if (secMc) secMc.style.display = 'none';
    if (secShare) secShare.style.display = 'none';
  } else if (category === 'minecraft') {
    if (secVps) secVps.style.display = 'none';
    if (secMc) secMc.style.display = 'block';
    if (secShare) secShare.style.display = 'none';
  } else if (category === 'share') {
    if (secVps) secVps.style.display = 'none';
    if (secMc) secMc.style.display = 'none';
    if (secShare) secShare.style.display = 'block';
    if (secShare) secShare.scrollIntoView({ behavior: 'smooth' });
  }
}

/* ── Open Detail Control Panel: VPS ───────────────────────────────────────── */
function openVpsControlView() {
  activeServiceMode = 'vps';
  const overview = document.getElementById('overview-view');
  const detail = document.getElementById('detail-view');

  if (overview) overview.style.display = 'none';
  if (detail) detail.style.display = 'block';

  document.getElementById('det-name').textContent = 'VPS-1 (Production App Node)';
  document.getElementById('det-ip').textContent = '103.189.89.44';
  
  const statusPill = document.getElementById('det-status-pill');
  if (statusPill) {
    statusPill.className = 'status-pill running';
    statusPill.innerHTML = '<span class="status-dot running"></span> Running · KVM Zen 4';
  }

  // Set VPS Power Strip
  const ctrlStrip = document.getElementById('det-ctrl-strip');
  if (ctrlStrip) {
    ctrlStrip.innerHTML = `
      <button class="btn-manage-card" style="background:#10b981; color:#000;" onclick="quickVpsPower('start')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Boot VM
      </button>
      <button class="btn-manage-card" style="background:#f59e0b; color:#000;" onclick="quickVpsPower('reboot')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.64 5.64"/></svg> Reboot
      </button>
      <button class="btn-manage-card" style="background:rgba(244,63,94,0.15); color:var(--color-rose); border:1px solid var(--color-rose-border);" onclick="quickVpsPower('stop')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg> Force Stop
      </button>
      <button class="btn-manage-card" style="background:var(--bg-surface-elevated); color:var(--text-primary); border:1px solid var(--border-subtle);" onclick="openCredsModal('ssh')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> SSH Access
      </button>
    `;
  }

  // Load VPS terminal stream
  const con = document.getElementById('d-console-log');
  if (con) {
    const now = new Date().toTimeString().slice(0, 8);
    con.textContent = `[${now}] KryonHost KVM Enterprise Hypervisor (Mumbai Node 01)
[${now}] Attached container instance: VPS-1 (103.189.89.44)
[${now}] AMD Ryzen 9 7950X: 4 Dedicated vCores @ 5.7GHz, RAM: 8GB DDR5 ECC
[${now}] Linux vps-node 6.8.0-45-generic x86_64 Ubuntu 24.04 LTS
root@vps-1:~# `;
    con.scrollTop = con.scrollHeight;
  }

  switchDetailTab('console');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Open Detail Control Panel: Minecraft ─────────────────────────────────── */
function openMinecraftControlView(initialTab = 'console') {
  activeServiceMode = 'minecraft';
  const overview = document.getElementById('overview-view');
  const detail = document.getElementById('detail-view');

  if (overview) overview.style.display = 'none';
  if (detail) detail.style.display = 'block';

  document.getElementById('det-name').textContent = 'Survival-1 (SMP)';
  document.getElementById('det-ip').textContent = 'play.myserver.com:25565';
  
  const statusPill = document.getElementById('det-status-pill');
  if (statusPill) {
    statusPill.className = 'status-pill running';
    statusPill.innerHTML = '<span class="status-dot running"></span> Online · 20.0 TPS Guaranteed';
  }

  // Set Minecraft Power Strip
  const ctrlStrip = document.getElementById('det-ctrl-strip');
  if (ctrlStrip) {
    ctrlStrip.innerHTML = `
      <button class="btn-manage-card" style="background:#10b981; color:#000;" onclick="quickMcPower('start')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start
      </button>
      <button class="btn-manage-card" style="background:#f59e0b; color:#000;" onclick="quickMcPower('restart')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.64 5.64"/></svg> Restart
      </button>
      <button class="btn-manage-card" style="background:rgba(244,63,94,0.15); color:var(--color-rose); border:1px solid var(--color-rose-border);" onclick="quickMcPower('stop')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg> Stop
      </button>
      <button class="btn-manage-card" style="background:var(--bg-surface-elevated); color:var(--text-primary); border:1px solid var(--border-subtle);" onclick="openCredsModal('sftp')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> SFTP Access
      </button>
    `;
  }

  // Load Minecraft console logs
  const con = document.getElementById('d-console-log');
  if (con) {
    const now = new Date().toTimeString().slice(0, 8);
    con.textContent = `[${now} INFO]: Loading Minecraft 1.21.1 with Paper (git-Paper-128)
[${now} INFO]: [CryoLimbo] Anycast DDoS Packet Scrubbing active on 0.0.0.0:25565
[${now} INFO]: Loaded world dimensions: 'world' (Overworld), 'world_nether', 'world_the_end'
[${now} INFO]: Done (1.89s)! For help, type "help"
[${now} INFO]: Server running smoothly at 20.0 TPS on AMD Ryzen 9 7950X (5.7GHz Single-Core)
[${now} INFO]: 12 / 100 players connected.`;
    con.scrollTop = con.scrollHeight;
  }

  // Switch to selected tab
  if (initialTab === 'config' || initialTab === 'settings') {
    switchDetailTab('settings');
  } else if (initialTab === 'files') {
    switchDetailTab('files');
  } else if (initialTab === 'players') {
    switchDetailTab('players');
  } else {
    switchDetailTab('console');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Close Detail View ────────────────────────────────────────────────────── */
function closeDetailView() {
  const overview = document.getElementById('overview-view');
  const detail = document.getElementById('detail-view');
  if (overview) overview.style.display = 'block';
  if (detail) detail.style.display = 'none';
}

/* ── Detail Tabs Switcher ─────────────────────────────────────────────────── */
function switchDetailTab(tabName, btnElement) {
  document.querySelectorAll('.d-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.d-pane').forEach(pane => pane.classList.remove('active'));

  const targetPane = document.getElementById(`pane-${tabName}`);
  if (targetPane) targetPane.classList.add('active');

  if (btnElement) {
    btnElement.classList.add('active');
  } else {
    const tabButtons = document.querySelectorAll('.d-tab-btn');
    tabButtons.forEach(b => {
      if (b.textContent.toLowerCase().includes(tabName)) b.classList.add('active');
    });
  }
}

/* ── Power Actions ────────────────────────────────────────────────────────── */
function quickMcPower(action) {
  const con = document.getElementById('d-console-log');
  const now = new Date().toTimeString().slice(0, 8);
  
  if (action === 'start') {
    showToast('Minecraft Server: Starting up container...');
    if (con) {
      con.textContent += `\n[${now} INFO]: [Daemon] Initializing Paper 1.21.1 startup sequence...`;
      con.scrollTop = con.scrollHeight;
    }
  } else if (action === 'stop') {
    showToast('Minecraft Server: Stopping cleanly & saving world...');
    if (con) {
      con.textContent += `\n[${now} INFO]: [Daemon] World save complete. Server stopped.`;
      con.scrollTop = con.scrollHeight;
    }
  } else if (action === 'restart') {
    showToast('Minecraft Server: Rebooting...');
    if (con) {
      con.textContent += `\n[${now} INFO]: [Daemon] Reboot signal acknowledged. Restarting JVM...`;
      con.scrollTop = con.scrollHeight;
    }
  }
}

function quickVpsPower(action) {
  showToast(`VPS Instance: ${action.toUpperCase()} signal dispatched to KVM Hypervisor`);
  const con = document.getElementById('d-console-log');
  const now = new Date().toTimeString().slice(0, 8);
  if (con) {
    con.textContent += `\n[${now}] Hypervisor power action '${action}' applied successfully.`;
    con.scrollTop = con.scrollHeight;
  }
}

/* ── Console Command Handling ─────────────────────────────────────────────── */
function handleTermKey(e) {
  if (e.key === 'Enter') sendTermCmdDirect();
}

function sendTermCmdDirect() {
  const input = document.getElementById('term-input');
  if (!input || !input.value.trim()) return;

  const cmd = input.value.trim();
  input.value = '';

  const con = document.getElementById('d-console-log');
  const now = new Date().toTimeString().slice(0, 8);

  if (con) {
    if (activeServiceMode === 'minecraft') {
      con.textContent += `\n> ${cmd}`;
      if (cmd.startsWith('say ')) {
        con.textContent += `\n[${now} INFO]: [Server] ${cmd.slice(4)}`;
      } else if (cmd.startsWith('op ')) {
        con.textContent += `\n[${now} INFO]: Made ${cmd.slice(3)} a server operator`;
      } else if (cmd === 'tps') {
        con.textContent += `\n[${now} INFO]: TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0 (Memory: 3,420 MB / 8,192 MB)`;
      } else if (cmd === 'list') {
        con.textContent += `\n[${now} INFO]: There are 12 of a max of 100 players online: Alex, Steve, Notch, ShadowX, EnderKing...`;
      } else {
        con.textContent += `\n[${now} INFO]: Executed command: ${cmd}`;
      }
    } else {
      con.textContent += `\nroot@vps-1:~# ${cmd}\n[${now}] Command executed: ${cmd}\nroot@vps-1:~# `;
    }
    con.scrollTop = con.scrollHeight;
  }
}

/* ── File Manager Direct Save ─────────────────────────────────────────────── */
function saveFileDirect() {
  const textarea = document.getElementById('file-textarea');
  if (textarea) {
    showToast('File "server.properties" saved successfully!');
  }
}

/* ── Direct Clipboard Copy ────────────────────────────────────────────────── */
function copyTextDirect(text) {
  navigator.clipboard.writeText(text);
  showToast(`Copied "${text}" to clipboard`);
}

/* ── Access / SSH / SFTP Modal ────────────────────────────────────────────── */
function openCredsModal(type = 'ssh') {
  const modal = document.getElementById('creds-modal');
  const host = document.getElementById('creds-host');
  const user = document.getElementById('creds-user');

  if (modal) {
    if (type === 'sftp') {
      if (host) host.value = 'sftp://play.myserver.com:2022';
      if (user) user.value = 'mc_survival1';
    } else {
      if (host) host.value = 'ssh root@103.189.89.44:22';
      if (user) user.value = 'root';
    }
    modal.style.display = 'flex';
  }
}

function closeCredsModal() {
  const modal = document.getElementById('creds-modal');
  if (modal) modal.style.display = 'none';
}

/* ── Toast Notifications ──────────────────────────────────────────────────── */
function showToast(message) {
  const toast = document.getElementById('panel-toast');
  const text = document.getElementById('panel-toast-text');
  if (toast && text) {
    text.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3200);
  }
}

document.addEventListener('DOMContentLoaded', initPanel);
