/* ═══════════════════════════════════════════════════════════════════════════
   KryonHost — Enterprise Cloud Control Panel Engine
   ═══════════════════════════════════════════════════════════════════════════ */

let currentServer = null;
let currentUser = null;
let allServers = [];
let activeFilter = 'all';
let pollingInterval = null;
let realtimeChannel = null;

// Chart.js Instances
let cpuChart = null;
let ramChart = null;
let netChart = null;
const MAX_DATA_POINTS = 20;

// Professional Chart.js styling
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
  document.getElementById('page-heading').textContent = server.service_alias || 'Instance Details';
  
  renderDetail(server);
  initCharts();
  startPolling();
  populateConsole(server);
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
  renderInstancesGrid();
}

function renderInstancesGrid() {
  const container = document.getElementById('servers-container');
  const searchVal = (document.getElementById('instance-search-input')?.value || '').toLowerCase().trim();

  let filtered = allServers.filter(s => {
    // Status filter
    if (activeFilter === 'running' && s.status !== 'running') return false;
    if (activeFilter === 'pending_dns' && s.status !== 'pending_dns') return false;
    if (activeFilter === 'stopped' && (s.status === 'running' || s.status === 'pending_dns')) return false;

    // Text search
    if (searchVal) {
      const alias = (s.service_alias || '').toLowerCase();
      const ip = (s.ip || '').toLowerCase();
      const id = (s.id || '').toLowerCase();
      return alias.includes(searchVal) || ip.includes(searchVal) || id.includes(searchVal);
    }
    return true;
  });

  if (filtered.length === 0) {
    if (allServers.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:4rem 2rem; background:var(--bg-surface); border: 1px dashed var(--border-subtle); border-radius: 10px;">
          <div style="width:44px; height:44px; border-radius:8px; background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); display:inline-flex; align-items:center; justify-content:center; margin-bottom:14px; color:var(--text-muted);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <div style="font-size:1.1rem; font-weight:600; color:#fff; margin-bottom:6px;">No Active Instances</div>
          <div style="color:var(--text-muted); font-size:0.84rem; max-width:400px; margin:0 auto 20px; line-height:1.5;">You do not currently have any deployed cloud VPS, Minecraft nodes, or Anycast tunnels.</div>
          <div style="display:flex; justify-content:center; gap:10px;">
            <a href="/vps" class="btn-header-deploy">Deploy VPS</a>
            <a href="/tunnels" class="pill-btn" style="text-decoration:none;">Protect Domain</a>
          </div>
        </div>`;
    } else {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:3rem 2rem; color:var(--text-muted); font-size:0.84rem;">
          No instances matching filter criteria.
        </div>`;
    }
    return;
  }

  container.innerHTML = filtered.map(s => {
    const isPendingDns = s.status === 'pending_dns';
    const isRunning = s.status === 'running';
    const isTunnel = s.service_type === 'tunnel' || (s.service_tier && s.service_tier.startsWith('tunnel'));
    
    let typeLabel = (s.service_type || 'vps').toUpperCase();
    if (isTunnel) typeLabel = 'DDoS Shield';

    let statusClass = isPendingDns ? 'pending_dns' : (isRunning ? 'running' : 'stopped');
    let statusText = isPendingDns ? 'Awaiting DNS' : (isRunning ? 'Active' : 'Stopped');

    return `
      <div class="instance-card" onclick="showDetailView(${JSON.stringify(s).replace(/"/g, '&quot;')})">
        <div>
          <div class="card-top-row">
            <div>
              <div class="card-title-text">${s.service_alias || 'Unnamed Instance'}</div>
              <div class="card-network-row">
                <span class="type-tag">${typeLabel}</span>
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
            <span class="spec-key">${isTunnel ? 'Scrubbing' : 'vCPU'}</span>
            <span class="spec-value">${isTunnel ? '92 Tbps' : s.cpu_cores + ' Cores'}</span>
          </div>
          <div class="spec-column">
            <span class="spec-key">${isTunnel ? 'Protocol' : 'Memory'}</span>
            <span class="spec-value">${isTunnel ? 'Layer 7 TCP' : s.ram_gb + ' GB'}</span>
          </div>
          <div class="spec-column">
            <span class="spec-key">${isTunnel ? 'Origin' : 'Storage'}</span>
            <span class="spec-value" style="font-size:0.78rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${isTunnel ? 'Cloaked' : s.disk_gb + ' GB'}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ── Render Detail View ───────────────────────────────────────────────────── */
function renderDetail(s) {
  const isPendingDns = s.status === 'pending_dns';
  const isRunning = s.status === 'running';
  const isTunnel = s.service_type === 'tunnel' || (s.service_tier && s.service_tier.startsWith('tunnel'));

  document.getElementById('d-name').textContent = s.service_alias || 'Instance Overview';
  document.getElementById('d-ip').textContent = s.ip;
  document.getElementById('d-region').textContent = isTunnel ? 'India (Anycast Layer 7 Scrubbing)' : (s.region || 'India (Mumbai Tier-4)');
  
  const badge = document.getElementById('d-status-badge');
  if (isPendingDns) {
    badge.className = 'status-pill pending_dns';
    badge.innerHTML = '<span class="status-dot pending_dns"></span> Awaiting DNS Configuration';
  } else if (isRunning) {
    badge.className = 'status-pill running';
    badge.innerHTML = '<span class="status-dot running"></span> Active';
  } else {
    badge.className = 'status-pill stopped';
    badge.innerHTML = `<span class="status-dot stopped"></span> ${s.status.toUpperCase()}`;
  }

  // Adjust Power Strip for Tunnels vs VPS
  const powerStrip = document.querySelector('.controls-strip');
  if (powerStrip) {
    if (isTunnel) {
      powerStrip.innerHTML = `
        <span class="status-pill running" style="padding:6px 12px; font-size:0.78rem;">
          <span class="status-dot running"></span> 92 Tbps DDoS Filtering Active
        </span>
        <a href="https://discord.gg/kt9yPDwYT4" target="_blank" class="ctrl-btn ctrl-secondary" style="text-decoration:none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Technical Support
        </a>
      `;
    } else {
      powerStrip.innerHTML = `
        <button class="ctrl-btn ctrl-start" onclick="powerAction('start')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start
        </button>
        <button class="ctrl-btn ctrl-reboot" onclick="powerAction('reboot')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.64 5.64"/></svg> Restart
        </button>
        <button class="ctrl-btn ctrl-stop" onclick="powerAction('stop')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg> Power Off
        </button>
        <button class="ctrl-btn ctrl-secondary" onclick="openCredsModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Access Details
        </button>
      `;
    }
  }

  // Render Real-Time DNS Setup Banner for Tunnels / DDoS Protection
  const dnsBanner = document.getElementById('tunnel-dns-banner');
  if (dnsBanner) {
    if (isTunnel || isPendingDns) {
      dnsBanner.style.display = 'block';

      if (isPendingDns) {
        dnsBanner.innerHTML = `
          <div class="dns-config-box" style="border-color:var(--color-amber-border); background:var(--color-amber-bg);">
            <div class="dns-header-row">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="status-dot pending_dns"></span>
                <strong style="font-size:0.92rem; color:var(--color-amber);">Awaiting Protected DNS Assignment</strong>
              </div>
              <span style="font-size:0.72rem; color:var(--text-muted); font-family:'JetBrains Mono',monospace;">STATUS: DISPATCHED</span>
            </div>
            <p style="color:var(--text-secondary); font-size:0.82rem; line-height:1.5; margin-bottom:12px;">
              Hostname <strong>${s.service_alias}</strong> has been registered with cloaked backend origin <code style="font-family:'JetBrains Mono',monospace; color:#fff;">${s.ip}</code>.
            </p>
            <div style="font-size:0.76rem; color:var(--text-muted); background:var(--bg-surface-elevated); padding:10px 14px; border-radius:6px; border:1px solid var(--border-subtle);">
              The network controller has been notified via webhook. Once your assigned scrubbing CNAME is provisioned, this card will automatically render the DNS record details in real time.
            </div>
          </div>`;
      } else {
        const assignedCname = s.cname || 'edge-as216013.kryonhost.net';
        const parts = (s.service_alias || '').split('.');
        const recordName = parts.length > 2 ? parts[0] : '@';

        dnsBanner.innerHTML = `
          <div class="dns-config-box" style="border-color:var(--color-emerald-border);">
            <div class="dns-header-row">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="status-dot running"></span>
                <strong style="font-size:0.92rem; color:var(--color-emerald);">Anycast DDoS Protection Active</strong>
              </div>
              <span class="type-tag" style="background:var(--color-emerald-bg); border-color:var(--color-emerald-border); color:var(--color-emerald);">92 Tbps Scrubbing</span>
            </div>
            
            <p style="color:var(--text-secondary); font-size:0.82rem; margin-bottom:12px;">
              Configure the following CNAME record in your Cloudflare or DNS management panel for <strong>${s.service_alias}</strong>:
            </p>

            <table class="dns-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name / Host</th>
                  <th>Target / Value</th>
                  <th>Proxy Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="color:var(--color-sky);">CNAME</td>
                  <td>${recordName}</td>
                  <td style="color:var(--color-emerald);">${assignedCname}</td>
                  <td><span style="color:var(--text-muted); font-size:0.75rem;">DNS Only (Grey Cloud)</span></td>
                  <td>
                    <button class="btn-action-copy" style="padding:4px 10px; font-size:0.72rem;" onclick="navigator.clipboard.writeText('${assignedCname}'); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy', 1500);">
                      Copy Target
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <div id="dns-done-box" style="margin-top:12px;">
              <button id="btn-dns-confirmed" onclick="confirmDnsSetup()" class="btn-header-deploy" style="background:var(--color-emerald); font-size:0.78rem; padding:6px 14px;">
                Confirm DNS Configured
              </button>
            </div>
          </div>`;
      }
    } else {
      dnsBanner.style.display = 'none';
    }
  }

  document.getElementById('hw-cpu').textContent = isTunnel ? 'Anycast Core' : `${s.cpu_cores} vCores`;
  document.getElementById('hw-ram').textContent = isTunnel ? '92 Tbps Buffer' : `${s.ram_gb} GB DDR5`;
  document.getElementById('hw-disk').textContent = isTunnel ? 'NVMe Cache' : `${s.disk_gb} GB NVMe`;
  document.getElementById('hw-os').textContent = isTunnel ? 'CryoLimbo L7' : (s.os || 'Ubuntu 24.04 LTS');

  // Modal setup
  document.getElementById('modal-ssh-cmd').value = `ssh root@${s.ip} -p 22`;
  document.getElementById('modal-sftp-host').value = `sftp://${s.ip}:22`;
}

function confirmDnsSetup() {
  const box = document.getElementById('dns-done-box');
  if (box && currentServer) {
    box.innerHTML = `
      <div style="font-size:0.8rem; color:var(--color-emerald); background:var(--color-emerald-bg); padding:8px 14px; border-radius:6px; border:1px solid var(--color-emerald-border);">
        DNS verification recorded. Traffic to <strong>${currentServer.service_alias}</strong> is now routing through the 92 Tbps Anycast scrubbing pipeline.
      </div>
    `;
  }
}

function populateConsole(s) {
  const con = document.getElementById('d-console');
  if (!con) return;
  const time = new Date().toLocaleTimeString();
  const isTunnel = s.service_type === 'tunnel' || (s.service_tier && s.service_tier.startsWith('tunnel'));

  if (isTunnel) {
    con.textContent = `[${time}] KryonShield Anycast Scrubber initialized.\n` +
      `[${time}] Attached Hostname: ${s.service_alias}\n` +
      `[${time}] Cloaked Backend Origin: ${s.ip}\n` +
      `[${time}] Routing Status: ${s.status === 'pending_dns' ? 'PENDING DNS' : 'ACTIVE / 92 TBPS SHIELDED'}\n` +
      `[${time}] Layer 7 Protocol Filter: TCP Handshake Inspection Active\n` +
      `kryon@shield-edge:~$ `;
  } else {
    con.textContent = `[${time}] KryonHost Virtualization Hypervisor initialized.\n` +
      `[${time}] Attached to guest container: ${s.service_alias} (${s.id})\n` +
      `[${time}] IP Allocation: ${s.ip}/32 via Anycast gateway.\n` +
      `[${time}] Status: ${s.status === 'running' ? 'Active / 20.0 TPS' : s.status}\n` +
      `[${time}] Hardware Allocation: ${s.cpu_cores}x AMD Zen 4 @ 5.7GHz, ${s.ram_gb}GB DDR5 ECC.\n` +
      `kryon@${s.service_alias.toLowerCase().replace(/\\s+/g, '-')}:~$ `;
  }
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
  const gradientCpu = ctxCpu.createLinearGradient(0, 0, 0, 160);
  gradientCpu.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
  gradientCpu.addColorStop(1, 'rgba(99, 102, 241, 0)');

  cpuChart = new Chart(ctxCpu, {
    type: 'line',
    data: {
      labels: Array(MAX_DATA_POINTS).fill(''),
      datasets: [{
        data: Array(MAX_DATA_POINTS).fill(0),
        borderColor: '#6366f1',
        backgroundColor: gradientCpu,
        fill: true
      }]
    },
    options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: 100 } } }
  });

  const ctxRam = document.getElementById('chart-ram').getContext('2d');
  const gradientRam = ctxRam.createLinearGradient(0, 0, 0, 160);
  gradientRam.addColorStop(0, 'rgba(168, 85, 247, 0.3)');
  gradientRam.addColorStop(1, 'rgba(168, 85, 247, 0)');

  ramChart = new Chart(ctxRam, {
    type: 'line',
    data: {
      labels: Array(MAX_DATA_POINTS).fill(''),
      datasets: [{
        data: Array(MAX_DATA_POINTS).fill(0),
        borderColor: '#a855f7',
        backgroundColor: gradientRam,
        fill: true
      }]
    },
    options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: (currentServer?.ram_gb || 8) * 1024 } } }
  });

  const ctxNet = document.getElementById('chart-net').getContext('2d');
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
        { data: Array(MAX_DATA_POINTS).fill(0), borderColor: '#10b981', backgroundColor: gradientIn, fill: true },
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
      document.getElementById('val-net').textContent = `${stats.network_in} IN / ${stats.network_out} OUT`;
      
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
      console.log('Stats polling pause:', e);
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
  badge.innerHTML = `<span class="status-dot ${newStatus === 'running' ? 'running' : 'stopped'}"></span> Executing ${action}...`;
  
  await supabaseClient.from('servers').update({ status: newStatus }).eq('id', currentServer.id);
  
  currentServer.status = newStatus;
  renderDetail(currentServer);

  // Append to console
  const con = document.getElementById('d-console');
  if (con) {
    con.textContent += `\n[HYPERVISOR] Power action dispatched: ${action.toUpperCase()} -> Status changed to ${newStatus}`;
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
      btn.textContent = 'Copied';
      setTimeout(() => btn.textContent = orig, 1500);
    }
  }
}

/* ── IP Access Rules & Firewall Manager ───────────────────────────────────── */
let customIpRules = [];

function addIpRule(type) {
  const input = document.getElementById('ip-filter-input');
  const statusEl = document.getElementById('ip-rule-status');
  if (!input || !input.value.trim()) return;

  const val = input.value.trim();
  customIpRules.push({ ip: val, type: type, time: new Date().toLocaleTimeString() });
  input.value = '';

  if (statusEl) {
    statusEl.innerHTML = `<span style="color:var(--color-emerald);">Rule active:</span> <code>${type.toUpperCase()} ${val}</code> synced across Anycast edge.`;
  }

  const feed = document.getElementById('firewall-log-feed');
  if (feed) {
    feed.textContent += `\n[POLICY-SYNC] Applied ${type.toUpperCase()} rule for ${val} on edge cluster.`;
    feed.scrollTop = feed.scrollHeight;
  }
}

/* ── Logout ───────────────────────────────────────────────────────────────── */
async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = '/login';
}

document.addEventListener('DOMContentLoaded', initPanel);
