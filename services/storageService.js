const fs = require('fs');
const path = require('path');

const SDX_KEY = process.env.SDX_KEY || 'sdx-khCLYNoZudUxuHPb3GN28vficM2ximHcwYzhDay8zmAcFK9uekDqo9wyNR0jw2Dqkhg0kJwPs3xtDwO2PFLPgb33uTSxB9A1';
const BUCKET_ID = '1_31fcee88';
const STORAGE_DIR = path.join(__dirname, '..', 'data', 'sdx_storage', BUCKET_ID);
const STATS_FILE = path.join(__dirname, '..', 'data', 'sdx_stats.json');

// Ensure directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

let apiRequestCount = 0;
try {
  if (fs.existsSync(STATS_FILE)) {
    const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    apiRequestCount = data.apiRequestCount || 0;
  }
} catch (e) {
  apiRequestCount = 0;
}

function saveStats() {
  try {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATS_FILE, JSON.stringify({ apiRequestCount, lastUpdated: new Date().toISOString() }, null, 2));
  } catch (e) {
    console.error('Error saving SDX stats:', e);
  }
}

function incrementRequestCount() {
  apiRequestCount++;
  saveStats();
}

function validateKey(req) {
  const authHeader = req.headers['authorization'] || '';
  const queryKey = req.query.key || req.query.api_key;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || queryKey;
  return token === SDX_KEY;
}

function getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.md': 'text/markdown'
  };
  return map[ext] || 'application/octet-stream';
}

function listFiles() {
  if (!fs.existsSync(STORAGE_DIR)) return [];
  const entries = fs.readdirSync(STORAGE_DIR);
  return entries.map(filename => {
    const filePath = path.join(STORAGE_DIR, filename);
    const stats = fs.statSync(filePath);
    return {
      name: filename,
      size: stats.size,
      type: getMimeType(filename),
      uploaded_at: stats.mtime.toISOString(),
      created_at: stats.birthtime.toISOString()
    };
  }).sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
}

function saveFile(filename, bufferData) {
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const targetPath = path.join(STORAGE_DIR, safeName);
  fs.writeFileSync(targetPath, bufferData);
  const stats = fs.statSync(targetPath);
  return {
    name: safeName,
    size: stats.size,
    type: getMimeType(safeName),
    uploaded_at: stats.mtime.toISOString()
  };
}

function deleteFile(filename) {
  const safeName = path.basename(filename);
  const targetPath = path.join(STORAGE_DIR, safeName);
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
    return true;
  }
  return false;
}

function getFilePath(filename) {
  const safeName = path.basename(filename);
  const targetPath = path.join(STORAGE_DIR, safeName);
  if (fs.existsSync(targetPath)) {
    return {
      path: targetPath,
      name: safeName,
      type: getMimeType(safeName)
    };
  }
  return null;
}

function getStorageOverview() {
  const files = listFiles();
  let totalBytes = 0;
  files.forEach(f => { totalBytes += f.size; });
  const maxQuotaBytes = 10 * 1024 * 1024 * 1024; // 10 GB
  const usedGb = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
  const percentAvailable = Math.max(0, ((maxQuotaBytes - totalBytes) / maxQuotaBytes) * 100).toFixed(1);

  return {
    region: 'in-north-1 (India)',
    bucket_id: BUCKET_ID,
    total_uploads: files.length,
    total_bytes: totalBytes,
    used_gb: usedGb,
    max_quota_gb: 10,
    percent_available: percentAvailable,
    api_requests: apiRequestCount,
    files
  };
}

module.exports = {
  SDX_KEY,
  BUCKET_ID,
  STORAGE_DIR,
  validateKey,
  incrementRequestCount,
  listFiles,
  saveFile,
  deleteFile,
  getFilePath,
  getStorageOverview
};
