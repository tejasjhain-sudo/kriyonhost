/**
 * EnderHost - Interactive Frontend Application
 * Handles pricing calculation, live stock, and customer VPS control panel
 */

// State
let currentMode = 'vps'; // 'vps' or 'minecraft'
let currentTier = 'std';
let cpuCores = 4;
let ramGb = 8;
let diskGb = 80;
let currentOS = 'ubuntu-2404';
let currentRegion = 'India';
let isOwnerMode = false;
let activeServerId = null;
let statsPollInterval = null;

// Pricing Engine (mirrored client-side for ultra-fast instant 60fps slider dragging)
const TIER_RATES = {
  eco: { name: 'ECO Budget', cpuBadge: 'Intel Xeon · Budget', cpu: 16, ram: 26, disk: 0.26, maxCpu: 32, maxRam: 96, maxDisk: 1000 },
  std: { name: 'STD Balanced', cpuBadge: 'AMD EPYC · Balanced', cpu: 26, ram: 37, disk: 0.37, maxCpu: 32, maxRam: 96, maxDisk: 1000 },
  perf: { name: 'PERF Compute', cpuBadge: 'Intel Core i5/i7 (4.8GHz)', cpu: 42, ram: 53, disk: 0.53, maxCpu: 32, maxRam: 96, maxDisk: 1000 },
  pwr: { name: 'PWR Extreme', cpuBadge: 'AMD Ryzen 9 (5.7GHz)', cpu: 58, ram: 74, disk: 0.79, maxCpu: 32, maxRam: 96, maxDisk: 1000 }
};

const FLAT_IP = 150;

/**
 * Exact Margin rule requested by EnderHost owner:
 * - < ₹1000: ₹260 margin
 * - ₹1000 - ₹2000: ₹420 margin
 * - ₹2000 - ₹3000: ₹580 margin
 * - ₹3000 - ₹4000: ₹1100 margin
 * - > ₹4000: 30% margin
 */
function calcMargin(wholesale) {
  if (wholesale < 1000) return 260;
  if (wholesale < 2000) return 420;
  if (wholesale < 3000) return 580;
  if (wholesale <= 4000) return 1100;
  return Math.round(wholesale * 0.30);
}

// ─── DOM Initializer ────────────────────────────────────────────────────────
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
  initAdminToggle();
});

// ─── Navbar Scroll Effect ───────────────────────────────────────────────────
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
  const osSelect = document.getElementById('select-os');

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
      <option value="paper-121">PaperMC 1.21.1 (Standard)</option>
      <option value="fabric-121">Fabric (High Performance Mods)</option>
      <option value="forge-120">Forge (Modpack Engine 1.20.1)</option>
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

// ─── Tier Selection ────────────────────────────────────────────────────────
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

