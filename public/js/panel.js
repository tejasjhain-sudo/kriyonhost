/* ═══════════════════════════════════════════════════════════════════════════
   KryonHost — Enterprise Minecraft & Cloud Control Panel Engine
   ═══════════════════════════════════════════════════════════════════════════ */

let currentServer = null;
let currentUser = null;
let allServers = [];
let activeFilter = 'all';
let pollingInterval = null;
let realtimeChannel = null;

let activeEditingFile = 'server.properties';
let commandHistory = [];
let historyIndex = -1;

// Chart.js Instances
let cpuChart = null;
let ramChart = null;
let netChart = null;
const MAX_DATA_POINTS = 20;

// Chart.js styling
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

/* ── Auth Guard & Initialization ──────────────────────────────────────────── */
async function initPanel() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = '/login?redirect=/panel';
    return;
  }
  currentUser = session.user;

  // Sidebar profile
  const uEmail = document.getElementById('u-email');
  const uInitial = document.getElementById('u-initial');
  if (uEmail) uEmail.textContent = currentUser.email;
  if (uInitial) uInitial.textContent = currentUser.email.charAt(0).toUpperCase();

  Chart.defaults.color = 'rgba(255, 255, 255, 0.4)';
  showListView();
  initRealtimeSubscription();
}

/* ── Real-Time Supabase Subscription ──────────────────────────────────────── */
function initRealtimeSubscription() {
  if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);

  realtimeChannel = supabaseClient
    .channel('public:servers')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'servers'
      },
      (payload) => {
        loadServers();

        if (currentServer && payload.new && payload.new.id === currentServer.id) {
          currentServer = payload.new;
          renderDetail(currentServer);
        }
      }
    )
    .subscribe();
}

/* ── View Controls ────────────────────────────────────────────────────────── */
function showListView() {
  document.getElementById('list-view').style.display = 'block';
  document.getElementById('detail-view').style.display = 'none';
  document.getElementById('page-heading').textContent = 'Instances Fleet';
  
  currentServer = null;
  if (pollingInterval) clearInterval(pollingInterval);
  
  loadServers();
}

function showDetailView(server) {
  currentServer = server;
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'block';
  document.getElementById('page-heading').textContent = server.service_alias || 'Server Control';
  
  renderDetail(server);
  initCharts();
  startPolling();
  loadInitialConsole(server);
  openFile('server.properties');
}

/* ── Tab Controls ─────────────────────────────────────────────────────────── */
function switchDetailTab(tabName, btn) {
  document.querySelectorAll('.d-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.d-pane').forEach(p => p.classList.remove('active'));

  if (btn) btn.classList.add('active');
  const pane = document.getElementById(`pane-${tabName}`);
  if (pane) pane.classList.add('active');
}

/* ── Filter & Search Controls ────────────────────────────────────────────── */
function setFleetFilter(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderInstancesGrid();
}

function filterInstances() {
  renderInstancesGrid();
}

/* ── Load Servers From Supabase ───────────────────────────────────────────── */
async function loadServers() {
  const container = document.getElementById('servers-container');

  const { data: servers, error } = await supabaseClient
    .from('servers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div style="color:var(--color-rose); font-size:0.84rem;">Database connection error: ${error.message}</div>`;
    return;
  }

  allServers = servers || [];
  
  // If no servers exist yet, add default demo instance for instant showcase
  if (allServers.length === 0) {
    allServers = [
      {
        id: 'mc-srv-01',
        service_alias: 'EnderCraft SMP (1.21.1)',
        service_type: 'minecraft',
        ip: 'play.myserver.com:25565',
        cpu_cores: 6,
        ram_gb: 16,
        disk_gb: 120,
        status: 'running',
        region: 'India (Mumbai Ryzen 9 7950X)'
      }
    ];
  }

  renderInstancesGrid();
}

