/* ═══════════════════════════════════════════════════════════════════════════
   KryonPanel — Next-Gen Client Panel with Real-Time Charting
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
  animation: { duration: 400, easing: 'linear' },
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

/* ── Auth Guard ───────────────────────────────────────────────────────────── */
async function initPanel() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = '/login';
    return;
  }
  currentUser = session.user;

  // Sidebar profile
  document.getElementById('u-email').textContent = currentUser.email;
  document.getElementById('u-initial').textContent = currentUser.email.charAt(0).toUpperCase();

  Chart.defaults.color = 'rgba(255, 255, 255, 0.4)';
  showListView();
}

/* ── Views ────────────────────────────────────────────────────────────────── */
function showListView() {
  document.getElementById('list-view').style.display = 'block';
  document.getElementById('detail-view').style.display = 'none';
  document.getElementById('top-header').querySelector('.page-title').textContent = 'Compute Instances';
  
  currentServer = null;
  if (pollingInterval) clearInterval(pollingInterval);
  
  loadServers();
}

function showDetailView(server) {
  currentServer = server;
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'block';
  document.getElementById('top-header').querySelector('.page-title').textContent = 'Server Overview';
  
  renderDetail(server);
  initCharts();
  startPolling();
}

/* ── Load Servers ─────────────────────────────────────────────────────────── */
async function loadServers() {
  const container = document.getElementById('servers-container');
  container.innerHTML = `<div style="color:var(--text-muted);">Fetching your infrastructure...</div>`;

  const { data: servers, error } = await supabaseClient
    .from('servers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div style="color:var(--accent-red);">Error loading servers: ${error.message}</div>`;
    return;
  }

  if (!servers || servers.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:6rem 0; border: 1px dashed var(--border-subtle); border-radius: 16px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--border-focus)" stroke-width="1.5" style="margin-bottom:16px;"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        <div style="font-size:1.2rem; font-weight:500; color:#fff; margin-bottom:8px;">No Active Instances</div>
        <div style="color:var(--text-muted); font-size:0.9rem; margin-bottom:24px;">You haven't deployed any servers yet. Order via Discord.</div>
        <a href="https://discord.gg/kt9yPDwYT4" target="_blank" class="btn-p-start" style="padding:10px 24px; border-radius:8px; text-decoration:none; display:inline-block;">Order via Discord</a>
      </div>`;
    return;
  }

  container.innerHTML = servers.map(s => {
    const running = s.status === 'running';
    
    return `
      <div class="scard" onclick="showDetailView(${JSON.stringify(s).replace(/"/g, '&quot;')})">
        <div class="scard-header">
          <div>
            <div class="scard-title">${s.service_alias}</div>
            <div class="scard-ip">${s.ip}</div>
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

/* ── Detail View Rendering ────────────────────────────────────────────────── */
function renderDetail(s) {
  const running = s.status === 'running';

  document.getElementById('d-name').textContent = s.service_alias;
  document.getElementById('d-ip').textContent = s.ip;
  document.getElementById('d-region').textContent = s.region || 'India (Mumbai)';
  
  const badge = document.getElementById('d-status-badge');
  badge.className = `status-badge ${running ? 'running' : 'stopped'}`;
  badge.innerHTML = `<span class="dot ${running ? 'running' : 'stopped'}"></span> ${s.status.toUpperCase()}`;

  document.getElementById('hw-cpu').textContent = `${s.cpu_cores} vCores`;
  document.getElementById('hw-ram').textContent = `${s.ram_gb} GB DDR5`;
  document.getElementById('hw-disk').textContent = `${s.disk_gb} GB NVMe`;
  document.getElementById('hw-os').textContent = s.os || 'Ubuntu 24.04 LTS';
}

