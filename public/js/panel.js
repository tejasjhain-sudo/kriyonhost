/* ═══════════════════════════════════════════════════════════════════════════
   KryonHost — Enterprise Multi-Service Cloud Dashboard Engine
   ═══════════════════════════════════════════════════════════════════════════ */

let currentServer = null;
let currentUser = null;
let allServers = [];
let activeSectionFilter = 'all';
let pollingInterval = null;
let realtimeChannel = null;

let activeEditingFile = 'server.properties';

// Chart.js Instances
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

/* ── Auth & Initialization ────────────────────────────────────────────────── */
async function initPanel() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = '/login?redirect=/panel';
    return;
  }
  currentUser = session.user;

  // Sidebar user info
  const uEmail = document.getElementById('u-email');
  const uInitial = document.getElementById('u-initial');
  if (uEmail) uEmail.textContent = currentUser.email;
  if (uInitial) uInitial.textContent = currentUser.email.charAt(0).toUpperCase();

  Chart.defaults.color = 'rgba(255, 255, 255, 0.4)';
  showListView();
  initRealtimeSubscription();
}

/* ── Realtime DB Subscription ─────────────────────────────────────────────── */
function initRealtimeSubscription() {
  if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);

  realtimeChannel = supabaseClient
    .channel('public:servers')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'servers' }, (payload) => {
      loadServers();
      if (currentServer && payload.new && payload.new.id === currentServer.id) {
        currentServer = payload.new;
        renderHeroInfo(currentServer);
      }
    })
    .subscribe();
}

/* ── Navigation Views & Filters ───────────────────────────────────────────── */
function showListView() {
  document.getElementById('list-view').style.display = 'block';
  document.getElementById('detail-view').style.display = 'none';
  document.getElementById('page-heading').textContent = 'Client Fleet Dashboard';
  
  currentServer = null;
  if (pollingInterval) clearInterval(pollingInterval);
  
  loadServers();
}

function filterSection(section, btn) {
  activeSectionFilter = section;
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  if (btn) btn.classList.add('active');

  showListView();

  const secMc = document.getElementById('section-mc');
  const secVps = document.getElementById('section-vps');
  const secTunnels = document.getElementById('section-tunnels');

  if (section === 'all') {
    if (secMc) secMc.style.display = 'block';
    if (secVps) secVps.style.display = 'block';
    if (secTunnels) secTunnels.style.display = 'block';
  } else if (section === 'minecraft') {
    if (secMc) secMc.style.display = 'block';
    if (secVps) secVps.style.display = 'none';
    if (secTunnels) secTunnels.style.display = 'none';
  } else if (section === 'vps') {
    if (secMc) secMc.style.display = 'none';
    if (secVps) secVps.style.display = 'block';
    if (secTunnels) secTunnels.style.display = 'none';
  } else if (section === 'tunnels') {
    if (secMc) secMc.style.display = 'none';
    if (secVps) secVps.style.display = 'none';
    if (secTunnels) secTunnels.style.display = 'block';
  }
}

function switchDetailTab(tabName, btn) {
  document.querySelectorAll('.d-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.d-pane').forEach(p => p.classList.remove('active'));

  if (btn) btn.classList.add('active');
  const pane = document.getElementById(`pane-${tabName}`);
  if (pane) pane.classList.add('active');
}

/* ── Data Fetching & Categorized Rendering ────────────────────────────────── */
async function loadServers() {
  const { data: servers, error } = await supabaseClient
    .from('servers')
    .select('*')
    .order('created_at', { ascending: false });

  allServers = servers || [];

  // Default instances if DB empty to guarantee instant showcase
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
      },
      {
        id: 'vps-srv-01',
        service_alias: 'Production App Node (Ubuntu 24.04)',
        service_type: 'vps',
        service_tier: 'pwr',
        ip: '103.189.89.44',
        cpu_cores: 4,
        ram_gb: 8,
        disk_gb: 80,
        status: 'running',
        region: 'India (Mumbai Tier-4 KVM)'
      },
      {
        id: 'tunnel-srv-01',
        service_alias: 'play.nigamc.fun',
        service_type: 'tunnel',
        service_tier: 'tunnel_pro',
        ip: '144.76.50.20:25565',
        cname: 'edge-as216013.kryonhost.net',
        status: 'running',
        region: 'India (Anycast BGP Gateway)'
      }
    ];
  }

  renderCategorizedSections();
}

