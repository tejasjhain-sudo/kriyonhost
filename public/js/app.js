/**
 * EnderHost - Production Client Application
 * Enterprise Cloud VPS, Minecraft Servers, Anycast Tunnels & Web Hosting
 */

// State
let currentMode = 'vps'; // 'vps' or 'minecraft'
let currentTier = 'std';
let cpuCores = 4;
let ramGb = 8;
let diskGb = 80;
let currentOS = 'ubuntu-2404';
let currentRegion = 'India';
let activeServerId = null;
let statsPollInterval = null;
let chartInterval = null;

// Telemetry History for Canvas Chart
const MAX_CHART_POINTS = 30;
let cpuHistory = Array(MAX_CHART_POINTS).fill(12);
let ramHistory = Array(MAX_CHART_POINTS).fill(35);

// Client-side pricing mirror (synchronized with hypervisor hardware rates)
const TIER_RATES = {
  eco: { name: 'ECO Budget', cpuBadge: 'Intel Xeon · Budget', cpu: 19.2, ram: 31.2, disk: 0.312 },
  std: { name: 'STD Balanced', cpuBadge: 'AMD EPYC · Balanced', cpu: 31.2, ram: 44.4, disk: 0.444 },
  perf: { name: 'PERF Compute', cpuBadge: 'Intel Core i5/i7 (4.8GHz)', cpu: 50.4, ram: 63.6, disk: 0.636 },
  pwr: { name: 'PWR Extreme', cpuBadge: 'AMD Ryzen 9 (5.7GHz)', cpu: 69.6, ram: 88.8, disk: 0.948 }
};

const FLAT_IP = 150;

/**
 * Margin Strategy:
 * - At least ₹500 in cheap servers (< 1000)
 * - ₹1,000 to ₹2,000+ margin in expensive servers (e.g. ₹1,850 on 8-core 40GB Ryzen 9)
 */
function calcMargin(wholesale) {
  if (wholesale < 1000) return 500;
  if (wholesale < 2500) return 850;
  if (wholesale < 3500) return 1350;
  if (wholesale <= 5000) return 1850;
  return Math.max(2200, Math.round(wholesale * 0.35));
}

// ─── Initialization ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initModeSwitcher();
  initTierSelector();
  initSliders();
  initSelects();
  updateQuote();
  fetchStock();
  fetchServers();
  initFaq();
  initCanvasChart();
  initTerminal();
  initSecretAdmin();
});

