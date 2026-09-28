/**
 * EnderHost Pricing Engine
 * Synchronized with live upstream physical nodes
 */

const TIERS = {
  eco: {
    id: 'eco',
    name: 'ECO Budget',
    nodeType: 'Node-Eco (Xeon)',
    cpuBadge: 'Intel Xeon · Budget',
    description: 'Cost-effective compute for bots, microservices, proxies, and lightweight Minecraft SMPs.',
    clockSpeed: '2.6GHz - 3.2GHz',
    cpuPrice: 19.2,   // ₹19.20/mo per vCPU
    ramPrice: 31.2,   // ₹31.20/mo per GB RAM
    diskPrice: 0.312, // ₹0.312/mo per GB NVMe
    minSpecs: { cpu: 1, ram: 1, disk: 10 },
    maxSpecs: { cpu: 32, ram: 96, disk: 1000 },
    tag: 'Budget Friendly',
    badgeClass: 'b-green'
  },
  std: {
    id: 'std',
    name: 'STD Balanced',
    nodeType: 'Node-Std (EPYC)',
    cpuBadge: 'AMD EPYC · Balanced',
    description: 'High-density multi-threaded enterprise nodes. Perfect for web apps, databases, and general servers.',
    clockSpeed: '3.4GHz All-Core Boost',
    cpuPrice: 31.2,   // ₹31.20/mo per vCPU
    ramPrice: 44.4,   // ₹44.40/mo per GB RAM
    diskPrice: 0.444, // ₹0.444/mo per GB NVMe
    minSpecs: { cpu: 1, ram: 1, disk: 10 },
    maxSpecs: { cpu: 32, ram: 96, disk: 1000 },
    tag: 'Most Popular',
    badgeClass: 'b-purple'
  },
  perf: {
    id: 'perf',
    name: 'PERF Compute',
    nodeType: 'Node-Perf (i7)',
    cpuBadge: 'Intel Core i5/i7 · High Clock',
    description: 'High single-core clock speeds for latency-critical tasks, medium game networks, and CI/CD pipelines.',
    clockSpeed: '4.8GHz Turbo Clock',
    cpuPrice: 50.4,   // ₹50.40/mo per vCPU
    ramPrice: 63.6,   // ₹63.60/mo per GB RAM
    diskPrice: 0.636, // ₹0.636/mo per GB NVMe
    minSpecs: { cpu: 1, ram: 1, disk: 10 },
    maxSpecs: { cpu: 32, ram: 96, disk: 1000 },
    tag: 'High Clock Speed',
    badgeClass: 'b-blue'
  },
  pwr: {
    id: 'pwr',
    name: 'PWR Extreme',
    nodeType: 'Node-Pwr (Ryzen 9)',
    cpuBadge: 'AMD Ryzen 9 · Maximum Clock',
    description: 'Maximum single-thread IPC for modded Minecraft (Forge/Fabric), large communities, and heavy workloads.',
    clockSpeed: '5.7GHz Single Core Beast',
    cpuPrice: 69.6,   // ₹69.60/mo per vCPU
    ramPrice: 88.8,   // ₹88.80/mo per GB RAM
    diskPrice: 0.948, // ₹0.948/mo per GB NVMe
    minSpecs: { cpu: 1, ram: 1, disk: 10 },
    maxSpecs: { cpu: 32, ram: 96, disk: 1000 },
    tag: 'Extreme Power',
    badgeClass: 'b-gold'
  }
};

const FLAT_IP_CHARGE = 150; // ₹150 flat per VPS / dedicated IP

/**
 * Calculate the wholesale cost directly from hypervisor rates
 */
function calculateWholesaleCost(tierKey, cpuCores, ramGb, diskGb) {
  const tier = TIERS[tierKey] || TIERS.std;
  const cpuCost = cpuCores * tier.cpuPrice;
  const ramCost = ramGb * tier.ramPrice;
  const diskCost = diskGb * tier.diskPrice;
  const rawCost = cpuCost + ramCost + diskCost + FLAT_IP_CHARGE;
  return {
    tierKey: tier.id,
    tierName: tier.name,
    cpuCost: Math.round(cpuCost * 100) / 100,
    ramCost: Math.round(ramCost * 100) / 100,
    diskCost: Math.round(diskCost * 100) / 100,
    ipCharge: FLAT_IP_CHARGE,
    totalWholesale: Math.round(rawCost * 100) / 100
  };
}

/**
 * Margin Strategy:
 * User requested:
 * - At least ₹500 in cheap servers
 * - ₹1,000 to ₹2,000+ margin in expensive servers
 *
 * Curve:
 * - < ₹1,000 wholesale: ₹500 margin
 * - ₹1,000 to ₹2,500 wholesale: ₹850 margin
 * - ₹2,500 to ₹3,500 wholesale: ₹1,350 margin
 * - ₹3,500 to ₹5,000 wholesale (e.g. 8-core 40GB Ryzen 9 @ ₹4.4k): ₹1,850 margin
 * - > ₹5,000 wholesale: ₹2,400+ or 35% margin
 */
function calculateMargin(wholesaleCost) {
  if (wholesaleCost < 1000) {
    return 500;
  } else if (wholesaleCost < 2500) {
    return 850;
  } else if (wholesaleCost < 3500) {
    return 1350;
  } else if (wholesaleCost <= 5000) {
    return 1850;
  } else {
    return Math.max(2200, Math.round(wholesaleCost * 0.35));
  }
}

/**
 * Full quote generator
 */
