const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const discord = require('./discordService');

// Supabase client for global order persistence across Vercel lambdas
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gqxacwybumcroargnwkq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeGFjd3lidW1jcm9hcmdud2txIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDYxNzUzOSwiZXhwIjoyMTA2MTkzNTM5fQ.5xea24fdKrZBXYUDlGjw6TB4SzXbmkDP_rtrP0NIwB4';
const BUCKET_NAME = 'kryon_orders';
const REMOTE_ORDERS_FILE = 'orders.json';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Determine writable local data path (supports local dev and Vercel serverless /tmp)
const isVercel = !!process.env.VERCEL || !!process.env.NOW_REGION;
const DATA_DIR = isVercel 
  ? path.join('/tmp', 'kryon_data') 
  : path.join(__dirname, '..', 'data');

const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const BUNDLED_ORDERS_FILE = path.join(__dirname, '..', 'data', 'orders.json');

class OrderService {
  constructor() {
    this.orders = [];
    this.initStorage();
  }

  initStorage() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // Check writable local orders file first
      if (fs.existsSync(ORDERS_FILE)) {
        const raw = fs.readFileSync(ORDERS_FILE, 'utf8');
        this.orders = JSON.parse(raw);
      } else if (fs.existsSync(BUNDLED_ORDERS_FILE)) {
        // Fallback to bundled repo data/orders.json
        const raw = fs.readFileSync(BUNDLED_ORDERS_FILE, 'utf8');
        this.orders = JSON.parse(raw);
        this.saveLocal();
      } else {
        this.orders = [];
      }
    } catch (err) {
      console.warn('[OrderService] Warning during local storage initialization:', err.message);
      this.orders = [];
    }

    // Trigger async remote sync on startup
    this.syncFromRemote().catch(() => {});
  }

  /**
   * Synchronize orders from Supabase Storage bucket kryon_orders/orders.json
   */
  async syncFromRemote() {
    try {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).download(REMOTE_ORDERS_FILE);
      if (error) {
        if (!this.orders || this.orders.length === 0) {
          if (fs.existsSync(BUNDLED_ORDERS_FILE)) {
            try {
              this.orders = JSON.parse(fs.readFileSync(BUNDLED_ORDERS_FILE, 'utf8'));
            } catch (e) {}
          }
        }
        return this.orders || [];
      }

      if (data) {
        let text = '';
        if (typeof data.text === 'function') {
          text = await data.text();
        } else if (Buffer.isBuffer(data)) {
          text = data.toString('utf8');
        } else if (data.arrayBuffer) {
          const ab = await data.arrayBuffer();
          text = Buffer.from(ab).toString('utf8');
        }
        
        if (text) {
          const remoteOrders = JSON.parse(text);
          if (Array.isArray(remoteOrders) && remoteOrders.length > 0) {
            this.orders = remoteOrders;
            this.saveLocal();
          }
        }
      }
    } catch (err) {
      console.warn('[OrderService] Remote sync warning:', err.message);
      if (!this.orders || this.orders.length === 0) {
        if (fs.existsSync(BUNDLED_ORDERS_FILE)) {
          try {
            this.orders = JSON.parse(fs.readFileSync(BUNDLED_ORDERS_FILE, 'utf8'));
          } catch (e) {}
        }
      }
    }
    return this.orders || [];
  }

  saveLocal() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(this.orders, null, 2), 'utf8');
    } catch (err) {
      console.warn('[OrderService] Local save failed:', err.message);
    }
  }

  async saveRemote() {
    try {
      const jsonContent = JSON.stringify(this.orders, null, 2);
      await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(REMOTE_ORDERS_FILE, jsonContent, { 
          upsert: true, 
          cacheControl: '0',
          contentType: 'application/json' 
        });
    } catch (err) {
      console.warn('[OrderService] Remote save failed:', err.message);
    }
  }

  async save() {
    this.saveLocal();
    await this.saveRemote();
  }

  generateOrderId() {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `KRYON-ORD-${randomNum}`;
  }

  /**
   * Create a new pending manual order
   */
  async createOrder(data) {
    await this.syncFromRemote();
    const orderId = this.generateOrderId();
    const now = Date.now();
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString(); // 5 minute timer

    const order = {
      id: orderId,
      created_at: new Date(now).toISOString(),
      expires_at: expiresAt,
      customer_name: data.customer_name || 'Anonymous Client',
      customer_email: (data.customer_email || '').trim().toLowerCase(),
      customer_phone: data.customer_phone || '',
      service_type: data.service_type || 'vps',
      plan_name: data.plan_name || 'Custom Cloud Plan',
      specs: data.specs || {},
      amount: Number(data.amount) || 999,
      currency: 'INR',
      payment_method: 'UPI Manual QR',
      upi_id: process.env.UPI_ID || '8750287172@fam',
      qr_image_url: '/images/upi-qr.png',
      utr_number: null,
      status: 'pending_payment',
      server_details: null,
      admin_notes: null
    };

    this.orders.unshift(order);
    await this.save();

    // Trigger Discord notification in background
    discord.notifyOrderCreated(order).catch(() => {});

    return order;
  }

  /**
   * Customer submits UTR payment proof, Sender UPI ID & Screenshot
   */
  async submitPaymentProof(orderId, paymentData) {
    await this.syncFromRemote();
    let order = this.orders.find(o => o.id === orderId);

    // If order was not found in initial sync, retry once
    if (!order) {
      await new Promise(r => setTimeout(r, 300));
      await this.syncFromRemote();
      order = this.orders.find(o => o.id === orderId);
    }

    // Auto-recovery: If client has the order object in session
    if (!order && paymentData && paymentData.order_backup) {
      order = { ...paymentData.order_backup };
      this.orders.unshift(order);
    }

    if (!order) {
      return { success: false, error: 'Order not found. Please refresh and try again.' };
    }

    let utrNumber = '';
    let senderUpiId = '';
    let screenshotUrl = '';
    let screenshotData = '';
    let note = '';

    if (typeof paymentData === 'object' && paymentData !== null) {
      utrNumber = paymentData.utr_number || '';
      senderUpiId = paymentData.sender_upi_id || '';
      screenshotUrl = paymentData.screenshot_url || '';
      screenshotData = paymentData.screenshot_data || '';
      note = paymentData.note || '';
    } else {
      utrNumber = paymentData;
    }

    const cleanUtr = String(utrNumber).trim();

    // Anti-fraud check
    const existingUtr = this.orders.find(o => o.id !== orderId && o.utr_number === cleanUtr && (o.status === 'approved' || o.status === 'pending_approval'));
    if (existingUtr) {
      return { 
        success: false, 
        error: 'This UPI UTR / Transaction Reference has already been submitted for order #' + existingUtr.id + '. Duplicate submissions are not permitted.' 
      };
    }

    order.utr_number = cleanUtr;
    order.sender_upi_id = String(senderUpiId).trim() || null;
    order.screenshot_url = screenshotUrl || null;
    order.screenshot_data = screenshotData || null;
    order.payment_submitted_at = new Date().toISOString();
    order.status = 'pending_approval';
    if (note) order.customer_note = note;

    await this.save();

    // Trigger Discord alert for immediate admin verification
    discord.notifyPaymentSubmitted(order).catch(() => {});

    return { success: true, data: order };
  }

  /**
   * Retrieve order by ID
   */
  async getOrder(orderId) {
    await this.syncFromRemote();
    return this.orders.find(o => o.id === orderId) || null;
  }

  /**
   * Retrieve orders for a user email
   */
  async getOrdersByUser(email) {
    if (!email) return [];
    await this.syncFromRemote();
    const cleanEmail = email.trim().toLowerCase();
    return this.orders.filter(o => o.customer_email === cleanEmail);
  }

  /**
   * List all orders (Admin view)
   */
  async getAllOrders(status = null) {
    await this.syncFromRemote();
    if (status && status !== 'all') {
      return this.orders.filter(o => o.status === status);
    }
    return this.orders;
  }

  /**
   * Admin approves order & provides server details
   */
  async approveOrder(orderId, serverDetails, adminNotes = '') {
    await this.syncFromRemote();
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return null;

    order.status = 'approved';
    order.approved_at = new Date().toISOString();
    order.admin_notes = adminNotes;
    order.server_details = {
      ip: serverDetails.ip || '103.189.89.100',
      port: serverDetails.port || (order.service_type === 'minecraft' ? '25565' : '22'),
      username: serverDetails.username || (order.service_type === 'minecraft' ? 'admin' : 'root'),
      password: serverDetails.password || 'KryonSecure_' + Math.random().toString(36).slice(-6) + '!',
      os: serverDetails.os || order.specs?.os || 'Ubuntu 24.04 LTS',
      region: serverDetails.region || order.specs?.region || 'India (Mumbai)',
      allocated_at: new Date().toISOString(),
      notes: serverDetails.notes || 'Your server is active and online!'
    };

    await this.save();

    // Trigger Discord notification
    discord.notifyOrderApproved(order).catch(() => {});

    return order;
  }

  /**
   * Admin rejects order
   */
  async rejectOrder(orderId, reason = 'Payment verification failed or UTR not found') {
    await this.syncFromRemote();
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return null;

    order.status = 'rejected';
    order.rejected_at = new Date().toISOString();
    order.rejection_reason = reason;

    await this.save();

    // Trigger Discord notification
    discord.notifyOrderRejected(order, reason).catch(() => {});

    return order;
  }
}

module.exports = new OrderService();