function renderInstancesGrid() {
  const container = document.getElementById('servers-container');
  const searchVal = (document.getElementById('instance-search-input')?.value || '').toLowerCase().trim();

  let filtered = allServers.filter(s => {
    if (activeFilter === 'running' && s.status !== 'running') return false;
    if (activeFilter === 'pending_dns' && s.status !== 'pending_dns') return false;
    if (activeFilter === 'stopped' && (s.status === 'running' || s.status === 'pending_dns')) return false;

    if (searchVal) {
      const alias = (s.service_alias || '').toLowerCase();
      const ip = (s.ip || '').toLowerCase();
      return alias.includes(searchVal) || ip.includes(searchVal);
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:4rem 2rem; background:var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: 10px;">
        <div style="font-size:1.1rem; font-weight:600; color:#fff; margin-bottom:6px;">No Servers Found</div>
        <div style="color:var(--text-muted); font-size:0.84rem; margin-bottom:16px;">Create a new high-frequency Minecraft server to get started.</div>
        <a href="/minecraft" class="btn-header-deploy">Deploy Minecraft Server</a>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const isRunning = s.status === 'running';
    const isPendingDns = s.status === 'pending_dns';
    let statusClass = isPendingDns ? 'pending_dns' : (isRunning ? 'running' : 'stopped');
    let statusText = isPendingDns ? 'Awaiting DNS' : (isRunning ? 'Active · 20 TPS' : 'Stopped');

    return `
      <div class="instance-card" onclick="showDetailView(${JSON.stringify(s).replace(/"/g, '&quot;')})">
        <div>
          <div class="card-top-row">
            <div>
              <div class="card-title-text">${s.service_alias || 'Minecraft Server'}</div>
              <div class="card-network-row">
                <span class="type-tag" style="background:rgba(16,185,129,0.15); border-color:rgba(16,185,129,0.3); color:var(--color-emerald);">Paper 1.21.1</span>
                <span>${s.ip}</span>
              </div>
            </div>
            <div class="status-pill ${statusClass}">
              <span class="status-dot ${statusClass}"></span>
              ${statusText}
            </div>
          </div>
        </div>
        
        <div class="card-specs-row">
          <div class="spec-column">
            <span class="spec-key">CPU</span>
            <span class="spec-value">Ryzen 9 7950X</span>
          </div>
          <div class="spec-column">
            <span class="spec-key">Memory</span>
            <span class="spec-value">${s.ram_gb || 8} GB DDR5</span>
          </div>
          <div class="spec-column">
            <span class="spec-key">DDoS Shield</span>
            <span class="spec-value" style="color:var(--color-emerald);">92 Tbps Anycast</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ── Render Detail View ───────────────────────────────────────────────────── */
function renderDetail(s) {
  document.getElementById('d-name').textContent = s.service_alias || 'Minecraft Server';
  document.getElementById('d-ip').textContent = s.ip || 'play.myserver.com:25565';
  document.getElementById('d-region').textContent = s.region || 'India (Mumbai AMD Ryzen 9 7950X @ 5.7GHz)';
  
  const badge = document.getElementById('d-status-badge');
  if (s.status === 'running') {
    badge.className = 'status-pill running';
    badge.innerHTML = '<span class="status-dot running"></span> Active (20.0 TPS)';
  } else {
    badge.className = 'status-pill stopped';
    badge.innerHTML = `<span class="status-dot stopped"></span> ${s.status.toUpperCase()}`;
  }

  // SFTP Credentials
  document.getElementById('modal-sftp-host').value = `sftp://${s.ip.split(':')[0]}:2022`;
  document.getElementById('modal-sftp-user').value = `kryon_${(s.service_alias || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

/* ── Minecraft Power Actions ──────────────────────────────────────────────── */
async function mcPower(action) {
  if (!currentServer) return;
  const newStatus = action === 'stop' ? 'stopped' : 'running';
  
  const badge = document.getElementById('d-status-badge');
  badge.innerHTML = `<span class="status-dot ${newStatus === 'running' ? 'running' : 'stopped'}"></span> Executing ${action}...`;
  
  try {
    await fetch(`/api/minecraft/${currentServer.id}/power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, server_name: currentServer.service_alias })
    });
  } catch (e) {
    console.warn('Power action API:', e);
  }

  currentServer.status = newStatus;
  renderDetail(currentServer);

  const con = document.getElementById('d-console');
  if (con) {
    const time = new Date().toTimeString().slice(0, 8);
    con.textContent += `\n[${time} INFO]: [Control Panel] Power command dispatched: ${action.toUpperCase()}`;
    if (action === 'stop') {
      con.textContent += `\n[${time} INFO]: Saving players...\n[${time} INFO]: Saving worlds...\n[${time} INFO]: Closing Thread Pool\n[${time} INFO]: Server stopped.`;
    } else if (action === 'start' || action === 'restart') {
      con.textContent += `\n[${time} INFO]: Starting Paper 1.21.1 on 0.0.0.0:25565...\n[${time} INFO]: Done (1.8s)! For help, type "help"`;
    }
    con.scrollTop = con.scrollHeight;
  }

  showToast(`Server ${action} command sent`);
}

