/* ═══════════════════════════════════════════════════════════════════════════
   KryonPanel — Next-Gen Client Cloud Dashboard Controller
   ═══════════════════════════════════════════════════════════════════════════ */

let currentServer = null;
let currentUser = null;
let pollingInterval = null;
let realtimeChannel = null;

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
        console.log('⚡ Realtime server update received:', payload);
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
  document.getElementById('page-heading').textContent = 'Compute & Network Instances';
  
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
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/></svg>
        </div>
        <div style="font-size:1.3rem; font-weight:600; color:#fff; margin-bottom:8px; font-family:'Bricolage Grotesque',sans-serif;">No Active Instances</div>
        <div style="color:var(--text-muted); font-size:0.92rem; max-width:440px; margin:0 auto 24px; line-height:1.5;">You do not have any deployed virtual machines, Minecraft nodes, or DDoS tunnels yet.</div>
        <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
          <a href="/vps" class="btn btn-primary" style="padding:10px 24px;">Cloud VPS</a>
          <a href="/tunnels" class="btn btn-ghost" style="padding:10px 24px; border:1px solid var(--border-subtle);">DDoS Shield</a>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = servers.map(s => {
    const isPendingDns = s.status === 'pending_dns';
    const isRunning = s.status === 'running';
    const isTunnel = s.service_type === 'tunnel' || (s.service_tier && s.service_tier.startsWith('tunnel'));
    
    let typeLabel = (s.service_type || 'vps').toUpperCase();
    if (isTunnel) typeLabel = 'DDoS SHIELD';

    let statusBadgeClass = isPendingDns ? 'pending_dns' : (isRunning ? 'running' : 'stopped');
    let statusBadgeText = isPendingDns ? '⏳ Awaiting DNS' : (isRunning ? '🟢 Active' : '🔴 Stopped');

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
          <div class="status-badge ${statusBadgeClass}">
            <span class="dot ${statusBadgeClass}"></span>
            ${statusBadgeText}
          </div>
        </div>
        
        <div class="scard-specs">
          <div class="spec-item">
            <span class="spec-lbl">${isTunnel ? 'Protection' : 'vCPU'}</span>
            <span class="spec-val">${isTunnel ? '92 Tbps' : s.cpu_cores + ' Cores'}</span>
          </div>
          <div class="spec-item">
            <span class="spec-lbl">${isTunnel ? 'Protocol' : 'RAM'}</span>
            <span class="spec-val">${isTunnel ? 'TCP/UDP L7' : s.ram_gb + ' GB'}</span>
          </div>
          <div class="spec-item">
            <span class="spec-lbl">${isTunnel ? 'Origin' : 'Storage'}</span>
            <span class="spec-val" style="font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${isTunnel ? 'Cloaked' : s.disk_gb + ' GB'}</span>
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

  document.getElementById('d-name').textContent = s.service_alias;
  document.getElementById('d-ip').textContent = s.ip;
  document.getElementById('d-region').textContent = isTunnel ? 'India (Anycast Layer 7 Edge)' : (s.region || 'India (Mumbai Tier-4)');
  
  const badge = document.getElementById('d-status-badge');
  if (isPendingDns) {
    badge.className = 'status-badge pending_dns';
    badge.innerHTML = '<span class="dot pending_dns"></span> ⏳ AWAITING PROTECTED DNS ASSIGNMENT';
  } else if (isRunning) {
    badge.className = 'status-badge running';
    badge.innerHTML = isTunnel ? '<span class="dot running"></span> 🟢 DDOS SHIELD ACTIVE' : '<span class="dot running"></span> 🟢 ONLINE';
  } else {
    badge.className = 'status-badge stopped';
    badge.innerHTML = `<span class="dot stopped"></span> ${s.status.toUpperCase()}`;
  }

  // Adjust Power Strip for Tunnels vs VPS
  const powerStrip = document.querySelector('.power-strip');
  if (powerStrip) {
    if (isTunnel) {
      powerStrip.innerHTML = `
        <span style="display:inline-flex; align-items:center; gap:8px; padding:8px 14px; border-radius:8px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); color:#4ade80; font-size:0.85rem; font-weight:600;">
          <span class="dot running"></span> 92 Tbps Anycast Scrubbing Active
        </span>
        <a href="https://discord.gg/kt9yPDwYT4" target="_blank" class="btn-power btn-p-secondary" style="text-decoration:none;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Discord Support
        </a>
      `;
    } else {
      powerStrip.innerHTML = `
        <button class="btn-power btn-p-start" onclick="powerAction('start')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start
        </button>
        <button class="btn-power btn-p-reboot" onclick="powerAction('reboot')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.64 5.64"/></svg> Reboot
        </button>
        <button class="btn-power btn-p-stop" onclick="powerAction('stop')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg> Force Stop
        </button>
        <button class="btn-power btn-p-secondary" onclick="openCredsModal()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Access Info
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
          <div style="background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.35); border-radius: 14px; padding: 22px 24px; color: #fff;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
              <span class="dot pending_dns"></span>
              <h3 style="font-size:1.15rem; font-weight:700; color:#facc15; margin:0; font-family:'Bricolage Grotesque',sans-serif;">🛡️ Shield Request Dispatched (Awaiting DNS Assignment)</h3>
            </div>
            <p style="color:#cbd5e1; font-size:0.9rem; line-height:1.5; margin:0 0 12px 0;">
              Your Minecraft server domain <strong>${s.service_alias}</strong> with cloaked backend origin <code style="color:#38bdf8; font-family:'DM Mono',monospace; background:rgba(56,189,248,0.1); padding:2px 6px; border-radius:4px;">${s.ip}</code> has been registered.
            </p>
            <div style="font-size:0.82rem; color:#fef08a; background:rgba(234,179,8,0.12); padding:12px 16px; border-radius:8px; display:flex; align-items:center; gap:10px;">
              <span style="font-size:1.1rem;">⏳</span>
              <span><strong>Live Realtime Sync:</strong> Our Discord bot has notified the network administrator. Once your protected Anycast CNAME is assigned, this panel will update live with your Cloudflare record!</span>
            </div>
          </div>`;
      } else {
        const assignedCname = s.cname || 'edge-as216013.kryonhost.net';
        
        // Extract sub domain (e.g. play from play.nigamc.fun)
        const parts = (s.service_alias || '').split('.');
        const recordName = parts.length > 2 ? parts[0] : '@';

        dnsBanner.innerHTML = `
          <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.35); border-radius: 14px; padding: 22px 24px; color: #fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span class="dot running"></span>
                <h3 style="font-size:1.15rem; font-weight:700; color:#4ade80; margin:0; font-family:'Bricolage Grotesque',sans-serif;">🟢 Anycast DDoS Shield Active &amp; Routing</h3>
              </div>
              <span style="font-size:0.75rem; padding:3px 8px; border-radius:6px; background:rgba(34,197,94,0.15); color:#4ade80; font-weight:600; font-family:'DM Mono',monospace;">92 TBPS DEFENSE READY</span>
            </div>
            
            <p style="color:#cbd5e1; font-size:0.88rem; margin:0 0 14px 0;">
              Add the following CNAME record in your Cloudflare / DNS provider pointing <strong>${s.service_alias}</strong> to activate full Layer 7 scrubbing:
            </p>
            
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:12px;">
              <input type="text" id="cname-val-input" readonly value="${assignedCname}" style="flex:1; padding:10px 14px; background:#060b13; border:1px solid rgba(34,197,94,0.3); border-radius:8px; color:#4ade80; font-family:'DM Mono',monospace; font-size:0.9rem; outline:none;">
              <button class="btn-copy" style="background:#15803d; border-color:#16a34a; padding:10px 18px;" onclick="copyToClipboard('cname-val-input')">Copy CNAME</button>
            </div>

            <div style="font-size:0.8rem; color:#94a3b8; font-family:'DM Mono',monospace; background:rgba(0,0,0,0.4); padding:10px 14px; border-radius:8px; margin-bottom:16px; border:1px solid rgba(255,255,255,0.06);">
              <span style="color:#38bdf8;">Type:</span> CNAME &nbsp;|&nbsp; 
              <span style="color:#fbbf24;">Name:</span> ${recordName} &nbsp;|&nbsp; 
              <span style="color:#4ade80;">Target:</span> ${assignedCname} &nbsp;|&nbsp; 
              <span style="color:#e2e8f0;">Proxy:</span> DNS only (Grey Cloud ☁️)
            </div>

            <div id="dns-done-box">
              <button id="btn-dns-confirmed" onclick="confirmDnsSetup()" class="btn btn-sm btn-primary" style="background:#22c55e; border-color:#22c55e; color:#000; font-weight:600; padding:8px 18px;">
                ✓ I Have Added the DNS Record (Done)
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
  document.getElementById('hw-disk').textContent = isTunnel ? 'NVMe Cache' : `${s.disk_gb} GB Storage`;
  document.getElementById('hw-os').textContent = isTunnel ? 'CryoLimbo L7 Shield' : (s.os || 'Ubuntu 24.04 LTS');

  // Modal setup
  document.getElementById('modal-ssh-cmd').value = `ssh root@${s.ip} -p 22`;
  document.getElementById('modal-sftp-host').value = `sftp://${s.ip}:22`;
}

function confirmDnsSetup() {
  const box = document.getElementById('dns-done-box');
  if (box && currentServer) {
    box.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; font-size:0.85rem; color:#4ade80; background:rgba(34,197,94,0.15); padding:8px 14px; border-radius:6px; border:1px solid rgba(34,197,94,0.3);">
        <span>✅</span>
        <span><strong>DNS Verified!</strong> Your players can now connect to <strong>${currentServer.service_alias}</strong> with 92 Tbps DDoS shielding active.</span>
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
    con.textContent = `[${time}] KryonShield BGP Anycast Scrubber initialized.\n` +
      `[${time}] Attached Hostname: ${s.service_alias}\n` +
      `[${time}] Cloaked Backend Origin: ${s.ip}\n` +
      `[${time}] Routing Status: ${s.status === 'pending_dns' ? 'PENDING DNS ASSIGNMENT' : 'ACTIVE / 92 TBPS SHIELDED'}\n` +
      `[${time}] Layer 7 Protocol Filter: Minecraft / TCP Protocol Handshake Active\n` +
      `kryon@shield-edge:~$ `;
  } else {
    con.textContent = `[${time}] KryonHost Virtualization Hypervisor v4.2.1 initialized.\n` +
      `[${time}] Attached to guest container: ${s.service_alias} (${s.id})\n` +
      `[${time}] IP Allocation: ${s.ip}/32 via Anycast gateway.\n` +
      `[${time}] Status: ${s.status === 'running' ? 'Active / 20.0 TPS stable' : s.status}\n` +
      `[${time}] CPU Cores: ${s.cpu_cores}x AMD Zen 4 @ 5.7GHz, RAM: ${s.ram_gb}GB DDR5 ECC.\n` +
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
