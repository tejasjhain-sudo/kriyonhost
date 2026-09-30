const fs = require('fs');
const path = require('path');
const discord = require('./discordService');

// Determine writable data path (supports local dev and Vercel serverless /tmp)
const isVercel = !!process.env.VERCEL || !!process.env.NOW_REGION;
const DATA_DIR = isVercel 
  ? path.join('/tmp', 'kryon_data') 
  : path.join(__dirname, '..', 'data');

const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

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

      if (fs.existsSync(ORDERS_FILE)) {
        const raw = fs.readFileSync(ORDERS_FILE, 'utf8');
        this.orders = JSON.parse(raw);
      } else {
        this.orders = [
          {
            id: 'KRYON-ORD-10482',
            created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
            expires_at: new Date(Date.now() - 3600 * 1000 * 24 + 300000).toISOString(),
            customer_name: 'Tejas Jha',
            customer_email: 'tejasjha.in@gmail.com',
            customer_phone: '+91 98765 43210',
            service_type: 'vps',
            plan_name: 'PWR Extreme (Ryzen 9 5.7GHz)',
            specs: {
              cpu: 6,
              ram: 16,
              disk: 120,
              tier: 'pwr',
              os: 'Ubuntu 24.04 LTS',
              region: 'India (Mumbai Tier-4)',
              server_name: 'srv-ender-alpha'
            },
            amount: 2499,
            payment_method: 'UPI Manual QR',
            upi_id: '8750287172@fam',
            utr_number: '427189012345',
            status: 'approved',
            server_details: {
              ip: '103.189.89.44',
              port: '22',
              username: 'root',
              password: 'EnderPass_892!x',
              os: 'Ubuntu 24.04 LTS',
              region: 'India (Mumbai)',
              allocated_at: new Date(Date.now() - 3600 * 1000 * 23).toISOString(),
              notes: 'Cloud VM online. Connect via SSH: ssh root@103.189.89.44'
            }
          }
        ];
        this.save();
      }
    } catch (err) {
      console.warn('[OrderService] Warning during storage initialization:', err.message);
      this.orders = [];
    }
  }

  save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(this.orders, null, 2), 'utf8');
    } catch (err) {
      console.warn('[OrderService] Save failed:', err.message);
    }
  }

  generateOrderId() {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `KRYON-ORD-${randomNum}`;
  }

  /**
   * Create a new pending manual order
   */
  createOrder(data) {
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
    this.save();

    // Trigger Discord notification in background
    discord.notifyOrderCreated(order).catch(() => {});

    return order;
  }

  /**
   * Customer submits UTR payment proof
   */
  submitPaymentProof(orderId, utrNumber, note = '') {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return null;

    order.utr_number = String(utrNumber).trim();
    order.payment_submitted_at = new Date().toISOString();
    order.status = 'pending_approval';
    if (note) order.customer_note = note;

    this.save();

    // Trigger Discord alert for immediate admin verification
    discord.notifyPaymentSubmitted(order).catch(() => {});

    return order;
  }

  /**
   * Retrieve order by ID
   */
  getOrder(orderId) {
    return this.orders.find(o => o.id === orderId) || null;
  }

  /**
   * Retrieve orders for a user email
   */
  getOrdersByUser(email) {
    if (!email) return [];
    const cleanEmail = email.trim().toLowerCase();
    return this.orders.filter(o => o.customer_email === cleanEmail);
  }

  /**
   * List all orders (Admin view)
   */
  getAllOrders(status = null) {
    if (status && status !== 'all') {
      return this.orders.filter(o => o.status === status);
    }
    return this.orders;
  }

  /**
   * Admin approves order & provides server details
   */
  approveOrder(orderId, serverDetails, adminNotes = '') {
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

    this.save();

    // Trigger Discord notification
    discord.notifyOrderApproved(order).catch(() => {});

    return order;
  }

  /**
   * Admin rejects order
   */
  rejectOrder(orderId, reason = 'Payment verification failed or UTR not found') {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return null;

    order.status = 'rejected';
    order.rejected_at = new Date().toISOString();
    order.rejection_reason = reason;

    this.save();

    // Trigger Discord notification
    discord.notifyOrderRejected(order, reason).catch(() => {});

    return order;
  }
}

module.exports = new OrderService();
