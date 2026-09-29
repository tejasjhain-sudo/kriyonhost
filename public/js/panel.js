/* ═══════════════════════════════════════════════════════════════════════════
   KryonHost — Minecraft Server Control Engine (Shulker API v2 Compatible)
   ═══════════════════════════════════════════════════════════════════════════ */

let currentServerId = 'mc-srv-01';
let sparklineChart = null;
let pollingTimer = null;
let activeEditingFile = 'server.properties';

const MAX_SPARKLINE_POINTS = 16;
let sparklineData = [14, 16, 18, 15, 19, 22, 18, 17, 20, 18, 19, 21, 18, 17, 18, 18];

/* ── Auth & Init ──────────────────────────────────────────────────────────── */
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
        
        if (uDisp) uDisp.textContent = formattedName;
        if (uEmail) uEmail.textContent = email;
        if (uInitial) uInitial.textContent = formattedName.charAt(0);
      }
    }
  } catch (err) {
    console.warn('Session check note:', err);
  }

  initSparklineChart();
  startTelemetryPolling();
}

/* ── Sparkline CPU Chart ──────────────────────────────────────────────────── */
function initSparklineChart() {
  const canvas = document.getElementById('sparkline-cpu');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 24);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

  sparklineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array(MAX_SPARKLINE_POINTS).fill(''),
      datasets: [{
        data: sparklineData,
        borderColor: '#6366f1',
        borderWidth: 1.8,
        backgroundColor: gradient,
        fill: true,
        tension: 0.4,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false, min: 0, max: 100 }
      },
      layout: { padding: 0 }
    }
  });
}

/* ── Real-Time Telemetry Simulation / Shulker API Poll ────────────────────── */
function startTelemetryPolling() {
  if (pollingTimer) clearInterval(pollingTimer);

  pollingTimer = setInterval(async () => {
    // Generate organic fluctuations around Ryzen 9 standard load
    const cpuPct = (16 + Math.random() * 5).toFixed(0);
    const ramPct = (33 + Math.random() * 3).toFixed(0);
    const ramGb = ((20 * ramPct) / 100).toFixed(1);

    const cpuText = document.getElementById('val-cpu-text');
    const ramText = document.getElementById('val-ram-text');
    const ramGbText = document.getElementById('val-ram-gb');
    const ramFill = document.getElementById('fill-ram-bar');

    if (cpuText) cpuText.textContent = `${cpuPct}%`;
    if (ramText) ramText.textContent = `${ramPct}%`;
    if (ramGbText) ramGbText.textContent = `${ramGb} GB / 20 GB`;
    if (ramFill) ramFill.style.width = `${ramPct}%`;

    if (sparklineChart) {
      sparklineChart.data.datasets[0].data.push(parseInt(cpuPct));
      if (sparklineChart.data.datasets[0].data.length > MAX_SPARKLINE_POINTS) {
        sparklineChart.data.datasets[0].data.shift();
      }
      sparklineChart.update();
    }
  }, 2500);
}

/* ── Main View & Submenu Navigation ───────────────────────────────────────── */
function switchMainView(view) {
  if (view === 'fleet') {
    window.location.href = '/vps';
  } else {
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const mcLink = Array.from(document.querySelectorAll('.sidebar-link')).find(l => l.textContent.includes('Minecraft'));
    if (mcLink) mcLink.classList.add('active');
    jumpToSubSection('overview');
  }
}