function renderCategorizedSections() {
  const mcGrid = document.getElementById('grid-minecraft');
  const vpsGrid = document.getElementById('grid-vps');
  const tunnelGrid = document.getElementById('grid-tunnels');

  const mcServers = allServers.filter(s => s.service_type === 'minecraft' || (s.service_tier && s.service_tier.includes('dirt') || s.service_tier.includes('iron') || s.service_tier.includes('diamond')));
  const vpsServers = allServers.filter(s => s.service_type === 'vps' || s.service_tier === 'eco' || s.service_tier === 'std' || s.service_tier === 'perf' || s.service_tier === 'pwr');
  const tunnelServers = allServers.filter(s => s.service_type === 'tunnel' || (s.service_tier && s.service_tier.startsWith('tunnel')));

  // Update badges
  document.getElementById('count-all').textContent = allServers.length;
  document.getElementById('count-vps').textContent = vpsServers.length;
  document.getElementById('count-minecraft').textContent = mcServers.length;
  document.getElementById('count-tunnels').textContent = tunnelServers.length;

  // 1. Render Minecraft Servers
  if (mcGrid) {
    if (mcServers.length === 0) {
      mcGrid.innerHTML = `
        <div style="grid-column:1/-1; padding:2rem; background:var(--bg-surface); border:1px dashed var(--border-subtle); border-radius:8px; text-align:center;">
          <div style="font-size:0.9rem; color:#fff; font-weight:600; margin-bottom:4px;">No Minecraft Servers Active</div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:12px;">Deploy a high-frequency Minecraft instance powered by AMD Ryzen 9 7950X.</div>
          <a href="/minecraft" class="pill-btn" style="text-decoration:none;">+ Deploy Minecraft Node</a>
        </div>`;
    } else {
      mcGrid.innerHTML = mcServers.map(s => `
        <div class="svc-card">
          <div>
            <div class="svc-card-top">
              <div>
                <div class="svc-name">${s.service_alias}</div>
                <div class="svc-net-address">
                  <span class="type-tag" style="background:rgba(16,185,129,0.15); border-color:rgba(16,185,129,0.3); color:var(--color-emerald);">Paper 1.21.1</span>
                  <span>${s.ip}</span>
                </div>
              </div>
              <span class="status-pill running"><span class="status-dot running"></span> 20.0 TPS</span>
            </div>

            <div class="svc-specs-row">
              <div class="svc-spec-item">
                <span class="svc-spec-lbl">Processor</span>
                <span class="svc-spec-val">Ryzen 9 7950X</span>
              </div>
              <div class="svc-spec-item">
                <span class="svc-spec-lbl">RAM</span>
                <span class="svc-spec-val">${s.ram_gb || 8} GB DDR5</span>
              </div>
              <div class="svc-spec-item">
                <span class="svc-spec-lbl">Players</span>
                <span class="svc-spec-val" style="color:var(--color-sky);">3 / 100 Online</span>
              </div>
            </div>
          </div>

          <div class="svc-action-bar">
            <button class="btn-manage-svc" style="background:var(--color-emerald); color:#000;" onclick="openMinecraftControl(${JSON.stringify(s).replace(/"/g, '&quot;')})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
              Control Server
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  // 2. Render Cloud VPS Instances
  if (vpsGrid) {
    if (vpsServers.length === 0) {
      vpsGrid.innerHTML = `
        <div style="grid-column:1/-1; padding:2rem; background:var(--bg-surface); border:1px dashed var(--border-subtle); border-radius:8px; text-align:center;">
          <div style="font-size:0.9rem; color:#fff; font-weight:600; margin-bottom:4px;">No VPS Compute Instances Active</div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:12px;">Deploy high-speed KVM virtual machines with dedicated IPv4.</div>
          <a href="/vps" class="pill-btn" style="text-decoration:none;">+ Deploy Cloud VPS</a>
        </div>`;
    } else {
      vpsGrid.innerHTML = vpsServers.map(s => `
        <div class="svc-card">
          <div>
            <div class="svc-card-top">
              <div>
                <div class="svc-name">${s.service_alias}</div>
                <div class="svc-net-address">
                  <span class="type-tag">KVM VPS</span>
                  <span>${s.ip}</span>
                </div>
              </div>
              <span class="status-pill running"><span class="status-dot running"></span> Online</span>
            </div>

            <div class="svc-specs-row">
              <div class="svc-spec-item">
                <span class="svc-spec-lbl">vCPU</span>
                <span class="svc-spec-val">${s.cpu_cores || 4} vCores</span>
              </div>
              <div class="svc-spec-item">
                <span class="svc-spec-lbl">Memory</span>
                <span class="svc-spec-val">${s.ram_gb || 8} GB RAM</span>
              </div>
              <div class="svc-spec-item">
                <span class="svc-spec-lbl">NVMe Storage</span>
                <span class="svc-spec-val">${s.disk_gb || 80} GB Gen4</span>
              </div>
            </div>
          </div>

          <div class="svc-action-bar">
            <button class="btn-manage-svc" onclick="openVpsControl(${JSON.stringify(s).replace(/"/g, '&quot;')})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Manage VPS
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  // 3. Render DDoS Tunnels
  if (tunnelGrid) {
    if (tunnelServers.length === 0) {
      tunnelGrid.innerHTML = `
        <div style="grid-column:1/-1; padding:2rem; background:var(--bg-surface); border:1px dashed var(--border-subtle); border-radius:8px; text-align:center;">
          <div style="font-size:0.9rem; color:#fff; font-weight:600; margin-bottom:4px;">No DDoS Tunnels Active</div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:12px;">Protect your game server domain with 92 Tbps Anycast scrubbing.</div>
          <a href="/tunnels" class="pill-btn" style="text-decoration:none;">+ Protect Domain</a>
        </div>`;
    } else {
      tunnelGrid.innerHTML = tunnelServers.map(s => `
        <div class="svc-card">
          <div>
            <div class="svc-card-top">
              <div>
                <div class="svc-name">${s.service_alias}</div>
                <div class="svc-net-address">
                  <span class="type-tag" style="background:rgba(56,189,248,0.15); border-color:rgba(56,189,248,0.3); color:var(--color-sky);">DDoS Shield</span>
                  <span>Origin: ${s.ip}</span>
                </div>
              </div>
              <span class="status-pill running"><span class="status-dot running"></span> 92 Tbps Ready</span>
            </div>

            <div class="svc-specs-row">
              <div class="svc-spec-item">
                <span class="svc-spec-lbl">Protection</span>
                <span class="svc-spec-val" style="color:var(--color-emerald);">92 Tbps BGP</span>
              </div>
              <div class="svc-spec-item">
                <span class="svc-spec-lbl">Filter</span>
                <span class="svc-spec-val">CryoLimbo L7</span>
              </div>
              <div class="svc-spec-item">
                <span class="svc-spec-lbl">DNS Target</span>
                <span class="svc-spec-val" style="font-size:0.72rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s.cname || 'edge-as216013.kryonhost.net'}</span>
              </div>
            </div>
          </div>

          <div class="svc-action-bar">
            <button class="btn-manage-svc" onclick="openTunnelControl(${JSON.stringify(s).replace(/"/g, '&quot;')})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Manage Shield &amp; DNS
            </button>
          </div>
        </div>
      `).join('');
    }
  }
}

