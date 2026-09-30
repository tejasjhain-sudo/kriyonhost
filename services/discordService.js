/**
 * Discord Notification Service for KryonHost
 * Sends rich embedded notifications to Discord when orders are created,
 * payments are submitted with UTR, and servers are approved/provisioned.
 */

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

class DiscordService {
  constructor() {
    this.webhookUrl = DISCORD_WEBHOOK_URL;
  }

  async sendEmbed({ title, description, color = 0x7c6aff, fields = [], footer = null, url = null }) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL || this.webhookUrl;
    if (!webhookUrl) {
      console.log(`[Discord Bot Log] ${title}: ${description}`);
      return false;
    }

    try {
      const payload = {
        username: 'KryonHost NOC Bot',
        avatar_url: 'https://kriyonhost.vercel.app/images/logo.jpg',
        embeds: [
          {
            title: title,
            description: description,
            color: color,
            fields: fields,
            url: url || 'https://kriyonhost.vercel.app/admin',
            footer: footer || { text: 'KryonHost Automated Order System • India Tier-4' },
            timestamp: new Date().toISOString()
          }
        ]
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.warn(`[Discord Webhook] Returned HTTP ${response.status}`);
        return false;
      }

      console.log(`[Discord Webhook] Notification dispatched for ${title}`);
      return true;
    } catch (err) {
      console.warn(`[Discord Webhook Warning] Could not send alert:`, err.message);
      return false;
    }
  }

  /**
   * Notify when new order is created
   */
  async notifyOrderCreated(order) {
    return await this.sendEmbed({
      title: `⚡ New Order Placed: #${order.id}`,
      description: `A customer has configured an order and is on the manual billing screen.`,
      color: 0x38bdf8, // Sky blue
      fields: [
        { name: 'Customer', value: `${order.customer_name} (${order.customer_email})`, inline: true },
        { name: 'Amount', value: `₹${order.amount.toLocaleString('en-IN')}`, inline: true },
        { name: 'Service Plan', value: `${order.plan_name} (${(order.service_type || 'vps').toUpperCase()})`, inline: true },
        { name: 'Specifications', value: `${order.specs?.cpu || 2} vCPU · ${order.specs?.ram || 4}GB RAM · ${order.specs?.disk || 40}GB NVMe`, inline: false },
        { name: 'Status', value: '⏳ Awaiting UPI Payment (5m window)', inline: true }
      ]
    });
  }

  /**
   * Notify when customer submits UTR payment reference
   */
  async notifyPaymentSubmitted(order) {
    return await this.sendEmbed({
      title: `🚨 Payment Proof Submitted — Action Required!`,
      description: `Customer submitted 12-digit UTR for order **#${order.id}**. Please verify the bank credit and assign server details in the Admin Center.`,
      color: 0xf59e0b, // Amber / Alert
      fields: [
        { name: 'Order ID', value: `#${order.id}`, inline: true },
        { name: 'Customer', value: `${order.customer_name}\n\`${order.customer_email}\``, inline: true },
        { name: 'Amount Paid', value: `**₹${order.amount.toLocaleString('en-IN')}**`, inline: true },
        { name: 'UTR Reference ID', value: `\`\`\`${order.utr_number}\`\`\``, inline: false },
        { name: 'Service Plan', value: `${order.plan_name} (${order.specs?.os || 'Ubuntu 24.04'})`, inline: true },
        { name: 'Action', value: '[Click Here to Open Admin Control Center](https://kriyonhost.vercel.app/admin)', inline: true }
      ]
    });
  }

  /**
   * Notify when order is approved and server is provisioned
   */
  async notifyOrderApproved(order) {
    return await this.sendEmbed({
      title: `✅ Order Approved & Server Delivered: #${order.id}`,
      description: `Administrator approved payment and assigned server node to client.`,
      color: 0x22c55e, // Emerald Green
      fields: [
        { name: 'Client Email', value: `\`${order.customer_email}\``, inline: true },
        { name: 'Plan', value: order.plan_name, inline: true },
        { name: 'Assigned IP', value: `\`${order.server_details?.ip}\`:${order.server_details?.port || 22}`, inline: true },
        { name: 'Root Username', value: `\`${order.server_details?.username || 'root'}\``, inline: true },
        { name: 'Status', value: '🟢 Active & Online in Client Dashboard', inline: true }
      ]
    });
  }

  /**
   * Notify when order is rejected
   */
  async notifyOrderRejected(order, reason) {
    return await this.sendEmbed({
      title: `❌ Order Rejected: #${order.id}`,
      description: `Order was rejected by administrator.`,
      color: 0xef4444, // Red
      fields: [
        { name: 'Client Email', value: order.customer_email, inline: true },
        { name: 'Reason', value: reason || 'Invalid UTR reference number', inline: false }
      ]
    });
  }
}

module.exports = new DiscordService();