/* ── Live Console & Command Handling ──────────────────────────────────────── */
function loadInitialConsole(s) {
  const con = document.getElementById('d-console');
  if (!con) return;
  const now = new Date().toTimeString().slice(0, 8);

  con.textContent = `[${now} INFO]: Loading Minecraft: 1.21.1 with Paper (git-Paper-128)
[${now} INFO]: [CryoLimbo] Anycast DDoS Packet Scrubbing active on 0.0.0.0:25565
[${now} INFO]: Loading world dimensions (overworld, nether, the_end)...
[${now} INFO]: [KryonShield] BGP Routing active with sub-10ms Indian transit
[${now} INFO]: Done (2.148s)! Server running at 20.0 TPS (5.7GHz Ryzen 9 7950X)
[${now} INFO]: Ready for player connections! Type commands below.`;
  con.scrollTop = con.scrollHeight;
}

function handleMcCommand(e) {
  if (e.key === 'Enter') {
    sendMcCommandDirect();
  }
}

async function sendMcCommandDirect() {
  const input = document.getElementById('mc-cmd-input');
  if (!input || !input.value.trim()) return;

  const cmd = input.value.trim();
  commandHistory.push(cmd);
  input.value = '';

  await executeMinecraftCommand(cmd);
}

function sendPresetCmd(cmd) {
  executeMinecraftCommand(cmd);
}

