require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { TIERS, FLAT_IP_CHARGE, calculateWholesaleCost, calculateMargin, getFullQuote, POPULAR_PLANS } = require('./config/pricing');
const shulker = require('./services/shulkerService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    brand: process.env.BRAND_NAME || 'EnderHost',
    time: new Date().toISOString()
  });
});

// ─── Pricing & Quotes ──────────────────────────────────────────────────────
app.get('/api/pricing', (req, res) => {
  res.json({
    success: true,
    data: {
      tiers: TIERS,
      flatIpCharge: FLAT_IP_CHARGE,
      popularPlans: POPULAR_PLANS.map(plan => {
        const quote = getFullQuote(plan.tier, plan.cpu, plan.ram, plan.disk);
        return {
          ...plan,
          wholesaleCost: quote.totalWholesale,
          margin: quote.margin,
          retailPrice: quote.retailPrice
        };
      }),
      marginStrategy: [
        { range: 'Below ₹1,000 base', margin: '₹200 - ₹300 (Default: ₹260)' },
        { range: '₹1,000 - ₹2,000 base', margin: '₹350 - ₹500 (Default: ₹420)' },
        { range: '₹2,000 - ₹3,000 base', margin: '₹500 - ₹600 (Default: ₹580)' },
        { range: '₹3,000 - ₹4,000 base', margin: '₹1,000 - ₹1,200 (Default: ₹1,100)' },
        { range: 'Above ₹4,000 base', margin: '~30% margin' }
      ]
    }
  });
});

app.post('/api/pricing/quote', (req, res) => {
  try {
    const { tier, cpu, ram, disk, customMargin } = req.body;
    if (!tier || !cpu || !ram || !disk) {
      return res.status(400).json({ success: false, error: 'Missing required parameters: tier, cpu, ram, disk' });
    }
    const quote = getFullQuote(tier, Number(cpu), Number(ram), Number(disk), customMargin !== undefined ? Number(customMargin) : null);
    res.json({ success: true, data: quote });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Stock & Regions ───────────────────────────────────────────────────────
app.get('/api/stock', async (req, res) => {
  const tier = req.query.tier || null;
  const stock = await shulker.checkStock(tier);
  res.json(stock);
});

app.get('/api/regions', async (req, res) => {
  const regions = await shulker.listRegions(req.query.tier);
  res.json(regions);
});

// ─── Customer VPS Management ───────────────────────────────────────────────
app.get('/api/servers', async (req, res) => {
  try {
    const services = await shulker.listServices(req.query.status || 'all');
    res.json({ success: true, data: { services, count: services.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/servers/:id', async (req, res) => {
  try {
    const service = await shulker.getService(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    res.json({ success: true, data: service });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/servers/deploy', async (req, res) => {
  try {
    const { tier, cpu_cores, ram_gb, disk_gb, os, region, alias, type } = req.body;
    if (!tier || !cpu_cores || !ram_gb || !disk_gb) {
      return res.status(400).json({ success: false, error: 'Missing required specifications' });
    }

    const deployResult = await shulker.createInstance({
      tier,
      cpu_cores: Number(cpu_cores),
      ram_gb: Number(ram_gb),
      disk_gb: Number(disk_gb),
      os: os || 'ubuntu-2404',
      region: region || 'India',
      alias: alias || `${tier.toUpperCase()} Server`,
      type: type || 'vps'
    });

    res.json(deployResult);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Power & Lifecycle Actions ─────────────────────────────────────────────
app.post('/api/servers/:id/action', async (req, res) => {
  try {
    const { action } = req.body;
    const allowed = ['start', 'stop', 'force_stop', 'reboot', 'suspend', 'resume'];
    if (!allowed.includes(action)) {
      return res.status(400).json({ success: false, error: `Invalid action. Allowed: ${allowed.join(', ')}` });
    }

    const result = await shulker.vmAction(req.params.id, action);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Real-Time Stats ───────────────────────────────────────────────────────
app.get('/api/servers/:id/stats', async (req, res) => {
  try {
    const stats = await shulker.getStats(req.params.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Serial Console Logs ───────────────────────────────────────────────────
app.get('/api/servers/:id/console', async (req, res) => {
  try {
    const lines = req.query.lines ? Number(req.query.lines) : 100;
    const consoleData = await shulker.getSerialLog(req.params.id, lines);
    res.json({ success: true, data: consoleData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── VNC & RDP ─────────────────────────────────────────────────────────────
app.get('/api/servers/:id/vnc', async (req, res) => {
  try {
    const vnc = await shulker.getVncInfo(req.params.id);
    res.json({ success: true, data: vnc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/servers/:id/rdp', async (req, res) => {
  try {
    const rdp = await shulker.getRdpInfo(req.params.id);
    res.json({ success: true, data: rdp });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Snapshots ─────────────────────────────────────────────────────────────
app.get('/api/servers/:id/snapshots', async (req, res) => {
  try {
    const snapshots = await shulker.listSnapshots(req.params.id);
    res.json({ success: true, data: snapshots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/servers/:id/snapshots', async (req, res) => {
  try {
    const { tag } = req.body;
    const result = await shulker.createSnapshot(req.params.id, tag);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/servers/:id/snapshots/:tag', async (req, res) => {
  try {
    const result = await shulker.deleteSnapshot(req.params.id, req.params.tag);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Public IP ─────────────────────────────────────────────────────────────
app.post('/api/servers/:id/attach-ip', async (req, res) => {
  try {
    const result = await shulker.attachPublicIp(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Password & Credentials ────────────────────────────────────────────────
app.post('/api/servers/:id/password', async (req, res) => {
  try {
    const { root_password } = req.body;
    if (!root_password || root_password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
    }
    const result = await shulker.changeRootPassword(req.params.id, root_password);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Owner Reseller Admin Overview ─────────────────────────────────────────
app.get('/api/admin/overview', async (req, res) => {
  try {
    const services = await shulker.listServices('all');
    let totalWholesale = 0;
    let totalRetail = 0;

    services.forEach(s => {
      const quote = getFullQuote(s.service_tier || 'std', s.cpu_cores || 2, s.ram_gb || 4, s.disk_gb || 40);
      totalWholesale += quote.totalWholesale;
      totalRetail += quote.retailPrice;
    });

    const totalProfit = totalRetail - totalWholesale;

    res.json({
      success: true,
      data: {
        brand: process.env.BRAND_NAME || 'EnderHost',
        resellerTokenMasked: (process.env.RESELLER_TOKEN || '').slice(0, 4) + '...' + (process.env.RESELLER_TOKEN || '').slice(-4),
        totalInstances: services.length,
        totalWholesaleRevenue: Math.round(totalWholesale),
        totalRetailRevenue: Math.round(totalRetail),
        totalProfitMargin: Math.round(totalProfit),
        avgMarginPercent: totalRetail > 0 ? Math.round((totalProfit / totalRetail) * 100) : 0,
        activeRegions: ['India (Mumbai)', 'India (Delhi)', 'Germany (Frankfurt)'],
        ddosProtection: '92 Tbps Anycast Shield'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Wildcard route to serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 EnderHost Cloud Platform running at http://localhost:${PORT}`);
  console.log(`📡 Upstream Shulker Reseller API: Connected`);
  console.log(`💎 Brand: ${process.env.BRAND_NAME || 'EnderHost'}`);
  console.log(`======================================================\n`);
});