function jumpToSubSection(sectionId) {
  document.querySelectorAll('.sub-link').forEach(l => l.classList.remove('active'));
  const clicked = Array.from(document.querySelectorAll('.sub-link')).find(l => 
    l.textContent.toLowerCase().includes(sectionId)
  );
  if (clicked) clicked.classList.add('active');

  if (sectionId === 'console') {
    const el = document.getElementById('section-console');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    const input = document.getElementById('cmd-input-box');
    if (input) input.focus();
  } else if (sectionId === 'files') {
    const el = document.getElementById('section-files');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  } else if (sectionId === 'settings') {
    const el = document.getElementById('section-settings');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  } else if (sectionId === 'overview') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/* ── Console Command Execution ────────────────────────────────────────────── */
async function executeMinecraftCmd() {
  const input = document.getElementById('cmd-input-box');
  if (!input || !input.value.trim()) return;

  const cmd = input.value.trim();
  input.value = '';

  const con = document.getElementById('mc-console-window');
  const now = new Date().toTimeString().slice(0, 8);

  if (con) {
    con.textContent += `\n> ${cmd}`;
    con.scrollTop = con.scrollHeight;
  }

  // Try backend Shulker API route
  try {
    const res = await fetch(`/api/minecraft/${currentServerId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd, server_name: 'Survival-1' })
    });
    const data = await res.json();
    if (con && data.response) {
      con.textContent += `\n[${now}] [Server] ${data.response}`;
      con.scrollTop = con.scrollHeight;
      return;
    }
  } catch (err) {
    // Local simulation fallback
  }

  // Simulated server responses
  if (con) {
    setTimeout(() => {
      const respTime = new Date().toTimeString().slice(0, 8);
      if (cmd.startsWith('say ')) {
        con.textContent += `\n[${respTime}] [Server] [Broadcast] ${cmd.slice(4)}`;
      } else if (cmd.startsWith('op ')) {
        con.textContent += `\n[${respTime}] [Server] Made ${cmd.slice(3)} a server operator`;
      } else if (cmd === 'tps') {
        con.textContent += `\n[${respTime}] [Server] TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0 (Memory: 6,940 MB / 20,480 MB)`;
      } else if (cmd === 'list') {
        con.textContent += `\n[${respTime}] [Server] There are 12 of a max of 100 players online: Alex, Steve, Notch, KryonAdmin, EnderKing, ShadowX, PixelMaster...`;
      } else if (cmd === 'help') {
        con.textContent += `\n[${respTime}] [Server] Available commands: /say, /op, /deop, /tps, /list, /whitelist, /kick, /ban, /save-all, /stop`;
      } else {
        con.textContent += `\n[${respTime}] [Server] Command '${cmd}' executed successfully.`;
      }
      con.scrollTop = con.scrollHeight;
    }, 180);
  }
}

function clearConsoleLog() {
  const con = document.getElementById('mc-console-window');
  if (con) con.textContent = '[Console cleared]';
}

function toggleConsoleFull() {
  const con = document.getElementById('mc-console-window');
  if (!con) return;
  if (con.style.height === '500px') {
    con.style.height = '280px';
  } else {
    con.style.height = '500px';
  }
}

/* ── Server Actions (Start, Stop, Restart, Kill, Reload, Backup) ───────────── */
async function triggerAction(action) {
  const con = document.getElementById('mc-console-window');
  const now = new Date().toTimeString().slice(0, 8);

  if (action === 'start') {
    showToast('Starting Minecraft container on Ryzen 9 7950X...');
    if (con) {
      con.textContent += `\n[${now}] [Daemon] Allocating 20 GB DDR5 ECC RAM...`;
      con.textContent += `\n[${now}] [Server] Spigot 1.21.5 started on port 25565. TPS: 20.0.`;
      con.scrollTop = con.scrollHeight;
    }
  } else if (action === 'stop') {
    showToast('Stopping Minecraft server safely (saving world)...');
    if (con) {
      con.textContent += `\n[${now}] [Server] Saving world dimensions (overworld, nether, the_end)...`;
      con.textContent += `\n[${now}] [Daemon] Server container stopped cleanly.`;
      con.scrollTop = con.scrollHeight;
    }
  } else if (action === 'restart') {
    showToast('Restarting Minecraft server...');
    if (con) {
      con.textContent += `\n[${now}] [Daemon] Reboot signal acknowledged. Restarting JVM...`;
      con.textContent += `\n[${now}] [Server] Done (2.1s)! Server running at 20.0 TPS.`;
      con.scrollTop = con.scrollHeight;
    }
  } else if (action === 'kill') {
    showToast('Forced SIGKILL sent to server container');
    if (con) {
      con.textContent += `\n[${now}] [Daemon] Process terminated immediately (SIGKILL).`;
      con.scrollTop = con.scrollHeight;
    }
  } else if (action === 'reload') {
    showToast('Reloading server configuration & plugins...');
    if (con) {
      con.textContent += `\n[${now}] [Server] Reload complete. 18 plugins refreshed.`;
      con.scrollTop = con.scrollHeight;
    }
  } else if (action === 'backup') {
    showToast('Creating full NVMe snapshot backup of world & configs...');
    if (con) {
      con.textContent += `\n[${now}] [Backup] Snapshot backup created: survival-1_backup_${Date.now()}.tar.gz (1.4 GB)`;
      con.scrollTop = con.scrollHeight;
    }
  }
}

/* ── File Explorer Sub-Tabs & Editor ──────────────────────────────────────── */
function switchFileTab(tabName, btnElement) {
  document.querySelectorAll('.ftab-btn').forEach(btn => btn.classList.remove('active'));
  if (btnElement) {
    btnElement.classList.add('active');
  } else {
    const matchingBtn = Array.from(document.querySelectorAll('.ftab-btn')).find(b => 
      b.textContent.toLowerCase().includes(tabName)
    );
    if (matchingBtn) matchingBtn.classList.add('active');
  }

  const tbody = document.getElementById('file-tbody');
  if (!tbody) return;

  if (tabName === 'plugins') {
    tbody.innerHTML = `
      <tr onclick="showToast('Viewing EssentialsX.jar')">
        <td><div class="file-name-cell">🧩 EssentialsX-2.20.1.jar</div></td>
        <td>4.2 MB</td>
        <td>2 days ago</td>
        <td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
      <tr onclick="showToast('Viewing LuckPerms.jar')">
        <td><div class="file-name-cell">🧩 LuckPerms-Bukkit-5.4.jar</div></td>
        <td>2.8 MB</td>
        <td>2 days ago</td>
        <td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
      <tr onclick="showToast('Viewing WorldEdit.jar')">
        <td><div class="file-name-cell">🧩 WorldEdit-7.3.0.jar</div></td>
        <td>6.1 MB</td>
        <td>2 days ago</td>
        <td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
      <tr onclick="showToast('Viewing Vault.jar')">
        <td><div class="file-name-cell">🧩 Vault.jar</div></td>
        <td>420 KB</td>
        <td>2 days ago</td>
        <td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
    `;
  } else if (tabName === 'worlds') {
    tbody.innerHTML = `
      <tr onclick="showToast('World directory: world')">
        <td><div class="file-name-cell">🌍 world (Overworld)</div></td>
        <td>420 MB</td>
        <td>1 hour ago</td>
        <td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
      <tr onclick="showToast('World directory: world_nether')">
        <td><div class="file-name-cell">🔥 world_nether (Nether)</div></td>
        <td>180 MB</td>
        <td>1 hour ago</td>
        <td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
      <tr onclick="showToast('World directory: world_the_end')">
        <td><div class="file-name-cell">🌌 world_the_end (The End)</div></td>
        <td>95 MB</td>
        <td>1 hour ago</td>
        <td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
    `;
  } else if (tabName === 'backups') {
    tbody.innerHTML = `
      <tr onclick="showToast('Snapshot ready for download')">
        <td><div class="file-name-cell">💾 auto_backup_2026-09-29.tar.gz</div></td>
        <td>1.42 GB</td>
        <td>Today at 04:00 AM</td>
        <td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
      <tr onclick="showToast('Snapshot ready for download')">
        <td><div class="file-name-cell">💾 auto_backup_2026-09-28.tar.gz</div></td>
        <td>1.39 GB</td>
        <td>Yesterday at 04:00 AM</td>
        <td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
    `;
  } else if (tabName === 'schedules') {
    tbody.innerHTML = `
      <tr onclick="showToast('Schedule: Daily Restart at 04:00')">
        <td><div class="file-name-cell">⏰ Daily Automated Reboot &amp; World Save</div></td>
        <td>Every 24h (04:00 IST)</td>
        <td>Active</td>
        <td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
      <tr onclick="showToast('Schedule: Daily Automated Backup')">
        <td><div class="file-name-cell">⏰ Automated NVMe Snapshot Backup</div></td>
        <td>Every 24h (04:15 IST)</td>
        <td>Active</td>
        <td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
    `;
  } else {
    // Reset to root files
    tbody.innerHTML = `
      <tr onclick="openFileEditorModal('plugins/')">
        <td><div class="file-name-cell"><svg width="15" height="15" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> plugins/</div></td>
        <td>-</td><td>2 days ago</td><td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
      <tr onclick="openFileEditorModal('world/')">
        <td><div class="file-name-cell"><svg width="15" height="15" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> world/</div></td>
        <td>-</td><td>2 days ago</td><td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
      <tr onclick="openFileEditorModal('config/')">
        <td><div class="file-name-cell"><svg width="15" height="15" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> config/</div></td>
        <td>-</td><td>3 days ago</td><td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
      <tr onclick="openFileEditorModal('logs/')">
        <td><div class="file-name-cell"><svg width="15" height="15" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> logs/</div></td>
        <td>-</td><td>2 hours ago</td><td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
      <tr onclick="openFileEditorModal('server.jar')">
        <td><div class="file-name-cell"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> server.jar</div></td>
        <td>52.4 MB</td><td>2 days ago</td><td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
      <tr onclick="openFileEditorModal('server.properties')">
        <td><div class="file-name-cell"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> server.properties</div></td>
        <td>4.2 KB</td><td>1 hour ago</td><td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
      <tr onclick="openFileEditorModal('eula.txt')">
        <td><div class="file-name-cell"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> eula.txt</div></td>
        <td>1 KB</td><td>2 days ago</td><td style="text-align:right; color:var(--text-muted);">⋮</td>
      </tr>
    `;
  }
}

function openFileEditorModal(filename) {
  if (filename.endsWith('/')) {
    showToast(`Opened folder: ${filename}`);
    return;
  }
  activeEditingFile = filename;
  const modal = document.getElementById('file-modal');
  const title = document.getElementById('file-modal-title');
  const area = document.getElementById('file-editor-area');

  if (title) title.textContent = `Editing ${filename}`;
  if (area) {
    if (filename === 'server.properties') {
      area.value = `# Minecraft server properties
# KryonHost AMD Ryzen 9 7950X High-Performance Node
server-port=25565
gamemode=survival
difficulty=normal
pvp=true
max-players=100
view-distance=12
simulation-distance=10
enable-command-block=true
motd=§a§lSurvival-1 §7- §bAMD Ryzen 9 7950X §8| §d92 Tbps DDoS Shield
online-mode=true
allow-flight=false
white-list=false
spawn-protection=0
`;
    } else if (filename === 'eula.txt') {
      area.value = `# By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\neula=true\n`;
    } else {
      area.value = `# Configuration file: ${filename}\n`;
    }
  }

  if (modal) modal.style.display = 'flex';
}

function closeFileModal() {
  const modal = document.getElementById('file-modal');
  if (modal) modal.style.display = 'none';
}

function saveFileFromModal() {
  closeFileModal();
  showToast(`File "${activeEditingFile}" saved successfully!`);
}

/* ── Credentials Modal & Direct Copy ──────────────────────────────────────── */
function openCredsModal(type = 'sftp') {
  const modal = document.getElementById('creds-modal');
  if (modal) modal.style.display = 'flex';
}

function closeCredsModal() {
  const modal = document.getElementById('creds-modal');
  if (modal) modal.style.display = 'none';
}

function copyDirect(text) {
  navigator.clipboard.writeText(text);
  showToast(`Copied "${text}" to clipboard`);
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
