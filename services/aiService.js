const fs = require('fs');
const path = require('path');

const STORE_PATH = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? path.join('/tmp', 'ai_keys_store.json')
  : path.join(__dirname, '..', 'config', 'ai_keys_store.json');

const INITIAL_KEY_POOL = [
  '7955c352e1aba2676cba5dd5f5a5253bf8298ed210c85f3a714b1b3d8548243c',
  'ca016ca3597bd359c176fff1093bf4527b7496b05a698ebc985419f72a69e2c7',
  '80f3ae4962050fc068e30a6fff2d474bc81528fc98279816de6d26f83a87dfc2',
  'bda2886765dbf21ee3eab9fe8f102824a2fde7b6ef2feba7ed8f6b1fab861bfa',
  '9279ebfb9004ab8efb89bf0fb8b534d4260d52c1dca1ef9272fbeb07ff0c9ed9',
  '72b8a5e18a919e899472e8e43e503fdda8be60037be376ee7411eb7cc21169d6',
  '970d94bd988774af0482c03a7b052d24cfaf320df6149052b963ce8250b66983',
  '9fc29e90f876d054e39bf70d64434b6e1165851a5c6b09af65dbc4967cfeaaf2'
];

class AIService {
  constructor() {
    this.store = {
      pool: [...INITIAL_KEY_POOL],
      assignments: {} // userIdentifier -> { key, assignedAt, model, rateLimit, tokenLimit }
    };
    this.loadStore();
  }

  loadStore() {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
        if (data && Array.isArray(data.pool)) {
          // Merge initial keys if not already present
          INITIAL_KEY_POOL.forEach(k => {
            if (!data.pool.includes(k)) data.pool.push(k);
          });
          this.store = data;
          return;
        }
      }
      this.saveStore();
    } catch (err) {
      // Memory store fallback
    }
  }

  saveStore() {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.store, null, 2), 'utf8');
    } catch (err) {
      // Graceful fallback for serverless
    }
  }

  getUserKey(userIdentifier) {
    if (!userIdentifier) return null;
    return this.store.assignments[userIdentifier] || null;
  }

  generateKeyForUser(userIdentifier, metadata = {}) {
    if (!userIdentifier) {
      throw new Error('User identifier (email or account ID) is required');
    }

    // Strict 1 key per customer check
    const existing = this.store.assignments[userIdentifier];
    if (existing) {
      return {
        alreadyAssigned: true,
        key: existing.key,
        model: existing.model,
        rateLimit: existing.rateLimit,
        tokenLimit: existing.tokenLimit,
        assignedAt: existing.assignedAt,
        name: existing.name || metadata.name || 'Production AI',
        region: existing.region || metadata.region || 'India (Mumbai Node)'
      };
    }

    if (this.store.pool.length === 0) {
      throw new Error('All Free Tier AI keys have been allocated. Please contact support.');
    }

    // Pop key from pool
    const allocatedKey = this.store.pool.shift();
    const assignment = {
      key: allocatedKey,
      assignedAt: new Date().toISOString(),
      model: 'Colide Pro (Advanced Reasoning)',
      rateLimit: '800 requests/day',
      tokenLimit: '25,000 tokens/month',
      tier: 'Free Tier',
      name: metadata.name || 'Production AI',
      region: metadata.region || 'India (Mumbai Node)',
      metadata
    };

    this.store.assignments[userIdentifier] = assignment;
    this.saveStore();

    return {
      alreadyAssigned: false,
      ...assignment
    };
  }

  getPoolStats() {
    return {
      availableKeys: this.store.pool.length,
      assignedKeys: Object.keys(this.store.assignments).length,
      totalKeys: this.store.pool.length + Object.keys(this.store.assignments).length
    };
  }
}

const aiInstance = new AIService();
module.exports = aiInstance;