/* ── Chart Initialization ─────────────────────────────────────────────────── */
function initCharts() {
  if (cpuChart) cpuChart.destroy();
  if (ramChart) ramChart.destroy();
  if (netChart) netChart.destroy();

  const createData = () => ({
    labels: Array(MAX_DATA_POINTS).fill(''),
    datasets: [{ data: Array(MAX_DATA_POINTS).fill(0) }]
  });

  const ctxCpu = document.getElementById('chart-cpu').getContext('2d');
  const gradientCpu = ctxCpu.createLinearGradient(0, 0, 0, 180);
  gradientCpu.addColorStop(0, 'rgba(0, 112, 243, 0.4)');
  gradientCpu.addColorStop(1, 'rgba(0, 112, 243, 0)');

  cpuChart = new Chart(ctxCpu, {
    type: 'line',
    data: {
      labels: Array(MAX_DATA_POINTS).fill(''),
      datasets: [{
        data: Array(MAX_DATA_POINTS).fill(0),
        borderColor: '#0070f3',
        backgroundColor: gradientCpu,
        fill: true
      }]
    },
    options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: 100 } } }
  });

  const ctxRam = document.getElementById('chart-ram').getContext('2d');
  const gradientRam = ctxRam.createLinearGradient(0, 0, 0, 180);
  gradientRam.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
  gradientRam.addColorStop(1, 'rgba(139, 92, 246, 0)');

  ramChart = new Chart(ctxRam, {
    type: 'line',
    data: {
      labels: Array(MAX_DATA_POINTS).fill(''),
      datasets: [{
        data: Array(MAX_DATA_POINTS).fill(0),
        borderColor: '#8b5cf6',
        backgroundColor: gradientRam,
        fill: true
      }]
    },
    options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: (currentServer.ram_gb || 4) * 1024 } } }
  });

  const ctxNet = document.getElementById('chart-net').getContext('2d');
  const gradientIn = ctxNet.createLinearGradient(0, 0, 0, 180);
  gradientIn.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
  gradientIn.addColorStop(1, 'rgba(16, 185, 129, 0)');

  const gradientOut = ctxNet.createLinearGradient(0, 0, 0, 180);
  gradientOut.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
  gradientOut.addColorStop(1, 'rgba(239, 68, 68, 0)');

  netChart = new Chart(ctxNet, {
    type: 'line',
    data: {
      labels: Array(MAX_DATA_POINTS).fill(''),
      datasets: [
        { data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#10b981', backgroundColor: gradientIn, fill: true }, // IN
        { data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#ef4444', backgroundColor: gradientOut, fill: true } // OUT
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
      const stats = await res.json();
      
      // Update DOM Text
      document.getElementById('val-cpu').textContent = `${stats.cpu}%`;
      document.getElementById('val-ram').textContent = `${stats.ram} MB`;
      document.getElementById('val-net').textContent = `${stats.network_in} IN / ${stats.network_out} OUT`;
      
      if (stats.status !== currentServer.status) {
        currentServer.status = stats.status;
        renderDetail(currentServer); // update badge
      }

      // Update Charts
      const updateChart = (chart, newVal, datasetIndex = 0) => {
        const data = chart.data.datasets[datasetIndex].data;
        data.push(newVal);
        if (data.length > MAX_DATA_POINTS) data.shift();
      };

      updateChart(cpuChart, stats.cpu);
      cpuChart.update();

      updateChart(ramChart, stats.ram);
      ramChart.update();

      updateChart(netChart, stats.network_in, 0); // IN
      updateChart(netChart, stats.network_out, 1); // OUT
      netChart.update();

    } catch (e) {
      console.log('Stats polling failed:', e);
    }
  };

  fetchStats(); // immediate
  pollingInterval = setInterval(fetchStats, 2000);
}

/* ── Actions ──────────────────────────────────────────────────────────────── */
async function powerAction(action) {
  if (!currentServer) return;
  const newStatus = action === 'start' ? 'running' : (action === 'stop' ? 'stopped' : 'rebooting');
  
  // Optimistic UI update
  const badge = document.getElementById('d-status-badge');
  badge.innerHTML = `<span class="dot ${action === 'start' ? 'running' : 'stopped'}"></span> Processing...`;
  
  await supabaseClient.from('servers').update({ status: action === 'start' ? 'running' : 'stopped' }).eq('id', currentServer.id);
  
  currentServer.status = action === 'start' ? 'running' : 'stopped';
  renderDetail(currentServer);
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = '/login';
}

document.addEventListener('DOMContentLoaded', initPanel);
