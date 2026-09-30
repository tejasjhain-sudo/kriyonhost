const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const storage = require('./storageService');
const orderService = require('./orderService');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gqxacwybumcroargnwkq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeGFjd3lidW1jcm9hcmdud2txIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDYxNzUzOSwiZXhwIjoyMTA2MTkzNTM5fQ.5xea24fdKrZBXYUDlGjw6TB4SzXbmkDP_rtrP0NIwB4';
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const isVercel = !!process.env.VERCEL || !!process.env.NOW_REGION;
const DATA_DIR = isVercel ? path.join('/tmp', 'kryon_data') : path.join(__dirname, '..', 'data');
const SUSPENSIONS_FILE = path.join(DATA_DIR, 'service_suspensions.json');

class AdminService {
  constructor() {
    this.suspensionOverrides = {};
    this.loadSuspensions();
  }

  loadSuspensions() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (fs.existsSync(SUSPENSIONS_FILE)) {
        this.suspensionOverrides = JSON.parse(fs.readFileSync(SUSPENSIONS_FILE, 'utf8'));
      }
    } catch (e) {
      this.suspensionOverrides = {};
    }
  }

  saveSuspensions() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(SUSPENSIONS_FILE, JSON.stringify(this.suspensionOverrides, null, 2));
    } catch (e) {}
  }

  /**
   * Get all servers and services across all users on the platform
   */
  async getAllServices() {
    this.loadSuspensions();
    const services = [];

    // 1. Fetch Supabase Servers
    try {
      const { data: dbServers, error } = await supabaseAdmin.from('servers').select('*').order('created_at', { ascending: false });
      if (!error && Array.isArray(dbServers)) {
        for (const s of dbServers) {
          const override = this.suspensionOverrides[s.id] || {};
          services.push({
            id: s.id,
            name: s.service_alias || 'Cloud Server',
            user_email: s.user_email || 'client@example.com',
            user_id: s.user_id,
            service_type: s.service_type || 'vps',
            service_tier: s.service_tier || 'std',
            status: override.status || s.status || 'running',
            ip: s.ip || '103.189.89.x',
            region: s.region || 'India (Mumbai)',
            os: s.os || 'Ubuntu 24.04 LTS',
            cpu_cores: s.cpu_cores || 2,
            ram_gb: s.ram_gb || 4,
            disk_gb: s.disk_gb || 40,
            price: Number(s.price) || 0,
            created_at: s.created_at || new Date().toISOString(),
            auto_suspend_at: override.auto_suspend_at !== undefined ? override.auto_suspend_at : s.auto_suspend_at,
            suspended_at: override.suspended_at || s.suspended_at || null,
            suspension_reason: override.suspension_reason || s.suspension_reason || null,
            source: 'supabase'
          });
        }
      }
    } catch (err) {
      console.warn('[AdminService] Supabase servers fetch error:', err.message);
    }

    // 2. Fetch User-Deployed SDX Storage Nodes
    try {
      const allNodes = storage.listAllNodes();
      for (const node of allNodes) {
        if (node.isTrial || node.id.startsWith('prod-') || node.id.startsWith('trial-')) {
          const override = this.suspensionOverrides[node.id] || {};
          services.push({
            id: node.id,
            name: node.name || 'SDX Storage Bucket',
            user_email: node.user || 'Guest Client',
            service_type: 'sdx',
            service_tier: node.isTrial ? 'Free Trial' : 'Production',
            status: override.status || (node.isExpired ? 'suspended' : 'running'),
            ip: node.region ? `${node.region}.sdx.kryonhost.com` : 'in-north-1.shulker.in',
            region: node.location || 'India North',
            os: 'SDX Object Store v1.0',
            cpu_cores: 1,
            ram_gb: 2,
            disk_gb: node.maxQuotaGb || 10,
            price: node.isTrial ? 0 : 99,
            created_at: node.createdDate || new Date().toISOString(),
            auto_suspend_at: override.auto_suspend_at || (node.expiresAt ? new Date(node.expiresAt).toISOString() : null),
            suspended_at: override.suspended_at || null,
            suspension_reason: override.suspension_reason || (node.isExpired ? '2-Hour Free Trial Expired' : null),
            source: 'sdx'
          });
        }
      }
    } catch (err) {
      console.warn('[AdminService] SDX nodes fetch error:', err.message);
    }

    // 3. Fetch Approved / Active Orders (if not already matched)
    try {
      const allOrders = await orderService.getAllOrders();
      for (const ord of allOrders) {
        if (ord.status === 'approved' && ord.server_details) {
          const serviceId = `ord-${ord.id}`;
          // Check if this order is already in the list
          const exists = services.some(s => s.id === serviceId || s.ip === ord.server_details.ip);
          if (!exists) {
            const override = this.suspensionOverrides[serviceId] || {};
            services.push({
              id: serviceId,
              name: ord.specs?.server_name || ord.plan_name || 'Provisioned Instance',
              user_email: ord.customer_email || 'client@example.com',
              service_type: ord.service_type || 'vps',
              service_tier: ord.specs?.tier || 'std',
              status: override.status || 'running',
              ip: ord.server_details.ip || '103.189.89.x',
              region: ord.server_details.region || 'India (Mumbai)',
              os: ord.server_details.os || 'Ubuntu 24.04 LTS',
              cpu_cores: Number(ord.specs?.cpu) || 2,
              ram_gb: Number(ord.specs?.ram) || 4,
              disk_gb: Number(ord.specs?.disk) || 40,
              price: Number(ord.amount) || 0,
              created_at: ord.created_at || new Date().toISOString(),
              auto_suspend_at: override.auto_suspend_at || null,
              suspended_at: override.suspended_at || null,
              suspension_reason: override.suspension_reason || null,
              source: 'order'
            });
          }
        }
      }
    } catch (err) {
      console.warn('[AdminService] Orders fetch error:', err.message);
    }

    return services;
  }

  /**
   * Update service status manually (running, suspended, stopped)
   */
  async updateServiceStatus(serviceId, newStatus, reason = null) {
    this.loadSuspensions();
    const now = new Date().toISOString();

    if (!this.suspensionOverrides[serviceId]) {
      this.suspensionOverrides[serviceId] = {};
    }

    this.suspensionOverrides[serviceId].status = newStatus;
    if (newStatus === 'suspended') {
      this.suspensionOverrides[serviceId].suspended_at = now;
      this.suspensionOverrides[serviceId].suspension_reason = reason || 'Suspended manually by Administrator';
    } else if (newStatus === 'running') {
      this.suspensionOverrides[serviceId].suspended_at = null;
      this.suspensionOverrides[serviceId].suspension_reason = null;
    }
    this.saveSuspensions();

    // If Supabase server, update table directly
    try {
      await supabaseAdmin.from('servers').update({
        status: newStatus,
        suspended_at: newStatus === 'suspended' ? now : null,
        suspension_reason: newStatus === 'suspended' ? (reason || 'Suspended by Administrator') : null
      }).eq('id', serviceId);
    } catch (e) {}

    return {
      success: true,
      serviceId,
      status: newStatus,
      message: `Service status updated to '${newStatus}'`
    };
  }

  /**
   * Set or clear scheduled auto-suspend date and time
   */
  async setAutoSuspend(serviceId, autoSuspendAt, reason = null) {
    this.loadSuspensions();

    if (!this.suspensionOverrides[serviceId]) {
      this.suspensionOverrides[serviceId] = {};
    }

    this.suspensionOverrides[serviceId].auto_suspend_at = autoSuspendAt || null;
    if (reason) {
      this.suspensionOverrides[serviceId].scheduled_reason = reason;
    }
    this.saveSuspensions();

    // If Supabase server, update record
    try {
      await supabaseAdmin.from('servers').update({
        auto_suspend_at: autoSuspendAt || null
      }).eq('id', serviceId);
    } catch (e) {}

    return {
      success: true,
      serviceId,
      auto_suspend_at: autoSuspendAt,
      message: autoSuspendAt 
        ? `Auto-suspend scheduled for ${new Date(autoSuspendAt).toLocaleString('en-IN')}`
        : 'Auto-suspend schedule cleared'
    };
  }

  /**
   * Scan and automatically suspend services whose scheduled auto_suspend_at is in the past
   */
  async checkAndRunAutoSuspends() {
    this.loadSuspensions();
    const now = Date.now();
    const suspendedList = [];

    // Check all recorded overrides
    for (const [id, meta] of Object.entries(this.suspensionOverrides)) {
      if (meta.auto_suspend_at && meta.status !== 'suspended') {
        const suspendTime = new Date(meta.auto_suspend_at).getTime();
        if (now >= suspendTime) {
          meta.status = 'suspended';
          meta.suspended_at = new Date().toISOString();
          meta.suspension_reason = meta.scheduled_reason || 'Auto-suspended on scheduled expiry date/time';
          suspendedList.push(id);

          // Update Supabase
          try {
            await supabaseAdmin.from('servers').update({
              status: 'suspended',
              suspended_at: meta.suspended_at,
              suspension_reason: meta.suspension_reason
            }).eq('id', id);
          } catch (e) {}
        }
      }
    }

    if (suspendedList.length > 0) {
      this.saveSuspensions();
      console.log(`[Auto-Suspend Engine] Automatically suspended ${suspendedList.length} overdue services:`, suspendedList);
    }

    return {
      success: true,
      suspendedCount: suspendedList.length,
      suspendedIds: suspendedList
    };
  }
}

const adminService = new AdminService();

// Run periodic auto-suspend check every 30 seconds
setInterval(() => {
  adminService.checkAndRunAutoSuspends().catch(() => {});
}, 30000);

module.exports = adminService;