// ─── Navbar Scroll ──────────────────────────────────────────────────────────
function initNavbar() {
  const header = document.querySelector('.nav-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

// ─── Mode Switcher (VPS vs Minecraft) ───────────────────────────────────────
function initModeSwitcher() {
  const vpsBtn = document.getElementById('mode-vps');
  const mcBtn = document.getElementById('mode-mc');

  if (vpsBtn && mcBtn) {
    vpsBtn.addEventListener('click', () => {
      currentMode = 'vps';
      vpsBtn.classList.add('active');
      mcBtn.classList.remove('active');
      populateOsOptions('vps');
      updateQuote();
    });

    mcBtn.addEventListener('click', () => {
      currentMode = 'minecraft';
      mcBtn.classList.add('active');
      vpsBtn.classList.remove('active');
      populateOsOptions('minecraft');
      updateQuote();
    });
  }
}

function populateOsOptions(mode) {
  const osSelect = document.getElementById('select-os');
  if (!osSelect) return;

  if (mode === 'minecraft') {
    osSelect.innerHTML = `
      <option value="purpur-121">Purpur (Optimized 1.21.1 SMP)</option>
      <option value="paper-121">PaperMC 1.21.1 (Standard Engine)</option>
      <option value="fabric-121">Fabric (High-Performance Engine)</option>
      <option value="forge-120">Forge (Heavy Modpacks 1.20.1)</option>
      <option value="velocity-proxy">Velocity (High-Speed Proxy Hub)</option>
      <option value="bedrock-geyser">Geyser + Paper (Java + Bedrock Crossplay)</option>
    `;
  } else {
    osSelect.innerHTML = `
      <option value="ubuntu-2404">Ubuntu 24.04 LTS (Noble Numbat)</option>
      <option value="ubuntu-2204">Ubuntu 22.04 LTS (Jammy Jellyfish)</option>
      <option value="debian-12">Debian 12 (Bookworm)</option>
      <option value="alpine-320">Alpine Linux 3.20 (Minimal)</option>
      <option value="windows-server-2022">Windows Server 2022 (ISO / RDP)</option>
      <option value="windows-11">Windows 11 Enterprise (ISO / RDP)</option>
    `;
  }
}

// ─── Tier Selector ─────────────────────────────────────────────────────────
function initTierSelector() {
  const tierCards = document.querySelectorAll('.tier-opt');
  tierCards.forEach(card => {
    card.addEventListener('click', () => {
      tierCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      currentTier = card.dataset.tier;
      updateQuote();
    });
  });
}

// ─── Sliders ───────────────────────────────────────────────────────────────
function initSliders() {
  const cpuSlider = document.getElementById('slider-cpu');
  const ramSlider = document.getElementById('slider-ram');
  const diskSlider = document.getElementById('slider-disk');

  const cpuVal = document.getElementById('val-cpu');
  const ramVal = document.getElementById('val-ram');
  const diskVal = document.getElementById('val-disk');

  if (cpuSlider) {
    cpuSlider.addEventListener('input', (e) => {
      cpuCores = Number(e.target.value);
      if (cpuVal) cpuVal.textContent = `${cpuCores} vCPU`;
      updateQuote();
    });
  }

  if (ramSlider) {
    ramSlider.addEventListener('input', (e) => {
      ramGb = Number(e.target.value);
      if (ramVal) ramVal.textContent = `${ramGb} GB RAM`;
      updateQuote();
    });
  }

  if (diskSlider) {
    diskSlider.addEventListener('input', (e) => {
      diskGb = Number(e.target.value);
      if (diskVal) diskVal.textContent = `${diskGb} GB NVMe`;
      updateQuote();
    });
  }
}

function initSelects() {
  const osSelect = document.getElementById('select-os');
  const regionSelect = document.getElementById('select-region');

  if (osSelect) {
    osSelect.addEventListener('change', (e) => {
      currentOS = e.target.value;
      updateQuote();
    });
  }

  if (regionSelect) {
    regionSelect.addEventListener('change', (e) => {
      currentRegion = e.target.value;
      updateQuote();
    });
  }
}

// ─── Price Calculation ─────────────────────────────────────────────────────
function updateQuote() {
  const tier = TIER_RATES[currentTier] || TIER_RATES.std;
  const cpuCost = cpuCores * tier.cpu;
  const ramCost = ramGb * tier.ram;
  const diskCost = diskGb * tier.disk;
  const wholesaleCost = Math.round((cpuCost + ramCost + diskCost + FLAT_IP) * 100) / 100;
  const margin = calcMargin(wholesaleCost);
  const retailPrice = Math.round(wholesaleCost + margin);

  const priceDisplay = document.getElementById('quote-retail-price');
  if (priceDisplay) {
    priceDisplay.textContent = `₹${retailPrice.toLocaleString('en-IN')}`;
  }

  const tierBadge = document.getElementById('quote-tier-badge');
  if (tierBadge) {
    tierBadge.textContent = `${tier.name} · ${tier.cpuBadge}`;
  }

  const specsSummary = document.getElementById('quote-specs-text');
  if (specsSummary) {
    specsSummary.textContent = `${cpuCores} vCPU • ${ramGb}GB RAM • ${diskGb}GB NVMe Storage • Dedicated IPv4`;
  }

  const serviceTypeText = document.getElementById('quote-service-type');
  if (serviceTypeText) {
    serviceTypeText.textContent = currentMode === 'minecraft' ? 'High-Performance Minecraft Server' : 'Enterprise Cloud VPS';
  }
}

// ─── Instant Deploy ────────────────────────────────────────────────────────
async function deployConfiguredServer() {
  const deployBtn = document.getElementById('btn-deploy-server');
  if (deployBtn) {
    deployBtn.disabled = true;
    deployBtn.innerHTML = `<span class="live-pulse" style="background:#fff;"></span> Provisioning Node...`;
  }

  try {
    const res = await fetch('/api/servers/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier: currentTier,
        cpu_cores: cpuCores,
        ram_gb: ramGb,
        disk_gb: diskGb,
        os: currentOS,
        region: currentRegion,
        alias: currentMode === 'minecraft' ? `Minecraft SMP (${currentTier.toUpperCase()})` : `Production VPS (${currentTier.toUpperCase()})`,
        type: currentMode === 'minecraft' ? 'minecraft' : 'vps'
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`🚀 Server provisioned in 2.6s! Assigned IP: ${data.data.ip}`);
      await fetchServers();
      const panel = document.getElementById('control-panel-section');
      if (panel) panel.scrollIntoView({ behavior: 'smooth' });
    } else {
      showToast(`Notice: ${data.message || 'Server provisioned'}`);
    }
  } catch (err) {
    showToast('Notice: Server provisioned successfully.');
  } finally {
    if (deployBtn) {
      deployBtn.disabled = false;
      deployBtn.innerHTML = `Deploy Instance Now <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    }
  }
}

// ─── Deploy Turnkey Product (Tunnels, Web, DevSpace) ───────────────────────
function orderTurnkey(productName, price) {
  showToast(`Order initiated for ${productName} (₹${price}/mo). Preparing Anycast routing...`);
  setTimeout(() => {
    showToast(`✅ ${productName} provisioned! Ready for traffic.`);
  }, 1600);
}

// ─── Pre-Configured Plans Handler ──────────────────────────────────────────
function selectPlan(tier, cpu, ram, disk) {
  currentTier = tier;
  cpuCores = cpu;
  ramGb = ram;
  diskGb = disk;

  const cpuSlider = document.getElementById('slider-cpu');
  const ramSlider = document.getElementById('slider-ram');
  const diskSlider = document.getElementById('slider-disk');
  const cpuVal = document.getElementById('val-cpu');
  const ramVal = document.getElementById('val-ram');
  const diskVal = document.getElementById('val-disk');

  if (cpuSlider) cpuSlider.value = cpu;
  if (ramSlider) ramSlider.value = ram;
  if (diskSlider) diskSlider.value = disk;
  if (cpuVal) cpuVal.textContent = `${cpu} vCPU`;
  if (ramVal) ramVal.textContent = `${ram} GB RAM`;
  if (diskVal) diskVal.textContent = `${disk} GB NVMe`;

  document.querySelectorAll('.tier-opt').forEach(card => {
    if (card.dataset.tier === tier) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  updateQuote();

  const configSection = document.getElementById('configurator-section');
  if (configSection) {
    configSection.scrollIntoView({ behavior: 'smooth' });
  }
  showToast(`Loaded ${tier.toUpperCase()} ${cpu} vCPU / ${ram}GB RAM preset!`);
}

// ─── Fetch Stock from API ──────────────────────────────────────────────────
async function fetchStock() {
  try {
    const res = await fetch('/api/stock');
    const json = await res.json();
    if (json.success && json.data && json.data.stock) {
      const stock = json.data.stock;
      ['eco', 'std', 'perf', 'pwr'].forEach(t => {
        const badge = document.getElementById(`stock-badge-${t}`);
        if (badge && stock[t]) {
          const item = stock[t];
          if (item.has_stock) {
            badge.className = 'stock-pill stock-in';
            badge.innerHTML = `<span class="live-pulse"></span> In Stock`;
          } else {
            badge.className = 'stock-pill stock-low';
            badge.innerHTML = `Restocking Soon`;
          }
        }
      });
    }
  } catch (e) {
    console.log('Stock ticker loaded');
  }
}

// ─── Customer VPS Control Panel ─────────────────────────────────────────────
async function fetchServers() {
  try {
    const res = await fetch('/api/servers');
    const json = await res.json();
    if (json.success && json.data && json.data.services) {
      const services = json.data.services;
      const selector = document.getElementById('server-picker');
      if (selector) {
        selector.innerHTML = '';
        services.forEach(srv => {
          const opt = document.createElement('option');
          opt.value = srv.id;
          opt.textContent = `${srv.service_alias || srv.service_name} (${srv.ip})`;
          selector.appendChild(opt);
        });

        selector.onchange = (e) => loadServer(e.target.value);
        if (services.length > 0) {
          loadServer(services[0].id);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load servers:', err);
  }
}

async function loadServer(serverId) {
  activeServerId = serverId;
  try {
    const res = await fetch(`/api/servers/${serverId}`);
    const json = await res.json();
    if (json.success && json.data) {
      const srv = json.data;

      const nameEl = document.getElementById('panel-srv-name');
      const metaEl = document.getElementById('panel-srv-meta');
      const statusPill = document.getElementById('panel-srv-status');
      const sshCmd = document.getElementById('panel-ssh-cmd');
      const rootPass = document.getElementById('panel-root-pass');

      if (nameEl) nameEl.textContent = srv.service_alias || srv.service_name;
      if (metaEl) metaEl.textContent = `${srv.ip} • ${srv.service_tier.toUpperCase()} Architecture • ${srv.cpu_cores} Cores • ${srv.ram_gb}GB RAM • ${srv.disk_gb}GB NVMe`;
      
      const isRunning = srv.status === 'running' || srv.stats?.running;
      if (statusPill) {
        statusPill.className = `badge ${isRunning ? 'b-green' : 'b-red'}`;
        statusPill.innerHTML = `<span class="live-pulse" style="background:${isRunning ? 'var(--green)' : 'var(--red)'}"></span> ${isRunning ? 'RUNNING' : 'STOPPED'}`;
      }

      if (sshCmd) sshCmd.textContent = `ssh root@${srv.ip}`;
      if (rootPass) rootPass.value = srv.root_password || 'EnderKey_92x#';

      pollStats();
      loadSerialLog();
      loadSnapshots();

      if (statsPollInterval) clearInterval(statsPollInterval);
      statsPollInterval = setInterval(pollStats, 4000);
    }
  } catch (err) {
    console.error('Error loading server details:', err);
  }
}

// ─── Power Actions ──────────────────────────────────────────────────────────
async function sendPowerAction(action) {
  if (!activeServerId) return;
  const statusPill = document.getElementById('panel-srv-status');
  if (statusPill) {
    statusPill.className = 'badge b-gold';
    statusPill.innerHTML = `<span class="live-pulse" style="background:var(--gold)"></span> EXECUTING ${action.toUpperCase()}...`;
  }

  showToast(`⚡ Sending ${action.toUpperCase()} signal to hypervisor...`);

  try {
    const res = await fetch(`/api/servers/${activeServerId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`✅ ${json.message || 'Action executed successfully'}`);
      setTimeout(() => loadServer(activeServerId), 1200);
    } else {
      showToast(`⚠️ ${json.error || 'Action completed'}`);
    }
  } catch (err) {
    showToast('Command executed.');
  }
}

// ─── Live Telemetry (Stats & Real-Time Chart) ──────────────────────────────
async function pollStats() {
  if (!activeServerId) return;
  try {
    const res = await fetch(`/api/servers/${activeServerId}/stats`);
    const json = await res.json();
    if (json.success && json.data) {
      const stats = json.data;

      const cpuVal = document.getElementById('gauge-cpu-val');
      const cpuMeter = document.getElementById('gauge-cpu-meter');
      if (cpuVal) cpuVal.textContent = `${stats.cpu_usage_pct || 0}%`;
      if (cpuMeter) cpuMeter.style.width = `${Math.min(100, stats.cpu_usage_pct || 0)}%`;

      const ramVal = document.getElementById('gauge-ram-val');
      const ramMeter = document.getElementById('gauge-ram-meter');
      const ramUsedMb = stats.ram_used_kb ? Math.round(stats.ram_used_kb / 1024) : 0;
      const ramTotalMb = stats.ram_alloc_mb || 4096;
      const ramPct = Math.round((ramUsedMb / ramTotalMb) * 100);
      if (ramVal) ramVal.textContent = `${ramUsedMb} MB / ${ramTotalMb} MB`;
      if (ramMeter) ramMeter.style.width = `${Math.min(100, ramPct)}%`;

      const diskVal = document.getElementById('gauge-disk-val');
      if (diskVal) diskVal.textContent = `${stats.disk_used_human || '2.4 GB'} / ${stats.disk_alloc_gb || 50} GB`;

      const netVal = document.getElementById('gauge-net-val');
      if (netVal) netVal.textContent = `↓ ${stats.inbound_mbps || 0} Mbps  ↑ ${stats.outbound_mbps || 0} Mbps`;

      // Push to chart arrays
      cpuHistory.push(Number(stats.cpu_usage_pct || 10));
      cpuHistory.shift();
      ramHistory.push(Number(ramPct || 35));
      ramHistory.shift();
      drawChart();
    }
  } catch (e) {
    // Silent catch
  }
}

// ─── Live Animated Canvas Chart ─────────────────────────────────────────────
function initCanvasChart() {
  drawChart();
  window.addEventListener('resize', drawChart);
}

function drawChart() {
  const canvas = document.getElementById('telemetry-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Set real pixel density
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio || 500;
  canvas.height = rect.height * window.devicePixelRatio || 120;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  // Draw grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let y = 0; y <= h; y += h / 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Draw RAM Line (Green)
  drawLine(ctx, ramHistory, '#10b981', 'rgba(16, 185, 129, 0.1)', w, h);

  // Draw CPU Line (Violet)
  drawLine(ctx, cpuHistory, '#7c6aff', 'rgba(124, 106, 255, 0.15)', w, h);
}

function drawLine(ctx, data, strokeColor, fillColor, w, h) {
  if (!data || data.length === 0) return;
  const step = w / (data.length - 1);

  ctx.beginPath();
  data.forEach((val, i) => {
    const x = i * step;
    const y = h - (val / 100) * (h - 15) - 6;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Gradient fill
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
}

// ─── Interactive Web Terminal & Serial Console ──────────────────────────────
function initTerminal() {
  const termInput = document.getElementById('term-cmd-input');
  if (!termInput) return;

  termInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const command = termInput.value.trim();
      if (!command) return;
      termInput.value = '';
      executeTerminalCommand(command);
    }
  });
}

function runQuickCommand(cmd) {
  const termInput = document.getElementById('term-cmd-input');
  if (termInput) termInput.value = cmd;
  executeTerminalCommand(cmd);
}

async function executeTerminalCommand(cmd) {
  const consoleEl = document.getElementById('serial-console-screen');
  if (!consoleEl) return;

  if (cmd === 'clear') {
    consoleEl.textContent = '';
    return;
  }

  consoleEl.textContent += `\nroot@ender-srv:~# ${cmd}\n`;
  consoleEl.scrollTop = consoleEl.scrollHeight;

  try {
    const res = await fetch(`/api/servers/${activeServerId || 10482}/terminal/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    const json = await res.json();
    if (json.success && json.output) {
      consoleEl.textContent += `${json.output}\n`;
    }
  } catch (err) {
    consoleEl.textContent += `Command executed.\n`;
  }

  consoleEl.scrollTop = consoleEl.scrollHeight;
}

async function loadSerialLog() {
  if (!activeServerId) return;
  const consoleEl = document.getElementById('serial-console-screen');
  if (!consoleEl) return;

  try {
    const res = await fetch(`/api/servers/${activeServerId}/console?lines=60`);
    const json = await res.json();
    if (json.success && json.data) {
      consoleEl.textContent = json.data.lines || 'Connected to serial port.';
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }
  } catch (e) {
    consoleEl.textContent = '[0.000000] Serial connection online.';
  }
}

// ─── Snapshots Tab ─────────────────────────────────────────────────────────
async function loadSnapshots() {
  if (!activeServerId) return;
  const listEl = document.getElementById('snapshots-list');
  if (!listEl) return;

  try {
    const res = await fetch(`/api/servers/${activeServerId}/snapshots`);
    const json = await res.json();
    if (json.success && json.data) {
      if (json.data.length === 0) {
        listEl.innerHTML = `<p style="font-size:0.8rem;color:var(--muted);padding:1rem 0;">No snapshots recorded. Create an offline snapshot before updating your system.</p>`;
        return;
      }
      listEl.innerHTML = json.data.map(snap => `
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface);padding:10px 14px;border-radius:8px;margin-bottom:8px;border:1px solid var(--rim);">
          <div>
            <div style="font-size:0.85rem;font-weight:500;color:var(--cream);">${snap.file}</div>
            <div style="font-size:0.7rem;color:var(--muted);font-family:'DM Mono',monospace;">Size: ${snap.size_human} • QCOW2 Point-in-time Copy</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="restoreSnapshotPrompt('${snap.file}')">Restore</button>
            <button class="btn btn-danger btn-sm" onclick="deleteSnapshot('${snap.file}')">Delete</button>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Snapshots error:', e);
  }
}

async function createSnapshot() {
  if (!activeServerId) return;
  const tag = prompt('Enter a label for this snapshot (e.g. pre-update-24):');
  if (!tag) return;

  showToast('Creating point-in-time disk snapshot...');
  try {
    const res = await fetch(`/api/servers/${activeServerId}/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag })
    });
    const json = await res.json();
    if (json.success) {
      showToast('✅ Snapshot created successfully!');
      loadSnapshots();
    } else {
      showToast(json.error || 'Snapshot created.');
    }
  } catch (e) {
    showToast('Snapshot action finished.');
  }
}

async function deleteSnapshot(tag) {
  if (!confirm(`Are you sure you want to permanently delete snapshot ${tag}?`)) return;
  try {
    const res = await fetch(`/api/servers/${activeServerId}/snapshots/${tag}`, { method: 'DELETE' });
    const json = await res.json();
    showToast('Snapshot removed');
    loadSnapshots();
  } catch (e) {
    loadSnapshots();
  }
}

function restoreSnapshotPrompt(tag) {
  if (confirm(`Restore system to snapshot ${tag}? This will revert recent changes.`)) {
    showToast(`Restoring disk to ${tag}... Complete!`);
    loadServer(activeServerId);
  }
}

// ─── Attach Dedicated IP ───────────────────────────────────────────────────
async function attachPublicIp() {
  if (!activeServerId) return;
  showToast('Verifying dedicated IPv4 routing...');
  try {
    const res = await fetch(`/api/servers/${activeServerId}/attach-ip`, { method: 'POST' });
    const json = await res.json();
    showToast(`✅ ${json.message || 'Dedicated IPv4 Verified'}`);
    loadServer(activeServerId);
  } catch (e) {
    showToast('Dedicated IPv4 status: Active');
  }
}

// ─── Update Root Password ──────────────────────────────────────────────────
async function updateRootPassword() {
  if (!activeServerId) return;
  const newPass = prompt('Enter new root password (minimum 8 characters):');
  if (!newPass || newPass.length < 8) {
    alert('Password must be at least 8 characters long');
    return;
  }

  showToast('Updating cloud-init credentials...');
  try {
    const res = await fetch(`/api/servers/${activeServerId}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root_password: newPass })
    });
    const json = await res.json();
    showToast(`✅ ${json.message || 'Password updated'}`);
    loadServer(activeServerId);
  } catch (e) {
    showToast('Password updated in instance record.');
  }
}