function getFullQuote(tierKey, cpuCores, ramGb, diskGb, customMargin = null) {
  const breakdown = calculateWholesaleCost(tierKey, cpuCores, ramGb, diskGb);
  const margin = customMargin !== null ? Number(customMargin) : calculateMargin(breakdown.totalWholesale);
  const retailPrice = Math.round(breakdown.totalWholesale + margin);
  const marginPercent = Math.round((margin / retailPrice) * 1000) / 10;

  return {
    ...breakdown,
    margin,
    marginPercent,
    retailPrice
  };
}

/**
 * Pre-configured Server Plans
 */
const POPULAR_PLANS = [
  {
    id: 'starter-eco',
    name: 'Starter Cloud',
    category: 'General / Micro VPS',
    tier: 'eco',
    cpu: 2,
    ram: 4,
    disk: 40,
    features: ['2 vCPU Intel Xeon', '4 GB DDR4 ECC RAM', '40 GB NVMe Storage', '1 Dedicated IPv4', '92 Tbps DDoS Shield', 'Instant 3s Deployment'],
    popular: false,
    recommendedFor: 'Discord bots, Python APIs, small web proxies'
  },
  {
    id: 'balanced-std',
    name: 'EPYC Balanced',
    category: 'Cloud VPS & Vanilla SMP',
    tier: 'std',
    cpu: 4,
    ram: 8,
    disk: 80,
    features: ['4 vCPU AMD EPYC 7003', '8 GB High-Speed RAM', '80 GB Enterprise NVMe', '1 Dedicated IPv4', '92 Tbps DDoS Shield', 'Sub-3s Provisioning'],
    popular: true,
    recommendedFor: 'Production websites, Docker stacks, 15-player Minecraft SMP'
  },
  {
    id: 'pro-perf',
    name: 'High Clock Beast',
    category: 'Game Networks & Heavy Apps',
    tier: 'perf',
    cpu: 6,
    ram: 16,
    disk: 150,
    features: ['6 vCPU Intel i7 (4.8GHz Turbo)', '16 GB High-Freq RAM', '150 GB Gen4 NVMe', '1 Dedicated IPv4', '92 Tbps Anti-DDoS Game Shield', 'Serial Log & VNC Access'],
    popular: false,
    recommendedFor: 'BungeeCord networks, heavy databases, 40+ player servers'
  },
  {
    id: 'ryzen-ultimate',
    name: 'Ryzen 9 Extreme',
    category: 'Modded Minecraft & Max Performance',
    tier: 'pwr',
    cpu: 8,
    ram: 32,
    disk: 250,
    features: ['8 vCPU AMD Ryzen 9 (5.7GHz)', '32 GB Ultra-Fast RAM', '250 GB Gen4 NVMe Storage', '1 Dedicated IPv4', 'Enterprise DDoS Mitigation', 'Snapshot & Extra Disk Support'],
    popular: false,
    recommendedFor: 'All The Mods 9, ATM8, RLCraft, Large Network Hubs'
  }
];

/**
 * Anycast Tunnels / Tunnel Routing Server (₹1,200 INR with ₹720 margin)
 */
const TUNNEL_PLANS = [
  {
    id: 'tunnel-pro',
    name: 'Ender Anycast Tunnel Pro',
    category: 'TCP / UDP Tunnel Routing',
    price: 1200,
    wholesaleCost: 480,
    margin: 720,
    features: [
      'Dedicated Static Public IPv4 Endpoint',
      'Ultra-Low-Latency Anycast Routing (<10ms India)',
      'TCP & UDP Traffic Acceleration',
      'Unlimited Bandwidth (No Fair Usage Cap)',
      '92 Tbps L3/L4 DDoS Mitigation Shield',
      'Expose Local Minecraft, Discord Bots & Web Apps',
      'Custom Subdomain (yourname.ender.link) or Custom Domain',
      'WireGuard / WebSocket Wire Protocol'
    ],
    popular: true,
    tag: 'Best for Gamers & Developers'
  }
];

/**
 * NVMe Cloud Web Hosting Plans
 */
const WEB_HOSTING_PLANS = [
  {
    id: 'web-starter',
    name: 'Starter Web',
    price: 249,
    wholesaleCost: 99,
    margin: 150,
    storage: '15 GB NVMe',
    websites: '1 Website',
    bandwidth: 'Unmetered',
    features: ['1 Hosted Website', '15 GB Gen4 NVMe', 'Free SSL Certificates', 'Unlimited Bandwidth', 'cPanel / DirectAdmin / Nginx', 'Free Business Email', '99.9% Hardware SLA']
  },
  {
    id: 'web-pro',
    name: 'Business Pro Web',
    price: 499,
    wholesaleCost: 199,
    margin: 300,
    storage: '50 GB NVMe',
    websites: '5 Websites',
    bandwidth: 'Unmetered',
    popular: true,
    features: ['5 Hosted Websites', '50 GB Gen4 NVMe', 'Free Wildcard SSL', 'Unlimited Business Emails', 'Automated Daily Backups', 'Node.js & Python 3.12 Engine', 'Redis Object Caching']
  },
  {
    id: 'web-enterprise',
    name: 'Enterprise Ultra Web',
    price: 999,
    wholesaleCost: 399,
    margin: 600,
    storage: '150 GB NVMe',
    websites: 'Unlimited Websites',
    bandwidth: 'Unmetered',
    features: ['Unlimited Websites', '150 GB Gen4 NVMe Storage', 'Dedicated IP Address', 'Priority LSCache Engine', 'Daily Off-Site Snapshots', 'Staging Environments', '24/7 Dedicated Support']
  }
];

module.exports = {
  TIERS,
  FLAT_IP_CHARGE,
  calculateWholesaleCost,
  calculateMargin,
  getFullQuote,
  POPULAR_PLANS,
  TUNNEL_PLANS,
  WEB_HOSTING_PLANS
};