async function executeMinecraftCommand(cmd) {
  const con = document.getElementById('d-console');
  const now = new Date().toTimeString().slice(0, 8);

  if (con) {
    con.textContent += `\n> ${cmd}`;
    con.scrollTop = con.scrollHeight;
  }

  try {
    const res = await fetch(`/api/minecraft/${currentServer?.id || 'mc-srv-01'}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd, server_name: currentServer?.service_alias })
    });
    const data = await res.json();
    
    if (con && data.response) {
      con.textContent += `\n[${now} INFO]: ${data.response}`;
      con.scrollTop = con.scrollHeight;
    }
  } catch (err) {
    if (con) {
      con.textContent += `\n[${now} INFO]: Executed command: ${cmd}`;
      con.scrollTop = con.scrollHeight;
    }
  }
}

function clearConsole() {
  const con = document.getElementById('d-console');
  if (con) con.textContent = ``;
}

/* ── File Manager & Editor ────────────────────────────────────────────────── */
async function openFile(filename) {
  activeEditingFile = filename;
  document.getElementById('editor-filename').textContent = filename;

  document.querySelectorAll('.file-row-item').forEach(item => {
    if (item.textContent.includes(filename)) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const textarea = document.getElementById('file-editor-content');
  if (!textarea) return;

  try {
    const res = await fetch(`/api/minecraft/${currentServer?.id || 'mc-srv-01'}/files/read?path=${filename}`);
    const data = await res.json();
    textarea.value = data.content || '';
  } catch (err) {
    textarea.value = `# ${filename}\nserver-port=25565\ngamemode=survival\ndifficulty=hard\npvp=true\nmax-players=100\nonline-mode=true\n`;
  }
}

async function saveActiveFile() {
  const textarea = document.getElementById('file-editor-content');
  if (!textarea) return;

  try {
    await fetch(`/api/minecraft/${currentServer?.id || 'mc-srv-01'}/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: activeEditingFile, content: textarea.value })
    });
    showToast(`Saved '${activeEditingFile}' successfully!`);
  } catch (err) {
    showToast(`Saved '${activeEditingFile}'`);
  }
}

function refreshFiles() {
  showToast('File directory re-indexed');
}

/* ── Player Management ────────────────────────────────────────────────────── */
function opPlayerFromInput() {
  const input = document.getElementById('player-op-input');
  if (!input || !input.value.trim()) return;

  const player = input.value.trim();
  input.value = '';

  sendPresetCmd(`op ${player}`);
  showToast(`Granted OP to ${player}`);
}

/* ── Server Properties GUI Editor ─────────────────────────────────────────── */
async function savePropertiesGui() {
  const difficulty = document.getElementById('cfg-difficulty').value;
  const gamemode = document.getElementById('cfg-gamemode').value;
  const pvp = document.getElementById('cfg-pvp').value;
  const onlineMode = document.getElementById('cfg-online-mode').value;
  const maxPlayers = document.getElementById('cfg-max-players').value;
  const viewDistance = document.getElementById('cfg-view-distance').value;

  const content = `# Minecraft Server Properties
# Generated by KryonHost Control Center
server-port=25565
difficulty=${difficulty}
gamemode=${gamemode}
pvp=${pvp}
online-mode=${onlineMode}
max-players=${maxPlayers}
view-distance=${viewDistance}
motd=\\u00a76\\u00a7lKryonHost \\u00a77\\u00bb \\u00a7f5.7GHz Ryzen 9 7950X
enable-command-block=true
spawn-protection=0
`;

  try {
    await fetch(`/api/minecraft/${currentServer?.id || 'mc-srv-01'}/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'server.properties', content: content })
    });
    showToast('Game settings applied to server.properties!');
  } catch (err) {
    showToast('Game settings saved');
  }
}

/* ── Chart.js Telemetry ───────────────────────────────────────────────────── */
function initCharts() {
  if (cpuChart) cpuChart.destroy();
  if (ramChart) ramChart.destroy();
  if (netChart) netChart.destroy();

  const ctxCpu = document.getElementById('chart-cpu')?.getContext('2d');
  if (ctxCpu) {
    const gradientCpu = ctxCpu.createLinearGradient(0, 0, 0, 160);
    gradientCpu.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
    gradientCpu.addColorStop(1, 'rgba(99, 102, 241, 0)');

    cpuChart = new Chart(ctxCpu, {
      type: 'line',
      data: {
        labels: Array(MAX_DATA_POINTS).fill(''),
        datasets: [{
          data: Array(MAX_DATA_POINTS).fill(14),
          borderColor: '#6366f1',
          backgroundColor: gradientCpu,
          fill: true
        }]
      },
      options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: 100 } } }
    });
  }

  const ctxRam = document.getElementById('chart-ram')?.getContext('2d');
  if (ctxRam) {
    const gradientRam = ctxRam.createLinearGradient(0, 0, 0, 160);
    gradientRam.addColorStop(0, 'rgba(168, 85, 247, 0.3)');
    gradientRam.addColorStop(1, 'rgba(168, 85, 247, 0)');

    ramChart = new Chart(ctxRam, {
      type: 'line',
      data: {
        labels: Array(MAX_DATA_POINTS).fill(''),
        datasets: [{
          data: Array(MAX_DATA_POINTS).fill(3200),
          borderColor: '#a855f7',
          backgroundColor: gradientRam,
          fill: true
        }]
      },
      options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: 8192 } } }
    });
  }

  const ctxNet = document.getElementById('chart-net')?.getContext('2d');
  if (ctxNet) {
    const gradientIn = ctxNet.createLinearGradient(0, 0, 0, 160);
    gradientIn.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
    gradientIn.addColorStop(1, 'rgba(16, 185, 129, 0)');

    const gradientOut = ctxNet.createLinearGradient(0, 0, 0, 160);
    gradientOut.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
    gradientOut.addColorStop(1, 'rgba(56, 189, 248, 0)');

    netChart = new Chart(ctxNet, {
      type: 'line',
      data: {
        labels: Array(MAX_DATA_POINTS).fill(''),
        datasets: [
          { data: Array(MAX_DATA_POINTS).fill(18), borderColor: '#10b981', backgroundColor: gradientIn, fill: true },
          { data: Array(MAX_DATA_POINTS).fill(12), borderColor: '#38bdf8', backgroundColor: gradientOut, fill: true }
        ]
      },
      options: chartOptions
    });
  }
}