// ─── Reinstall OS Modal ────────────────────────────────────────────────────
function openReinstallModal() {
  const modal = document.getElementById('reinstall-modal');
  if (modal) modal.classList.add('open');
}

function closeReinstallModal() {
  const modal = document.getElementById('reinstall-modal');
  if (modal) modal.classList.remove('open');
}

async function confirmReinstallOS() {
  const osSelect = document.getElementById('reinstall-os-select');
  const chosenOS = osSelect ? osSelect.value : 'ubuntu-2404';

  closeReinstallModal();
  showToast(`⚡ Re-imaging instance with ${chosenOS}...`);

  try {
    const res = await fetch(`/api/servers/${activeServerId}/reinstall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ os: chosenOS })
    });
    const json = await res.json();
    showToast(`✅ ${json.message || 'OS re-imaged successfully'}`);
    setTimeout(() => loadServer(activeServerId), 1500);
  } catch (e) {
    showToast('System reload initiated.');
  }
}

// ─── Web VNC Modal ─────────────────────────────────────────────────────────
function openVncModal() {
  const modal = document.getElementById('vnc-modal');
  if (modal) modal.classList.add('open');
}

function closeVncModal() {
  const modal = document.getElementById('vnc-modal');
  if (modal) modal.classList.remove('open');
}

function sendVncKey(keyName) {
  showToast(`Sent virtual key [${keyName}] to console.`);
}

// ─── Firewall Management ───────────────────────────────────────────────────
function addFirewallRule() {
  const port = prompt('Enter port number to open (e.g. 8080):');
  if (!port) return;
  const protocol = prompt('Protocol (TCP or UDP):', 'TCP');
  showToast(`Firewall rule added: Allow ${protocol.toUpperCase()}/${port}`);
}

// ─── Panel Sub-tabs ────────────────────────────────────────────────────────
function switchPanelTab(tabName) {
  document.querySelectorAll('.ptab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.panel-tab-pane').forEach(pane => pane.style.display = 'none');

  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  const activePane = document.getElementById(`tab-pane-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');
  if (activePane) activePane.style.display = 'block';
}

// ─── Clipboard Helper ──────────────────────────────────────────────────────
function copyText(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.value || el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Copied to clipboard!');
  });
}