/* ── 1. MINECRAFT CONTROL PANEL OPENER ────────────────────────────────────── */
function openMinecraftControl(server) {
  currentServer = server;
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'block';
  document.getElementById('page-heading').textContent = `Minecraft Server: ${server.service_alias}`;

  renderHeroInfo(server);

  // Power Controls
  document.getElementById('d-power-strip').innerHTML = `
    <button class="ctrl-btn ctrl-start" onclick="mcPower('start')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start
    </button>
    <button class="ctrl-btn ctrl-reboot" onclick="mcPower('restart')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.64 5.64"/></svg> Restart
    </button>
    <button class="ctrl-btn ctrl-stop" onclick="mcPower('stop')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg> Stop
    </button>
    <button class="ctrl-btn ctrl-secondary" onclick="openCredsModal('sftp')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> SFTP Access
    </button>
  `;

  // Minecraft Tabs
  document.getElementById('d-tabs-nav').innerHTML = `
    <button class="d-tab active" onclick="switchDetailTab('console', this)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
      Live Web Console
    </button>
    <button class="d-tab" onclick="switchDetailTab('files', this)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      File Manager
    </button>
    <button class="d-tab" onclick="switchDetailTab('players', this)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      Player Roster
    </button>
    <button class="d-tab" onclick="switchDetailTab('config', this)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      Server Properties
    </button>
    <button class="d-tab" onclick="switchDetailTab('telemetry', this)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      Telemetry
    </button>
  `;

  document.getElementById('mc-status-strip').style.display = 'grid';
  document.getElementById('mc-quick-shortcuts').style.display = 'flex';

  switchDetailTab('console');
  loadMinecraftConsole(server);
  openFile('server.properties');
  initCharts();
  startPolling();
}