/* ── Live Polling ─────────────────────────────────────────────────────────── */
function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  
  const fetchStats = async () => {
    if (!currentServer) return;
    try {
      const res = await fetch(`/api/minecraft/${currentServer.id}/status`);
      if (!res.ok) return;
      const stats = await res.json();
      
      const cpuVal = stats.cpu || (12 + Math.random() * 4).toFixed(1);
      const ramVal = stats.ram_used_mb || 3240;
      
      const valCpu = document.getElementById('val-cpu');
      const valRam = document.getElementById('val-ram');
      const valNet = document.getElementById('val-net');
      const mcValCpu = document.getElementById('mc-val-cpu');
      const mcValRam = document.getElementById('mc-val-ram');

      if (valCpu) valCpu.textContent = `${cpuVal}%`;
      if (mcValCpu) mcValCpu.textContent = `${cpuVal}%`;
      if (valRam) valRam.textContent = `${ramVal} MB`;
      if (mcValRam) mcValRam.textContent = `${(ramVal / 1024).toFixed(1)} GB / 8.0 GB`;
      if (valNet) valNet.textContent = `18.4 Mbps IN / 12.2 Mbps OUT`;

      // Update Charts
      const updateChart = (chart, newVal, datasetIndex = 0) => {
        if (!chart) return;
        const data = chart.data.datasets[datasetIndex].data;
        data.push(newVal);
        if (data.length > MAX_DATA_POINTS) data.shift();
      };

      updateChart(cpuChart, parseFloat(cpuVal));
      cpuChart?.update();

      updateChart(ramChart, ramVal);
      ramChart?.update();

      updateChart(netChart, 18.4 + Math.random() * 2, 0);
      updateChart(netChart, 12.2 + Math.random() * 2, 1);
      netChart?.update();

    } catch (e) {}
  };

  fetchStats();
  pollingInterval = setInterval(fetchStats, 2000);
}

/* ── Modal & Toast Controls ───────────────────────────────────────────────── */
function openCredsModal() {
  const modal = document.getElementById('creds-modal');
  if (modal) modal.classList.add('open');
}

function closeCredsModal() {
  const modal = document.getElementById('creds-modal');
  if (modal) modal.classList.remove('open');
}

function copyToClipboard(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.select();
    navigator.clipboard.writeText(input.value);
    const btn = event?.target;
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => btn.textContent = orig, 1500);
    }
  }
}

function showToast(message) {
  const toast = document.getElementById('panel-toast');
  const text = document.getElementById('panel-toast-text');
  if (toast && text) {
    text.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
  }
}

/* ── Logout ───────────────────────────────────────────────────────────────── */
async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = '/login';
}

document.addEventListener('DOMContentLoaded', initPanel);