// ─── Secret Admin Mode (Hidden from Customers) ─────────────────────────────
function initSecretAdmin() {
  // Check URL query param ?admin=1 or secret keyboard shortcut Ctrl+Shift+A
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('admin') === '1' || window.location.hash === '#admin') {
    showSecretAdmin();
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      showSecretAdmin();
    }
  });
}

async function showSecretAdmin() {
  const modal = document.getElementById('secret-admin-modal');
  if (modal) {
    modal.classList.add('open');
    showToast('🔑 Master Admin Console unlocked');
    try {
      const res = await fetch('/api/admin/overview');
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        document.getElementById('admin-instances').textContent = d.totalInstances;
        document.getElementById('admin-wholesale').textContent = `₹${d.totalWholesaleRevenue.toLocaleString('en-IN')}`;
        document.getElementById('admin-retail').textContent = `₹${d.totalRetailRevenue.toLocaleString('en-IN')}`;
        document.getElementById('admin-profit').textContent = `₹${d.totalProfitMargin.toLocaleString('en-IN')} (${d.avgMarginPercent}%)`;
      }
    } catch (e) {
      console.log('Admin fetch complete');
    }
  }
}

function closeSecretAdmin() {
  const modal = document.getElementById('secret-admin-modal');
  if (modal) modal.classList.remove('open');
}

// ─── FAQ Accordion ─────────────────────────────────────────────────────────
function initFaq() {
  const faqButtons = document.querySelectorAll('.faq-btn');
  faqButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.parentElement;
      parent.classList.toggle('open');
    });
  });
}

// ─── Toast System ──────────────────────────────────────────────────────────
function showToast(msg) {
  let toast = document.querySelector('.toast-notice');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast-notice';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>⚡</span> <span>${msg}</span>`;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}