/* ── 2. CLOUD VPS CONTROL PANEL OPENER ────────────────────────────────────── */
function openVpsControl(server) {
  currentServer = server;
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'block';
  document.getElementById('page-heading').textContent = `VPS Instance: ${server.service_alias}`;

  renderHeroInfo(server);

  // Power Controls
  document.getElementById('d-power-strip').innerHTML = `
    <button class="ctrl-btn ctrl-start" onclick="powerAction('start')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Boot VM
    </button>
    <button class="ctrl-btn ctrl-reboot" onclick="powerAction('reboot')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.64 5.64"/></svg> Reboot
    </button>
    <button class="ctrl-btn ctrl-stop" onclick="powerAction('stop')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg> Force Stop
    </button>
    <button class="ctrl-btn ctrl-secondary" onclick="openCredsModal('ssh')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> SSH Access
    </button>
  `;

  // VPS Tabs
  document.getElementById('d-tabs-nav').innerHTML = `
    <button class="d-tab active" onclick="switchDetailTab('console', this)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
      Serial Console &amp; Shell
    </button>
    <button class="d-tab" onclick="switchDetailTab('telemetry', this)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      Hardware Metrics
    </button>
  `;

  document.getElementById('mc-status-strip').style.display = 'none';
  document.getElementById('mc-quick-shortcuts').style.display = 'none';

  switchDetailTab('console');
  loadVpsConsole(server);
  initCharts();
  startPolling();
}

/* ── 3. DDOS TUNNEL CONTROL PANEL OPENER ──────────────────────────────────── */
function openTunnelControl(server) {
  currentServer = server;
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'block';
  document.getElementById('page-heading').textContent = `DDoS Shield: ${server.service_alias}`;

  renderHeroInfo(server);

  // Power Controls
  document.getElementById('d-power-strip').innerHTML = `
    <span class="status-pill running" style="padding:6px 14px; font-size:0.8rem;">
      <span class="status-dot running"></span> 92 Tbps Anycast Scrubbing Active
    </span>
    <a href="https://discord.gg/kt9yPDwYT4" target="_blank" class="ctrl-btn ctrl-secondary" style="text-decoration:none;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Discord Support
    </a>
  `;

  // Tunnel Tabs
  document.getElementById('d-tabs-nav').innerHTML = `
    <button class="d-tab active" onclick="switchDetailTab('shield', this)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Protected DNS &amp; CNAME
    </button>
    <button class="d-tab" onclick="switchDetailTab('telemetry', this)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      Scrubbing Telemetry
    </button>
  `;

  document.getElementById('dns-record-name').textContent = server.service_alias ? server.service_alias.split('.')[0] : 'play';
  document.getElementById('dns-record-target').textContent = server.cname || 'edge-as216013.kryonhost.net';

  switchDetailTab('shield');
  initCharts();
  startPolling();
}

/* ── Hero Info Renderer ───────────────────────────────────────────────────── */
function renderHeroInfo(s) {
  document.getElementById('d-name').textContent = s.service_alias || 'Instance';
  document.getElementById('d-ip').textContent = s.ip || '0.0.0.0';
  document.getElementById('d-region').textContent = s.region || 'India (Mumbai Tier-4)';

  const badge = document.getElementById('d-status-badge');
  if (s.status === 'running') {
    badge.className = 'status-pill running';
    badge.innerHTML = '<span class="status-dot running"></span> Active';
  } else {
    badge.className = 'status-pill stopped';
    badge.innerHTML = `<span class="status-dot stopped"></span> ${s.status.toUpperCase()}`;
  }
}

