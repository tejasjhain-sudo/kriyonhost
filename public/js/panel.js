/* ═══════════════════════════════════════════════════════════════════════════
   KryonPanel — Next-Gen Client Cloud Dashboard Controller
   ═══════════════════════════════════════════════════════════════════════════ */

let currentServer = null;
let currentUser = null;
let pollingInterval = null;

// Chart.js Instances
let cpuChart = null;
let ramChart = null;
let netChart = null;
const MAX_DATA_POINTS = 20;

// Common Chart.js styling config
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 350, easing: 'linear' },
  scales: {
    x: { display: false },
    y: { 
      beginAtZero: true, 
      grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
      ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10, family: 'DM Mono' } }
    }
  },
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
  elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } },
  interaction: { intersect: false, mode: 'index' }
};

/* ── Auth Guard & Initialization ──────────────────────────────────────────── */
async function initPanel() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = '/login';
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
}

/* ── View Controls ────────────────────────────────────────────────────────── */
function showListView() {
  document.getElementById('list-view').style.display = 'block';
  document.getElementById('detail-view').style.display = 'none';
  document.getElementById('page-heading').textContent = 'Compute Instances';
  
  currentServer = null;
  if (pollingInterval) clearInterval(pollingInterval);
  
  loadServers();
}

function showDetailView(server) {
  currentServer = server;
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'block';
  document.getElementById('page-heading').textContent = server.service_alias || 'Server Overview';
  
  renderDetail(server);
  initCharts();
  startPolling();
  populateConsole(server);
}

/* ── Tab Controls ─────────────────────────────────────────────────────────── */
function switchDetailTab(tabName, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  if (btn) btn.classList.add('active');
  const pane = document.getElementById(`pane-${tabName}`);
  if (pane) pane.classList.add('active');
}