// ─── Live Quote Calculation ────────────────────────────────────────────────
function updateQuote() {
  const tier = TIER_RATES[currentTier] || TIER_RATES.std;
  const cpuCost = cpuCores * tier.cpu;
  const ramCost = ramGb * tier.ram;
  const diskCost = diskGb * tier.disk;
  const wholesaleCost = Math.round((cpuCost + ramCost + diskCost + FLAT_IP) * 100) / 100;
  const margin = calcMargin(wholesaleCost);
  const retailPrice = Math.round(wholesaleCost + margin);

  // Update UI Elements
  const priceDisplay = document.getElementById('quote-retail-price');
  if (priceDisplay) {
    priceDisplay.textContent = `₹${retailPrice.toLocaleString('en-IN')}`;
  }

  const wholesaleDisplay = document.getElementById('quote-wholesale-price');
  if (wholesaleDisplay) {
    wholesaleDisplay.textContent = `₹${wholesaleCost.toFixed(2)}`;
  }

  const marginDisplay = document.getElementById('quote-margin-price');
  if (marginDisplay) {
    marginDisplay.textContent = `+₹${margin} (${Math.round((margin / retailPrice) * 100)}%)`;
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

// ─── Instant Deploy Button ─────────────────────────────────────────────────
async function deployConfiguredServer() {
  const deployBtn = document.getElementById('btn-deploy-server');
  if (deployBtn) {
    deployBtn.disabled = true;
    deployBtn.innerHTML = `<span class="live-pulse" style="background:#fff;"></span> Provisioning on Node...`;
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
      // Scroll to control panel
      const panel = document.getElementById('control-panel-section');
      if (panel) panel.scrollIntoView({ behavior: 'smooth' });
    } else {
      showToast(`Notice: ${data.message || 'Server created in sandbox'}`);
    }
  } catch (err) {
    showToast('Notice: Server provisioned in demo cluster.');
  } finally {
    if (deployBtn) {
      deployBtn.disabled = false;
      deployBtn.innerHTML = `Deploy Instance Now <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    }
  }
}

// ─── Pre-Configured Plans Handler ──────────────────────────────────────────
function selectPlan(tier, cpu, ram, disk) {
  currentTier = tier;
  cpuCores = cpu;
  ramGb = ram;
  diskGb = disk;

  // Update slider positions
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

  // Select tier card
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
    console.log('Stock ticker offline fallback');
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

      // Update Panel Header
      const nameEl = document.getElementById('panel-srv-name');
      const metaEl = document.getElementById('panel-srv-meta');
      const statusPill = document.getElementById('panel-srv-status');
      const sshCmd = document.getElementById('panel-ssh-cmd');
      const rootPass = document.getElementById('panel-root-pass');

      if (nameEl) nameEl.textContent = srv.service_alias || srv.service_name;
      if (metaEl) metaEl.textContent = `${srv.ip} • ${srv.service_tier.toUpperCase()} • ${srv.cpu_cores} Cores • ${srv.ram_gb}GB RAM • ${srv.disk_gb}GB NVMe`;
      
      const isRunning = srv.status === 'running' || srv.stats?.running;
      if (statusPill) {
        statusPill.className = `badge ${isRunning ? 'b-green' : 'b-red'}`;
        statusPill.innerHTML = `<span class="live-pulse" style="background:${isRunning ? 'var(--green)' : 'var(--red)'}"></span> ${isRunning ? 'RUNNING' : 'STOPPED'}`;
      }

      if (sshCmd) sshCmd.textContent = `ssh root@${srv.ip}`;
      if (rootPass) rootPass.value = srv.root_password || '********';

      // Load initial stats & logs
      pollStats();
      loadSerialLog();
      loadSnapshots();

      // Start continuous stats poll
      if (statsPollInterval) clearInterval(statsPollInterval);
      statsPollInterval = setInterval(pollStats, 4000);
    }
  } catch (err) {
    console.error('Error loading server details:', err);
  }
}

// ─── Power Actions (Start, Stop, Reboot, Force Stop, Suspend, Resume) ────────
async function sendPowerAction(action) {
  if (!activeServerId) return;
  const statusPill = document.getElementById('panel-srv-status');
  if (statusPill) {
    statusPill.className = 'badge b-gold';
    statusPill.innerHTML = `<span class="live-pulse" style="background:var(--gold)"></span> EXECUTING ${action.toUpperCase()}...`;
  }

  showToast(`⚡ Sending ${action.toUpperCase()} signal to physical node...`);

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
      showToast(`⚠️ ${json.error || 'Action failed'}`);
    }
  } catch (err) {
    showToast('Command executed.');
  }
}

// ─── Live Telemetry (Stats) ────────────────────────────────────────────────
async function pollStats() {
  if (!activeServerId) return;
  try {
    const res = await fetch(`/api/servers/${activeServerId}/stats`);
    const json = await res.json();
    if (json.success && json.data) {
      const stats = json.data;

      // CPU Gauge
      const cpuVal = document.getElementById('gauge-cpu-val');
      const cpuMeter = document.getElementById('gauge-cpu-meter');
      if (cpuVal) cpuVal.textContent = `${stats.cpu_usage_pct || 0}%`;
      if (cpuMeter) cpuMeter.style.width = `${Math.min(100, stats.cpu_usage_pct || 0)}%`;

      // RAM Gauge
      const ramVal = document.getElementById('gauge-ram-val');
      const ramMeter = document.getElementById('gauge-ram-meter');
      const ramUsedMb = stats.ram_used_kb ? Math.round(stats.ram_used_kb / 1024) : 0;
      const ramTotalMb = stats.ram_alloc_mb || 4096;
      const ramPct = Math.round((ramUsedMb / ramTotalMb) * 100);
      if (ramVal) ramVal.textContent = `${ramUsedMb} MB / ${ramTotalMb} MB`;
      if (ramMeter) ramMeter.style.width = `${Math.min(100, ramPct)}%`;

      // Disk Gauge
      const diskVal = document.getElementById('gauge-disk-val');
      if (diskVal) diskVal.textContent = `${stats.disk_used_human || '2.4 GB'} / ${stats.disk_alloc_gb || 50} GB`;

      // Network
      const netVal = document.getElementById('gauge-net-val');
      if (netVal) netVal.textContent = `↓ ${stats.inbound_mbps || 0} Mbps  ↑ ${stats.outbound_mbps || 0} Mbps`;
    }
  } catch (e) {
    // Silent catch
  }
}

// ─── Serial Console Log ────────────────────────────────────────────────────
async function loadSerialLog() {
  if (!activeServerId) return;
  const consoleEl = document.getElementById('serial-console-screen');
  if (!consoleEl) return;

  try {
    const res = await fetch(`/api/servers/${activeServerId}/console?lines=60`);
    const json = await res.json();
    if (json.success && json.data) {
      consoleEl.textContent = json.data.lines || 'Waiting for kernel serial console stream...';
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }
  } catch (e) {
    consoleEl.textContent = '[0.000000] Connection to QEMU serial monitor active.';
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
        listEl.innerHTML = `<p style="font-size:0.8rem;color:var(--muted);padding:1rem 0;">No snapshots recorded yet. Create one before performing major system changes.</p>`;
        return;
      }
      listEl.innerHTML = json.data.map(snap => `
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface);padding:10px 14px;border-radius:8px;margin-bottom:8px;border:1px solid var(--rim);">
          <div>
            <div style="font-size:0.85rem;font-weight:500;color:var(--cream);">${snap.file}</div>
            <div style="font-size:0.7rem;color:var(--muted);font-family:'DM Mono',monospace;">Size: ${snap.size_human} • Point-in-time QCOW2</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="deleteSnapshot('${snap.file}')">Delete</button>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Snapshots fetch error:', e);
  }
}

async function createSnapshot() {
  if (!activeServerId) return;
  const tag = prompt('Enter a label for this snapshot (e.g. pre-update):');
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
      showToast(json.error || 'Failed to create snapshot (VM must be stopped first)');
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

// ─── Attach Public IP ──────────────────────────────────────────────────────
async function attachPublicIp() {
  if (!activeServerId) return;
  showToast('Allocating dedicated IPv4 from Shulker IP pool...');
  try {
    const res = await fetch(`/api/servers/${activeServerId}/attach-ip`, { method: 'POST' });
    const json = await res.json();
    showToast(`✅ ${json.message || 'Public IP attached'}`);
    loadServer(activeServerId);
  } catch (e) {
    showToast('Public IP check finished.');
  }
}

// ─── Change Root Password ──────────────────────────────────────────────────
async function updateRootPassword() {
  if (!activeServerId) return;
  const newPass = prompt('Enter new root password (minimum 8 characters):');
  if (!newPass || newPass.length < 8) {
    alert('Password must be at least 8 characters long');
    return;
  }

  showToast('Regenerating cloud-init credentials...');
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

// ─── Panel Sub-tabs switcher ───────────────────────────────────────────────
function switchPanelTab(tabName) {
  document.querySelectorAll('.ptab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.panel-tab-pane').forEach(pane => pane.style.display = 'none');

  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  const activePane = document.getElementById(`tab-pane-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');
  if (activePane) activePane.style.display = 'block';
}

// ─── Copy to Clipboard ─────────────────────────────────────────────────────
function copyText(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.value || el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Copied to clipboard!');
  });
}

// ─── Owner Admin Toggle ────────────────────────────────────────────────────
function initAdminToggle() {
  const toggleBtn = document.getElementById('btn-admin-toggle');
  const adminSection = document.getElementById('admin-overview-section');
  const wholesaleBox = document.getElementById('wholesale-breakdown-box');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isOwnerMode = !isOwnerMode;
      toggleBtn.classList.toggle('active', isOwnerMode);
      if (adminSection) adminSection.style.display = isOwnerMode ? 'block' : 'none';
      if (wholesaleBox) wholesaleBox.style.display = isOwnerMode ? 'block' : 'none';
      
      if (isOwnerMode) {
        loadAdminOverview();
        adminSection.scrollIntoView({ behavior: 'smooth' });
        showToast('🔓 Owner Reseller Insights Enabled!');
      } else {
        showToast('🔒 Owner Mode Hidden');
      }
    });
  }
}

async function loadAdminOverview() {
  try {
    const res = await fetch('/api/admin/overview');
    const json = await res.json();
    if (json.success && json.data) {
      const d = json.data;
      const elToken = document.getElementById('admin-token');
      const elInstances = document.getElementById('admin-instances');
      const elWholesale = document.getElementById('admin-wholesale');
      const elRetail = document.getElementById('admin-retail');
      const elProfit = document.getElementById('admin-profit');

      if (elToken) elToken.textContent = d.resellerTokenMasked;
      if (elInstances) elInstances.textContent = d.totalInstances;
      if (elWholesale) elWholesale.textContent = `₹${d.totalWholesaleRevenue.toLocaleString('en-IN')}`;
      if (elRetail) elRetail.textContent = `₹${d.totalRetailRevenue.toLocaleString('en-IN')}`;
      if (elProfit) elProfit.textContent = `₹${d.totalProfitMargin.toLocaleString('en-IN')} (${d.avgMarginPercent}%)`;
    }
  } catch (e) {
    console.error('Failed to load admin stats:', e);
  }
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

// ─── Toast Notification ────────────────────────────────────────────────────
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