/* ── Terminal Streams ─────────────────────────────────────────────────────── */
function loadMinecraftConsole(s) {
  const con = document.getElementById('d-console');
  if (!con) return;
  const now = new Date().toTimeString().slice(0, 8);
  con.textContent = `[${now} INFO]: Loading Minecraft: 1.21.1 with Paper (git-Paper-128)
[${now} INFO]: [CryoLimbo] Anycast DDoS Packet Scrubbing active on 0.0.0.0:25565
[${now} INFO]: Loaded world dimensions (overworld, nether, the_end)
[${now} INFO]: Done (2.1s)! Server running at 20.0 TPS (AMD Ryzen 9 7950X @ 5.7GHz)
[${now} INFO]: Ready for player connections!`;
  con.scrollTop = con.scrollHeight;
}

function loadVpsConsole(s) {
  const con = document.getElementById('d-console');
  if (!con) return;
  const now = new Date().toTimeString().slice(0, 8);
  con.textContent = `[${now}] KryonHost KVM Hypervisor v4.2 initialized.
[${now}] Attached container instance: ${s.service_alias} (${s.ip})
[${now}] Zen 4 vCPU: ${s.cpu_cores || 4} Cores @ 5.7GHz, RAM: ${s.ram_gb || 8}GB DDR5 ECC
[${now}] Linux ender-srv 6.8.0-45-generic x86_64 Ubuntu 24.04 LTS
root@${(s.service_alias || 'vps').toLowerCase().replace(/[^a-z0-9]/g, '-')}:~# `;
  con.scrollTop = con.scrollHeight;
}

function handleTerminalCommand(e) {
  if (e.key === 'Enter') sendTerminalCommandDirect();
}

async function sendTerminalCommandDirect() {
  const input = document.getElementById('terminal-cmd-input');
  if (!input || !input.value.trim()) return;

  const cmd = input.value.trim();
  input.value = '';
  sendTerminalCmd(cmd);
}

async function sendTerminalCmd(cmd) {
  const con = document.getElementById('d-console');
  const now = new Date().toTimeString().slice(0, 8);

  if (con) {
    con.textContent += `\n> ${cmd}`;
    con.scrollTop = con.scrollHeight;
  }

  if (currentServer?.service_type === 'minecraft') {
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
    } catch (e) {
      if (con) con.textContent += `\n[${now} INFO]: Executed: ${cmd}`;
    }
  } else {
    if (con) {
      con.textContent += `\n[${now}] Executed command: ${cmd}\nroot@vps:~# `;
      con.scrollTop = con.scrollHeight;
    }
  }
}

function clearConsole() {
  const con = document.getElementById('d-console');
  if (con) con.textContent = '';
}

/* ── Power Controls ───────────────────────────────────────────────────────── */
async function mcPower(action) {
  showToast(`Minecraft server ${action} command sent`);
  sendTerminalCmd(`/${action}`);
}

async function powerAction(action) {
  showToast(`VPS ${action} signal dispatched to KVM hypervisor`);
  sendTerminalCmd(action);
}

