/**
 * EnderHost Pricing & Reseller Margin Engine
 * Upstream provider: Shulker Cloud (billed from Purple Wallet)
 */

const TIERS = {
  eco: {
    id: 'eco',
    name: 'ECO Budget',
    nodeType: 'VPS-Eco',
    cpuBadge: 'Intel Xeon · Budget',
    description: 'Cost-effective compute for bots, microservices, proxies, and lightweight Minecraft SMPs.',
    clockSpeed: '2.6GHz - 3.2GHz',
    cpuPrice: 16,    // ₹16/mo per vCPU
    ramPrice: 26,    // ₹26/mo per GB RAM
    diskPrice: 0.26, // ₹0.26/mo per GB NVMe
    minSpecs: { cpu: 1, ram: 1, disk: 10 },
    maxSpecs: { cpu: 32, ram: 96, disk: 1000 },
    tag: 'Budget Friendly',
    badgeClass: 'b-green'
  },
  std: {
    id: 'std',
    name: 'STD Balanced',
    nodeType: 'VPS-Std',
    cpuBadge: 'AMD EPYC · Balanced',
    description: 'High-density multi-threaded enterprise nodes. Perfect for web apps, databases, and general servers.',
    clockSpeed: '3.4GHz All-Core Boost',
    cpuPrice: 26,    // ₹26/mo per vCPU
    ramPrice: 37,    // ₹37/mo per GB RAM
    diskPrice: 0.37, // ₹0.37/mo per GB NVMe
    minSpecs: { cpu: 1, ram: 1, disk: 10 },
    maxSpecs: { cpu: 32, ram: 96, disk: 1000 },
    tag: 'Most Popular',
    badgeClass: 'b-purple'
  },
  perf: {
    id: 'perf',
    name: 'PERF Compute',
    nodeType: 'VPS-Perf',
    cpuBadge: 'Intel Core i5/i7 · High Clock',
    description: 'High single-core clock speeds for latency-critical tasks, medium game networks, and CI/CD pipelines.',
    clockSpeed: '4.8GHz Turbo Clock',
    cpuPrice: 42,    // ₹42/mo per vCPU
    ramPrice: 53,    // ₹53/mo per GB RAM
    diskPrice: 0.53, // ₹0.53/mo per GB NVMe
    minSpecs: { cpu: 1, ram: 1, disk: 10 },
    maxSpecs: { cpu: 32, ram: 96, disk: 1000 },
    tag: 'High Clock Speed',
    badgeClass: 'b-blue'
  },
  pwr: {
    id: 'pwr',
    name: 'PWR Extreme',
    nodeType: 'VPS-Pwr',
    cpuBadge: 'AMD Ryzen 9 · Maximum Clock',
    description: 'Maximum single-thread IPC for modded Minecraft (Forge/Fabric), large communities, and heavy workloads.',
    clockSpeed: '5.7GHz Single Core Beast',
    cpuPrice: 58,    // ₹58/mo per vCPU
    ramPrice: 74,    // ₹74/mo per GB RAM
    diskPrice: 0.79, // ₹0.79/mo per GB NVMe
    minSpecs: { cpu: 1, ram: 1, disk: 10 },
    maxSpecs: { cpu: 32, ram: 96, disk: 1000 },
    tag: 'Extreme Power',
    badgeClass: 'b-gold'
  }
};

const FLAT_IP_CHARGE = 150; // ₹150 flat per VPS / server for dedicated public IPv4

/**
 * Calculate the wholesale cost from Shulker
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
 * Margin Strategy defined by EnderHost owner:
 * - Under ₹1000 base: ₹200 to ₹300 margin (default ₹260)
 * - ₹1000 - ₹2000 base: ₹350 to ₹500 margin (default ₹420)
 * - ₹2000 - ₹3000 base: ₹500 to ₹600 margin (default ₹580)
 * - ₹3000 - ₹4000 base: ₹1000 to ₹1200 margin (default ₹1100)
 * - > ₹4000 base: ~30% margin
 */
function calculateMargin(wholesaleCost) {
  if (wholesaleCost < 1000) {
    return 260;
  } else if (wholesaleCost < 2000) {
    return 420;
  } else if (wholesaleCost < 3000) {
    return 580;
  } else if (wholesaleCost <= 4000) {
    return 1100;
  } else {
    return Math.round(wholesaleCost * 0.30);
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
 * Pre-packaged popular server presets for VPS & Minecraft
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

module.exports = {
  TIERS,
  FLAT_IP_CHARGE,
  calculateWholesaleCost,
  calculateMargin,
  getFullQuote,
  POPULAR_PLANS
};