/* ── Load Servers From Supabase ───────────────────────────────────────────── */
async function loadServers() {
  const container = document.getElementById('servers-container');
  container.innerHTML = `<div style="color:var(--text-muted); font-size:0.9rem;">Connecting to KryonHost telemetry...</div>`;

  const { data: servers, error } = await supabaseClient
    .from('servers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div style="color:var(--accent-red);">Error connecting to database: ${error.message}</div>`;
    return;
  }

  if (!servers || servers.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:5rem 2rem; background:rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px;">
        <div style="width:54px; height:54px; border-radius:14px; background:rgba(124,106,255,0.1); border:1px solid rgba(124,106,255,0.25); display:inline-flex; align-items:center; justify-content:center; margin-bottom:16px; color:var(--purple-bright);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <div style="font-size:1.3rem; font-weight:600; color:#fff; margin-bottom:8px; font-family:'Bricolage Grotesque',sans-serif;">No Active Compute Instances</div>
        <div style="color:var(--text-muted); font-size:0.92rem; max-width:440px; margin:0 auto 24px; line-height:1.5;">You do not have any deployed virtual machines or Minecraft nodes yet. Deploy one via our web configurator or Discord.</div>
        <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
          <a href="/#configurator-section" class="btn btn-primary" style="padding:10px 24px;">Configure on Web</a>
          <a href="https://discord.gg/kt9yPDwYT4" target="_blank" class="btn btn-ghost" style="padding:10px 24px; border:1px solid var(--border-subtle);">Order on Discord</a>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = servers.map(s => {
    const running = s.status === 'running';
    const typeLabel = (s.service_type || 'vps').toUpperCase();
    
    return `
      <div class="scard" onclick="showDetailView(${JSON.stringify(s).replace(/"/g, '&quot;')})">
        <div class="scard-header">
          <div>
            <div class="scard-title">${s.service_alias}</div>
            <div class="scard-ip">
              <span style="font-size:0.65rem; padding:2px 6px; border-radius:4px; background:rgba(124,106,255,0.15); color:var(--purple-bright); font-weight:700;">${typeLabel}</span>
              ${s.ip}
            </div>
          </div>
          <div class="status-badge ${running ? 'running' : 'stopped'}">
            <span class="dot ${running ? 'running' : 'stopped'}"></span>
            ${s.status}
          </div>
        </div>
        
        <div class="scard-specs">
          <div class="spec-item">
            <span class="spec-lbl">vCPU</span>
            <span class="spec-val">${s.cpu_cores} Cores</span>
          </div>
          <div class="spec-item">
            <span class="spec-lbl">RAM</span>
            <span class="spec-val">${s.ram_gb} GB</span>
          </div>
          <div class="spec-item">
            <span class="spec-lbl">Storage</span>
            <span class="spec-val">${s.disk_gb} GB</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ── Render Detail View ───────────────────────────────────────────────────── */
function renderDetail(s) {
  const running = s.status === 'running';

  document.getElementById('d-name').textContent = s.service_alias;
  document.getElementById('d-ip').textContent = s.ip;
  document.getElementById('d-region').textContent = s.region || 'India (Mumbai Tier-4)';
  
  const badge = document.getElementById('d-status-badge');
  badge.className = `status-badge ${running ? 'running' : 'stopped'}`;
  badge.innerHTML = `<span class="dot ${running ? 'running' : 'stopped'}"></span> ${s.status.toUpperCase()}`;

  document.getElementById('hw-cpu').textContent = `${s.cpu_cores} vCores`;
  document.getElementById('hw-ram').textContent = `${s.ram_gb} GB DDR5`;
  document.getElementById('hw-disk').textContent = `${s.disk_gb} GB NVMe`;
  document.getElementById('hw-os').textContent = s.os || 'Ubuntu 24.04 LTS';

  // Modal setup
  document.getElementById('modal-ssh-cmd').value = `ssh root@${s.ip} -p 22`;
  document.getElementById('modal-sftp-host').value = `sftp://${s.ip}:22`;
}

function populateConsole(s) {
  const con = document.getElementById('d-console');
  if (!con) return;
  const time = new Date().toLocaleTimeString();
  con.textContent = `[${time}] KryonHost Virtualization Hypervisor v4.2.1 initialized.\n` +
    `[${time}] Attached to guest container: ${s.service_alias} (${s.id})\n` +
    `[${time}] IP Allocation: ${s.ip}/32 via Anycast gateway.\n` +
    `[${time}] Status: ${s.status === 'running' ? 'Active / 20.0 TPS stable' : 'Stopped'}\n` +
    `[${time}] CPU Cores: ${s.cpu_cores}x AMD Zen 4 @ 5.7GHz, RAM: ${s.ram_gb}GB DDR5 ECC.\n` +
    `[${time}] Ready for interactive management commands.\n` +
    `kryon@${s.service_alias.toLowerCase().replace(/\\s+/g, '-')}:~$ `;
}

function clearConsole() {
  const con = document.getElementById('d-console');
  if (con && currentServer) {
    con.textContent = `kryon@${currentServer.service_alias.toLowerCase().replace(/\\s+/g, '-')}:~$ `;
  }
}

/* ── Chart.js Telemetry ───────────────────────────────────────────────────── */
function initCharts() {
  if (cpuChart) cpuChart.destroy();
  if (ramChart) ramChart.destroy();
  if (netChart) netChart.destroy();

  const ctxCpu = document.getElementById('chart-cpu').getContext('2d');
  const gradientCpu = ctxCpu.createLinearGradient(0, 0, 0, 170);
  gradientCpu.addColorStop(0, 'rgba(124, 106, 255, 0.4)');
  gradientCpu.addColorStop(1, 'rgba(124, 106, 255, 0)');

  cpuChart = new Chart(ctxCpu, {
    type: 'line',
    data: {
      labels: Array(MAX_DATA_POINTS).fill(''),
      datasets: [{
        data: Array(MAX_DATA_POINTS).fill(0),
        borderColor: '#7c6aff',
        backgroundColor: gradientCpu,
        fill: true
      }]
    },
    options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: 100 } } }
  });

  const ctxRam = document.getElementById('chart-ram').getContext('2d');
  const gradientRam = ctxRam.createLinearGradient(0, 0, 0, 170);
  gradientRam.addColorStop(0, 'rgba(192, 132, 252, 0.4)');
  gradientRam.addColorStop(1, 'rgba(192, 132, 252, 0)');

  ramChart = new Chart(ctxRam, {
    type: 'line',
    data: {
      labels: Array(MAX_DATA_POINTS).fill(''),
      datasets: [{
        data: Array(MAX_DATA_POINTS).fill(0),
        borderColor: '#c084fc',
        backgroundColor: gradientRam,
        fill: true
      }]
    },
    options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: (currentServer?.ram_gb || 8) * 1024 } } }
  });

  const ctxNet = document.getElementById('chart-net').getContext('2d');
  const gradientIn = ctxNet.createLinearGradient(0, 0, 0, 170);
  gradientIn.addColorStop(0, 'rgba(34, 197, 94, 0.35)');
  gradientIn.addColorStop(1, 'rgba(34, 197, 94, 0)');

  const gradientOut = ctxNet.createLinearGradient(0, 0, 0, 170);
  gradientOut.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
  gradientOut.addColorStop(1, 'rgba(56, 189, 248, 0)');

  netChart = new Chart(ctxNet, {
    type: 'line',
    data: {
      labels: Array(MAX_DATA_POINTS).fill(''),
      datasets: [
        { data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#22c55e', backgroundColor: gradientIn, fill: true },
        { data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#38bdf8', backgroundColor: gradientOut, fill: true }
      ]
    },
    options: chartOptions
  });
}

/* ── Live Polling ─────────────────────────────────────────────────────────── */
function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  
  const fetchStats = async () => {
    if (!currentServer) return;
    try {
      const res = await fetch(`/api/servers/${currentServer.id}/stats`);
      if (!res.ok) return;
      const stats = await res.json();
      
      // Update DOM
      document.getElementById('val-cpu').textContent = `${stats.cpu}%`;
      document.getElementById('val-ram').textContent = `${stats.ram} MB`;
      document.getElementById('val-net').textContent = `${stats.network_in} Mbps IN / ${stats.network_out} Mbps OUT`;
      
      if (stats.status !== currentServer.status) {
        currentServer.status = stats.status;
        renderDetail(currentServer);
      }

      // Update Charts
      const updateChart = (chart, newVal, datasetIndex = 0) => {
        if (!chart) return;
        const data = chart.data.datasets[datasetIndex].data;
        data.push(newVal);
        if (data.length > MAX_DATA_POINTS) data.shift();
      };

      updateChart(cpuChart, stats.cpu);
      cpuChart?.update();

      updateChart(ramChart, stats.ram);
      ramChart?.update();

      updateChart(netChart, stats.network_in, 0);
      updateChart(netChart, stats.network_out, 1);
      netChart?.update();

    } catch (e) {
      console.log('Stats polling paused:', e);
    }
  };

  fetchStats();
  pollingInterval = setInterval(fetchStats, 2000);
}

/* ── Power Actions ────────────────────────────────────────────────────────── */
async function powerAction(action) {
  if (!currentServer) return;
  const newStatus = action === 'start' ? 'running' : 'stopped';
  
  const badge = document.getElementById('d-status-badge');
  badge.innerHTML = `<span class="dot ${newStatus === 'running' ? 'running' : 'stopped'}"></span> Processing ${action}...`;
  
  await supabaseClient.from('servers').update({ status: newStatus }).eq('id', currentServer.id);
  
  currentServer.status = newStatus;
  renderDetail(currentServer);

  // Append to console
  const con = document.getElementById('d-console');
  if (con) {
    con.textContent += `\n[ACTION] Power command executed: ${action.toUpperCase()} -> Status changed to ${newStatus}`;
    con.scrollTop = con.scrollHeight;
  }
}

/* ── Modal Controls ───────────────────────────────────────────────────────── */
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
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = orig, 1500);
    }
  }
}

/* ── Logout ───────────────────────────────────────────────────────────────── */
async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = '/login';
}

document.addEventListener('DOMContentLoaded', initPanel);
