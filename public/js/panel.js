/* ═══════════════════════════════════════════════════════════════════════════
   KryonPanel — Client Panel (Supabase-Powered)
   Reads the logged-in user's servers from Supabase `servers` table.
   ═══════════════════════════════════════════════════════════════════════════ */

let currentServer = null;
let currentUser = null;

/* ── Auth Guard ───────────────────────────────────────────────────────────── */
async function initPanel() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = '/login';
    return;
  }
  currentUser = session.user;

  // Show user email in sidebar
  const el = document.getElementById('u-email');
  if (el) el.textContent = currentUser.email;

  showListView();
}

/* ── Views ────────────────────────────────────────────────────────────────── */
function showListView() {
  document.getElementById('list-view').style.display = 'block';
  document.getElementById('detail-view').style.display = 'none';
  currentServer = null;
  loadServers();
}

function showDetailView(server) {
  currentServer = server;
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'block';
  renderDetail(server);
}

/* ── Load Servers From Supabase ───────────────────────────────────────────── */
async function loadServers() {
  const container = document.getElementById('servers-container');
  container.innerHTML = `<div style="color:var(--muted); font-size:0.9rem;">Loading your services...</div>`;

  const { data: servers, error } = await supabaseClient
    .from('servers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div style="color:#ef4444;">Error loading servers: ${error.message}</div>`;
    return;
  }

  if (!servers || servers.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:5rem 0;">
        <div style="font-size:3rem; margin-bottom:1rem;">🖥️</div>
        <div style="font-size:1.1rem; color:#fff; margin-bottom:8px;">No Active Servers</div>
        <div style="color:var(--muted); font-size:0.9rem; margin-bottom:1.5rem;">You don't have any deployed servers yet. Order one via Discord!</div>
        <a href="https://discord.gg/kryonhost" target="_blank" class="btn btn-primary">Order via Discord</a>
      </div>`;
    return;
  }

  container.innerHTML = servers.map(s => {
    const running = s.status === 'running';
    const created = new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const typeColor = { vps:'#7c6aff', minecraft:'#22c55e', tunnel:'#38bdf8', dedicated:'#f59e0b' }[s.service_type || 'vps'] || '#7c6aff';

    return `
      <div class="server-card" onclick="showDetailView(${JSON.stringify(s).replace(/"/g, '&quot;')})">
        <div class="server-status-indicator ${running ? 'status-running' : 'status-stopped'}"></div>
        <div style="padding-left:12px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <div class="server-name">${s.service_alias}</div>
            <span style="font-size:0.6rem; padding:2px 8px; border-radius:20px; background:${typeColor}22; color:${typeColor}; font-weight:600; text-transform:uppercase;">${s.service_type || 'VPS'}</span>
          </div>
          <div class="server-ip">${s.ip}</div>
          <div class="server-specs">
            <span>${s.cpu_cores} vCPU</span>
            <span style="color:rgba(255,255,255,0.2);">|</span>
            <span>${s.ram_gb} GB RAM</span>
            <span style="color:rgba(255,255,255,0.2);">|</span>
            <span>${s.disk_gb} GB NVMe</span>
          </div>
          <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
            ${running
              ? `<span style="font-size:0.75rem; color:#22c55e; display:flex; align-items:center; gap:5px;">
                   <span style="width:6px;height:6px;background:#22c55e;border-radius:50%;box-shadow:0 0 6px #22c55e;display:inline-block;animation:pulse 2s infinite;"></span>Online
                 </span>`
              : `<span style="font-size:0.75rem; color:#ef4444; display:flex; align-items:center; gap:5px;">
                   <span style="width:6px;height:6px;background:#ef4444;border-radius:50%;display:inline-block;"></span>Stopped
                 </span>`
            }
            <span style="font-size:0.72rem; color:var(--muted); font-family:'DM Mono',monospace;">Since ${created}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ── Render Server Detail ─────────────────────────────────────────────────── */
function renderDetail(s) {
  const running = s.status === 'running';
  const created = new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  document.getElementById('d-name').textContent = s.service_alias;
  document.getElementById('d-ip').textContent = `${s.ip} · ${s.region || 'India (Mumbai)'}`;
  document.getElementById('d-os').textContent = s.os || 'Ubuntu 24.04 LTS';
  document.getElementById('d-status').innerHTML = running
    ? `<span style="color:#22c55e;">● ONLINE</span>`
    : `<span style="color:#ef4444;">● OFFLINE</span>`;

  document.getElementById('d-cpu').innerHTML = `<span style="color:#a78bfa;">${s.cpu_cores} vCores</span>`;
  document.getElementById('d-ram').innerHTML = `<span style="color:#22d3ee;">${s.ram_gb} GB DDR5 RAM</span>`;
  document.getElementById('d-disk').innerHTML = `<span style="color:#f59e0b;">${s.disk_gb} GB NVMe Gen4</span>`;

  // Info box at bottom
  const infoBox = document.getElementById('d-info-box');
  if (infoBox) {
    infoBox.innerHTML = `
      <div class="stat-row"><span style="color:var(--muted);">Server Alias</span><span>${s.service_alias}</span></div>
      <div class="stat-row"><span style="color:var(--muted);">Service Type</span><span style="text-transform:capitalize;">${s.service_type || 'VPS'}</span></div>
      <div class="stat-row"><span style="color:var(--muted);">Tier</span><span>${s.service_tier?.toUpperCase() || '—'}</span></div>
      <div class="stat-row"><span style="color:var(--muted);">IP Address</span><span style="font-family:'DM Mono',monospace;color:#38bdf8;">${s.ip}</span></div>
      <div class="stat-row"><span style="color:var(--muted);">Region</span><span>${s.region || 'India (Mumbai)'}</span></div>
      <div class="stat-row"><span style="color:var(--muted);">OS</span><span>${s.os || 'Ubuntu 24.04 LTS'}</span></div>
      <div class="stat-row"><span style="color:var(--muted);">Deployed On</span><span>${created}</span></div>
    `;
  }

  // Console placeholder
  const con = document.getElementById('d-console');
  if (con) {
    con.textContent = `[KryonHost] Service: ${s.service_alias}\n[KryonHost] IP: ${s.ip}\n[KryonHost] Status: ${running ? 'Running' : 'Stopped'}\n[KryonHost] Region: ${s.region || 'Mumbai, India'}\n[KryonHost] Tier: ${s.service_tier || 'N/A'}\n\nFor server management, contact support via Discord.\nFor SSH access, use the credentials provided at deployment.`;
  }
}

/* ── Logout ───────────────────────────────────────────────────────────────── */
async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = '/login';
}

/* ── Init ─────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', initPanel);
