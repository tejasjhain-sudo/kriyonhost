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
 * Adjusted down by ₹200 to ₹400 for aggressive market competitiveness:
 * - < ₹1,000 wholesale: ₹300 margin (down by ₹200)
 * - ₹1,000 to ₹2,500 wholesale: ₹600 margin (down by ₹250)
 * - ₹2,500 to ₹3,500 wholesale: ₹1,000 margin (down by ₹350)
 * - ₹3,500 to ₹5,000 wholesale (e.g. 8-core 40GB Ryzen 9): ₹1,450 margin (down by ₹400)
 * - > ₹5,000 wholesale: ₹1,800+ or 28% margin
 */
function calculateMargin(wholesaleCost) {
  if (wholesaleCost < 1000) {
    return 300;
  } else if (wholesaleCost < 2500) {
    return 600;
  } else if (wholesaleCost < 3500) {
    return 1000;
  } else if (wholesaleCost <= 5000) {
    return 1500;
  } else {
    return 1800;
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
 * Anycast Tunnels / DDoS Protected Network Tunnel Routing
 * Provider: Specialized Anti-DDoS Anycast Mesh
 */
const TUNNEL_PLANS = [
  {
    id: 'tunnel-starter',
    name: 'Starter Tunnel',
    tag: 'STARTER',
    price: 499,
    wholesaleCost: 249,
    margin: 250,
    players: 'Up to 15 players',
    networks: '1 Minecraft network',
    backends: '1 backend',
    popular: false,
    badgeClass: 'b-green',
    features: [
      'Up to 15 players',
      '1 Minecraft network',
      '1 backend',
      'L4/L7 DDoS protection',
      'Origin IP protection',
      'Protected hostname',
      'Basic analytics'
    ]
  },
  {
    id: 'tunnel-pro',
    name: 'Pro Tunnel',
    tag: 'PRO',
    price: 1499,
    wholesaleCost: 999,
    margin: 500,
    players: 'Up to 60 players',
    networks: '1 Minecraft network',
    backends: '2 backends',
    popular: true,
    badgeClass: 'b-purple',
    features: [
      'Up to 60 players',
      '2 backends',
      'Load balancing',
      'Advanced antibot protection',
      'Alerts / webhooks',
      'Traffic & player analytics',
      'Custom offline message'
    ]
  },
  {
    id: 'tunnel-advanced',
    name: 'Advanced Tunnel',
    tag: 'ADVANCED',
    price: 3499,
    wholesaleCost: 2499,
    margin: 1000,
    players: 'Up to 150 players',
    networks: 'Multiple networks',
    backends: '4 backends',
    popular: false,
    badgeClass: 'b-blue',
    features: [
      'Up to 150 players',
      '4 backends',
      'Advanced verification',
      'Firewall rules engine',
      'Real-time connection logs',
      'Full API access',
      'Advanced analytics suite'
    ]
  },
  {
    id: 'tunnel-network',
    name: 'Network Enterprise Tunnel',
    tag: 'NETWORK',
    price: 4999,
    wholesaleCost: 3499,
    margin: 1500,
    players: 'Up to 500 players',
    networks: 'Multiple protected networks',
    backends: '10 backends',
    popular: false,
    badgeClass: 'b-gold',
    features: [
      'Up to 500 players',
      '10 backends',
      'Multiple protected networks',
      'Geo-routing & Anycast edge',
      'Fallback / limbo server support',
      'Advanced threat mitigation',
      'Unlimited team seats'
    ]
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