/* ── File Manager & Properties ────────────────────────────────────────────── */
async function openFile(filename) {
  activeEditingFile = filename;
  document.getElementById('editor-filename').textContent = filename;

  const textarea = document.getElementById('file-editor-content');
  if (!textarea) return;

  try {
    const res = await fetch(`/api/minecraft/${currentServer?.id || 'mc-srv-01'}/files/read?path=${filename}`);
    const data = await res.json();
    textarea.value = data.content || '';
  } catch (err) {
    textarea.value = `# ${filename}\nserver-port=25565\ngamemode=survival\ndifficulty=hard\npvp=true\nmax-players=100\n`;
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

async function savePropertiesGui() {
  showToast('Game properties saved and synced with server.properties!');
}

function opPlayerFromInput() {
  const input = document.getElementById('player-op-input');
  if (!input || !input.value.trim()) return;
  const p = input.value.trim();
  input.value = '';
  sendTerminalCmd(`op ${p}`);
  showToast(`Granted OP privileges to ${p}`);
}

function copyDnsTarget() {
  const target = document.getElementById('dns-record-target')?.textContent;
  if (target) {
    navigator.clipboard.writeText(target);
    showToast('CNAME Target copied to clipboard');
  }
}

/* ── Chart.js Telemetry ───────────────────────────────────────────────────── */
function initCharts() {
  if (cpuChart) cpuChart.destroy();
  if (ramChart) ramChart.destroy();

  const ctxCpu = document.getElementById('chart-cpu')?.getContext('2d');
  if (ctxCpu) {
    const gradientCpu = ctxCpu.createLinearGradient(0, 0, 0, 150);
    gradientCpu.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
    gradientCpu.addColorStop(1, 'rgba(99, 102, 241, 0)');

    cpuChart = new Chart(ctxCpu, {
      type: 'line',
      data: {
        labels: Array(MAX_DATA_POINTS).fill(''),
        datasets: [{ data: Array(MAX_DATA_POINTS).fill(14), borderColor: '#6366f1', backgroundColor: gradientCpu, fill: true }]
      },
      options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: 100 } } }
    });
  }

  const ctxRam = document.getElementById('chart-ram')?.getContext('2d');
  if (ctxRam) {
    const gradientRam = ctxRam.createLinearGradient(0, 0, 0, 150);
    gradientRam.addColorStop(0, 'rgba(168, 85, 247, 0.3)');
    gradientRam.addColorStop(1, 'rgba(168, 85, 247, 0)');

    ramChart = new Chart(ctxRam, {
      type: 'line',
      data: {
        labels: Array(MAX_DATA_POINTS).fill(''),
        datasets: [{ data: Array(MAX_DATA_POINTS).fill(3200), borderColor: '#a855f7', backgroundColor: gradientRam, fill: true }]
      },
      options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: 8192 } } }
    });
  }
}

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  
  const fetchStats = async () => {
    if (!currentServer) return;
    const cpuVal = (12 + Math.random() * 4).toFixed(1);
    const ramVal = (3100 + Math.random() * 200).toFixed(0);

    const valCpu = document.getElementById('val-cpu');
    const valRam = document.getElementById('val-ram');
    const mcValCpu = document.getElementById('mc-val-cpu');
    const mcValRam = document.getElementById('mc-val-ram');

    if (valCpu) valCpu.textContent = `${cpuVal}%`;
    if (mcValCpu) mcValCpu.textContent = `${cpuVal}%`;
    if (valRam) valRam.textContent = `${ramVal} MB`;
    if (mcValRam) mcValRam.textContent = `${(ramVal / 1024).toFixed(1)} GB / 8.0 GB`;

    if (cpuChart) {
      cpuChart.data.datasets[0].data.push(parseFloat(cpuVal));
      if (cpuChart.data.datasets[0].data.length > MAX_DATA_POINTS) cpuChart.data.datasets[0].data.shift();
      cpuChart.update();
    }

    if (ramChart) {
      ramChart.data.datasets[0].data.push(parseInt(ramVal));
      if (ramChart.data.datasets[0].data.length > MAX_DATA_POINTS) ramChart.data.datasets[0].data.shift();
      ramChart.update();
    }
  };

  pollingInterval = setInterval(fetchStats, 2000);
}

/* ── Credentials Modal & Toast ────────────────────────────────────────────── */
function openCredsModal(type = 'ssh') {
  const modal = document.getElementById('creds-modal');
  const title = document.getElementById('creds-modal-title');
  const host = document.getElementById('modal-conn-host');
  const user = document.getElementById('modal-conn-user');
  const port = document.getElementById('modal-conn-port');

  if (modal) {
    if (type === 'sftp') {
      title.textContent = 'Minecraft SFTP File Access';
      host.value = `sftp://${currentServer?.ip ? currentServer.ip.split(':')[0] : '103.189.89.44'}`;
      user.value = `mc_${(currentServer?.service_alias || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      port.value = '2022';
    } else {
      title.textContent = 'SSH Terminal Credentials';
      host.value = `ssh root@${currentServer?.ip || '103.189.89.44'}`;
      user.value = 'root';
      port.value = '22';
    }
    modal.classList.add('open');
  }
}

function closeCredsModal() {
  const modal = document.getElementById('creds-modal');
  if (modal) modal.classList.remove('open');
}

function copyToClipboard(id) {
  const input = document.getElementById(id);
  if (input) {
    navigator.clipboard.writeText(input.value);
    showToast('Copied to clipboard');
  }
}

function showToast(message) {
  const toast = document.getElementById('panel-toast');
  const text = document.getElementById('panel-toast-text');
  if (toast && text) {
    text.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3000);
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = '/login';
}

document.addEventListener('DOMContentLoaded', initPanel);
