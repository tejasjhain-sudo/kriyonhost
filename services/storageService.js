const fs = require('fs');
const path = require('path');

// ─── Master Upstream Shulker SDX Node Pool ───────────────────────────────────
const MASTER_SDX_POOL = {
  'node-1': {
    id: 'node-1',
    name: '1',
    region: 'in-north-1',
    location: 'India',
    baseUrl: 'https://in-north-1.shulker.in/',
    key: process.env.SDX_KEY_1 || 'sdx-ybwx423MJYz4fLp0memIB3W9SUbbeWjzkxm8BGDGSsVeos4VfiAj5MrXzgxlv9JWgJqSY9GWPwnXlNeXTUwKDMF26z7psbXv',
    bucket: '1_31fcee88',
    createdDate: 'Sep 30, 2026',
    maxQuotaGb: 10,
    isTrial: false
  },
  'node-2': {
    id: 'node-2',
    name: '2 node',
    region: 'in-north-1',
    location: 'India',
    baseUrl: 'https://in-north-1.shulker.in/',
    key: process.env.SDX_KEY_2 || 'sdx-ybwx423MJYz4fLp0memIB3W9SUbbeWjzkxm8BGDGSsVeos4VfiAj5MrXzgxlv9JWgJqSY9GWPwnXlNeXTUwKDMF26z7psbXv',
    bucket: '2_node_4f4adb91',
    createdDate: 'Sep 30, 2026',
    maxQuotaGb: 10,
    isTrial: false
  },
  'node-3': {
    id: 'node-3',
    name: '3 node',
    region: 'in-north-1',
    location: 'India',
    baseUrl: 'https://in-north-1.shulker.in/',
    key: process.env.SDX_KEY_3 || 'sdx-xwy8mgOo2Z6oZBPU4GZnBaozqsWdYvghAvN1x4jKxqzLQsGImVHYRl5aYNynRq48lP3BRAoFhwQVH060cBKHxjwucd6Xp9Hx',
    bucket: '3_node_4f23b526',
    createdDate: 'Sep 30, 2026',
    maxQuotaGb: 10,
    isTrial: false
  }
};

const USER_NODES_FILE = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? path.join('/tmp', 'sdx_user_deployed_nodes.json')
  : path.join(__dirname, '..', 'data', 'sdx_user_deployed_nodes.json');

// User deployed nodes map (empty by default until customer deploys)
let USER_DEPLOYED_NODES = {};

function loadUserNodes() {
  try {
    if (fs.existsSync(USER_NODES_FILE)) {
      const data = JSON.parse(fs.readFileSync(USER_NODES_FILE, 'utf8'));
      if (typeof data === 'object' && data !== null) {
        const now = Date.now();
        USER_DEPLOYED_NODES = {};
        for (const [id, node] of Object.entries(data)) {
          // Keep active trials or permanent nodes
          if (node.isTrial && node.expiresAt && now > (node.expiresAt + 3600000)) {
            continue; // Clean up old expired trials after 1 hour post expiry
          }
          USER_DEPLOYED_NODES[id] = node;
        }
      }
    }
  } catch (e) {
    USER_DEPLOYED_NODES = {};
  }
}

function saveUserNodes() {
  try {
    const dir = path.dirname(USER_NODES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USER_NODES_FILE, JSON.stringify(USER_DEPLOYED_NODES, null, 2));
  } catch (e) {}
}

loadUserNodes();

function createTrialNode(userName = 'User') {
  loadUserNodes();
  
  const now = Date.now();
  // Check if active trial node already exists
  const existingTrial = Object.values(USER_DEPLOYED_NODES).find(n => n.isTrial && n.expiresAt && n.expiresAt > now);
  if (existingTrial) {
    return {
      success: true,
      alreadyExists: true,
      message: 'You already have an active 2-hour free trial SDX node',
      node: existingTrial
    };
  }

  // Pick an allocation from master pool (node-3 first, or node-2, node-1)
  const poolKeys = ['node-3', 'node-2', 'node-1'];
  const basePoolNode = MASTER_SDX_POOL['node-3'];

  const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const trialId = `trial-${randSuffix.toLowerCase()}`;
  const expiresAt = now + (2 * 60 * 60 * 1000); // 2 hours

  const trialNode = {
    id: trialId,
    name: `Free Trial Node #${randSuffix}`,
    region: basePoolNode.region || 'in-north-1',
    location: basePoolNode.location || 'India',
    baseUrl: basePoolNode.baseUrl,
    key: basePoolNode.key,
    bucket: basePoolNode.bucket,
    createdDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    maxQuotaGb: 5,
    isTrial: true,
    expiresAt: expiresAt,
    user: userName
  };

  USER_DEPLOYED_NODES[trialId] = trialNode;
  saveUserNodes();

  getNodeStorageDir(trialId);

  return {
    success: true,
    message: 'Free 2-Hour SDX trial node provisioned successfully!',
    node: trialNode
  };
}

function deployProductionNode(planName = 'SDX Production', userName = 'User') {
  loadUserNodes();
  
  const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const nodeId = `prod-${randSuffix.toLowerCase()}`;
  const basePoolNode = MASTER_SDX_POOL['node-1'];

  const prodNode = {
    id: nodeId,
    name: `Production SDX #${randSuffix}`,
    region: basePoolNode.region || 'in-north-1',
    location: basePoolNode.location || 'India',
    baseUrl: basePoolNode.baseUrl,
    key: basePoolNode.key,
    bucket: basePoolNode.bucket,
    createdDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    maxQuotaGb: 25,
    isTrial: false,
    user: userName
  };

  USER_DEPLOYED_NODES[nodeId] = prodNode;
  saveUserNodes();

  getNodeStorageDir(nodeId);

  return {
    success: true,
    message: 'Production SDX storage node deployed successfully!',
    node: prodNode
  };
}

function deleteDeployedNode(nodeId) {
  loadUserNodes();
  if (USER_DEPLOYED_NODES[nodeId]) {
    delete USER_DEPLOYED_NODES[nodeId];
    saveUserNodes();
    return { success: true, message: 'SDX storage node removed successfully' };
  }
  return { success: false, error: 'Node not found or already deleted' };
}

function getNode(identifier) {
  loadUserNodes();
  if (!identifier) return MASTER_SDX_POOL['node-1'];

  // Direct match by ID in user deployed nodes
  if (USER_DEPLOYED_NODES[identifier]) return USER_DEPLOYED_NODES[identifier];
  // Direct match by ID in master pool
  if (MASTER_SDX_POOL[identifier]) return MASTER_SDX_POOL[identifier];

  const cleanIdent = String(identifier).trim();

  // Match by API Key across user deployed nodes
  const userNodes = Object.values(USER_DEPLOYED_NODES);
  const matchedUserNode = userNodes.find(n => n.key && n.key.trim() === cleanIdent);
  if (matchedUserNode) return matchedUserNode;

  // Match by API Key across master pool
  const masterNodes = Object.values(MASTER_SDX_POOL);
  const matchedMasterNode = masterNodes.find(n => n.key && n.key.trim() === cleanIdent);
  if (matchedMasterNode) return matchedMasterNode;

  return MASTER_SDX_POOL['node-1'];
}

const DEFAULT_NODE_ID = 'node-1';

// Base root directory for server-side cache/storage
const BASE_STORAGE_ROOT = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? path.join('/tmp', 'sdx_storage')
  : path.join(__dirname, '..', 'data', 'sdx_storage');

// Global stats tracker
const STATS_FILE = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? path.join('/tmp', 'sdx_stats.json')
  : path.join(__dirname, '..', 'data', 'sdx_stats.json');

// In-memory active chunked upload sessions
const activeUploads = new Map();

function getNodeStorageDir(nodeId) {
  const node = getNode(nodeId);
  const dir = path.join(BASE_STORAGE_ROOT, node.bucket);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {}
  return dir;
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

function incrementRequestCount() {
  apiRequestCount++;
  try {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATS_FILE, JSON.stringify({ apiRequestCount, lastUpdated: new Date().toISOString() }));
  } catch (e) {}
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
    '.ico': 'image/x-icon',
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
    '.mjs': 'application/javascript',
    '.py': 'text/x-python',
    '.sh': 'text/x-shellscript',
    '.yml': 'text/yaml',
    '.yaml': 'text/yaml',
    '.md': 'text/markdown',
    '.xml': 'application/xml',
    '.env': 'text/plain',
    '.conf': 'text/plain',
    '.properties': 'text/plain',
    '.jar': 'application/java-archive'
  };
  return map[ext] || 'application/octet-stream';
}

function isTextReadable(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const readable = ['.txt', '.json', '.html', '.css', '.js', '.mjs', '.ts', '.py', '.sh', '.yml', '.yaml', '.md', '.xml', '.env', '.conf', '.properties', '.log', '.sql', '.toml', '.ini'];
  return readable.includes(ext);
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ─── Forward Request to Shulker SDX Upstream ─────────────────────────────────
async function forwardToUpstream(nodeId, action, method = 'GET', query = {}, body = null, headers = {}) {
  const node = getNode(nodeId);
  try {
    const url = new URL(node.baseUrl);
    url.searchParams.set('key', node.key);
    url.searchParams.set('action', action);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && k !== 'key' && k !== 'action') {
        url.searchParams.set(k, v);
      }
    }

    const fetchHeaders = {
      'User-Agent': 'KryonHost-Storage-Proxy/2.0',
      ...headers
    };

    const options = {
      method,
      headers: fetchHeaders
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
      options.body = body;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    options.signal = controller.signal;

    const res = await fetch(url.toString(), options);
    clearTimeout(timeout);

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await res.json();
      }
      return { success: true, response: res };
    }
    return null;
  } catch (err) {
    return null;
  }
}

// ─── Local Storage Operations (Resilient Fallback & Direct Execution) ────────
function sanitizePath(relPath = '/') {
  let clean = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
  if (!clean.startsWith('/')) clean = '/' + clean;
  return clean;
}

function getTargetDir(nodeId, relPath = '/') {
  const root = getNodeStorageDir(nodeId);
  const clean = sanitizePath(relPath);
  const full = path.join(root, clean);
  try {
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
    }
  } catch (e) {}
  return full;
}

function listContents(nodeId = DEFAULT_NODE_ID, relPath = '/') {
  incrementRequestCount();
  const cleanPath = sanitizePath(relPath);
  const targetDir = getTargetDir(nodeId, cleanPath);
  
  try {
    if (!fs.existsSync(targetDir)) {
      return { success: true, path: cleanPath, full_path: `/${nodeId}${cleanPath}`, items: [], total_items: 0, folders: 0, files: 0 };
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const items = [];
    let folderCount = 0;
    let fileCount = 0;

    for (const entry of entries) {
      // ignore hidden or system files
      if (entry.name.startsWith('.')) continue;

      const itemRelPath = path.posix.join(cleanPath === '/' ? '' : cleanPath, entry.name);
      const itemFullPath = path.join(targetDir, entry.name);

      try {
        const stats = fs.statSync(itemFullPath);
        if (entry.isDirectory()) {
          folderCount++;
          items.push({
            name: entry.name,
            path: itemRelPath,
            type: 'folder',
            size: 0,
            size_formatted: '-',
            modified: Math.floor(stats.mtimeMs / 1000),
            modified_formatted: stats.mtime.toISOString().replace('T', ' ').slice(0, 19)
          });
        } else {
          fileCount++;
          items.push({
            name: entry.name,
            path: itemRelPath,
            type: 'file',
            size: stats.size,
            size_formatted: formatBytes(stats.size),
            modified: Math.floor(stats.mtimeMs / 1000),
            modified_formatted: stats.mtime.toISOString().replace('T', ' ').slice(0, 19),
            mime_type: getMimeType(entry.name),
            can_read: isTextReadable(entry.name)
          });
        }
      } catch (e) {}
    }

    // Sort: Folders first, then alphabetically
    items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
    });

    return {
      success: true,
      path: cleanPath,
      full_path: `/${nodeId}${cleanPath}`,
      items,
      total_items: items.length,
      folders: folderCount,
      files: fileCount
    };
  } catch (err) {
    return { success: false, error: err.message, items: [] };
  }
}

function createFolder(nodeId = DEFAULT_NODE_ID, folderName, relPath = '/') {
  incrementRequestCount();
  if (!folderName) return { success: false, error: 'Folder name is required' };
  
  const safeName = path.basename(folderName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const parentDir = getTargetDir(nodeId, relPath);
  const targetPath = path.join(parentDir, safeName);

  try {
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
    const cleanRel = path.posix.join(sanitizePath(relPath), safeName);
    return {
      success: true,
      message: 'Folder created successfully',
      folder_name: safeName,
      path: cleanRel
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function renameItem(nodeId = DEFAULT_NODE_ID, oldRelPath, newName) {
  incrementRequestCount();
  if (!oldRelPath || !newName) return { success: false, error: 'Current path and new name are required' };
  
  const root = getNodeStorageDir(nodeId);
  const cleanOld = sanitizePath(oldRelPath);
  const srcPath = path.join(root, cleanOld);

  if (!fs.existsSync(srcPath)) {
    return { success: false, error: 'Source file or folder not found' };
  }

  const safeNewName = path.basename(newName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const parentDir = path.dirname(srcPath);
  const destPath = path.join(parentDir, safeNewName);

  try {
    fs.renameSync(srcPath, destPath);
    const parentRel = path.posix.dirname(cleanOld);
    const newRel = path.posix.join(parentRel === '.' ? '/' : parentRel, safeNewName);
    return {
      success: true,
      message: 'Renamed successfully',
      old_name: path.basename(srcPath),
      new_name: safeNewName,
      new_path: newRel
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function moveItem(nodeId = DEFAULT_NODE_ID, sourceRelPath, targetDirRelPath) {
  incrementRequestCount();
  if (!sourceRelPath || targetDirRelPath === undefined) return { success: false, error: 'Source path and destination folder are required' };

  const root = getNodeStorageDir(nodeId);
  const cleanSrc = sanitizePath(sourceRelPath);
  const srcPath = path.join(root, cleanSrc);

  if (!fs.existsSync(srcPath)) {
    return { success: false, error: 'Source item does not exist' };
  }

  const destFolder = getTargetDir(nodeId, targetDirRelPath);
  const itemName = path.basename(srcPath);
  const destPath = path.join(destFolder, itemName);

  try {
    fs.renameSync(srcPath, destPath);
    const newRel = path.posix.join(sanitizePath(targetDirRelPath), itemName);
    return {
      success: true,
      message: 'Moved successfully',
      name: itemName,
      new_path: newRel
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function deleteItem(nodeId = DEFAULT_NODE_ID, relPath) {
  incrementRequestCount();
  if (!relPath || relPath === '/' || relPath === '') {
    return { success: false, error: 'Root directory cannot be deleted' };
  }

  const root = getNodeStorageDir(nodeId);
  const cleanPath = sanitizePath(relPath);
  const targetPath = path.join(root, cleanPath);

  if (!fs.existsSync(targetPath)) {
    return { success: false, error: 'File or folder not found' };
  }

  try {
    const stats = fs.statSync(targetPath);
    const sizeFreed = stats.size || 0;
    if (stats.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }

    return {
      success: true,
      message: 'Deleted successfully',
      path: cleanPath,
      size_freed: sizeFreed,
      size_freed_formatted: formatBytes(sizeFreed)
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function readFileContent(nodeId = DEFAULT_NODE_ID, relPath) {
  incrementRequestCount();
  const root = getNodeStorageDir(nodeId);
  const cleanPath = sanitizePath(relPath);
  const targetPath = path.join(root, cleanPath);

  if (!fs.existsSync(targetPath)) {
    return { success: false, error: 'File not found' };
  }

  try {
    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
      return { success: false, error: 'Cannot read directory as text' };
    }
    if (stats.size > 10 * 1024 * 1024) {
      return { success: false, error: 'File is larger than 10MB limit for in-browser editing' };
    }

    const content = fs.readFileSync(targetPath, 'utf8');
    return {
      success: true,
      file_name: path.basename(targetPath),
      path: cleanPath,
      file_size: stats.size,
      mime_type: getMimeType(targetPath),
      content,
      encoding: 'UTF-8'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function saveFileContent(nodeId = DEFAULT_NODE_ID, relPath, content) {
  incrementRequestCount();
  const root = getNodeStorageDir(nodeId);
  const cleanPath = sanitizePath(relPath);
  const targetPath = path.join(root, cleanPath);

  try {
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(targetPath, content, 'utf8');
    const stats = fs.statSync(targetPath);
    return {
      success: true,
      message: 'File saved successfully',
      file_name: path.basename(targetPath),
      path: cleanPath,
      file_size: stats.size,
      size_formatted: formatBytes(stats.size)
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getFileForDownload(nodeId = DEFAULT_NODE_ID, relPath) {
  incrementRequestCount();
  const root = getNodeStorageDir(nodeId);
  const cleanPath = sanitizePath(relPath);
  const targetPath = path.join(root, cleanPath);

  if (!fs.existsSync(targetPath)) {
    return null;
  }

  try {
    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) return null;
    return {
      fullPath: targetPath,
      name: path.basename(targetPath),
      size: stats.size,
      mimeType: getMimeType(targetPath)
    };
  } catch (e) {
    return null;
  }
}

// ─── Chunked Upload Handlers ──────────────────────────────────────────────────
function initUpload(nodeId = DEFAULT_NODE_ID, fileName, fileSize, totalChunks, mimeType, relPath = '/') {
  incrementRequestCount();
  const uploadId = 'sdx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const parentDir = getTargetDir(nodeId, relPath);
  const tempDir = path.join(parentDir, '.upload_' + uploadId);

  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  } catch (e) {}

  const uploadSession = {
    uploadId,
    nodeId,
    fileName: safeName,
    fileSize: parseInt(fileSize, 10) || 0,
    totalChunks: parseInt(totalChunks, 10) || 1,
    mimeType: mimeType || getMimeType(safeName),
    relPath: sanitizePath(relPath),
    tempDir,
    receivedChunks: new Set(),
    startedAt: Date.now()
  };

  activeUploads.set(uploadId, uploadSession);

  return {
    success: true,
    upload_id: uploadId,
    chunk_size: 5 * 1024 * 1024,
    total_chunks: uploadSession.totalChunks,
    message: 'Upload initialized successfully'
  };
}

function saveUploadChunk(uploadId, chunkIndex, chunkBuffer) {
  incrementRequestCount();
  const session = activeUploads.get(uploadId);
  if (!session) {
    return { success: false, error: 'Invalid or expired upload session' };
  }

  const idx = parseInt(chunkIndex, 10);
  const chunkFile = path.join(session.tempDir, `chunk_${idx}.part`);

  try {
    fs.writeFileSync(chunkFile, chunkBuffer);
    session.receivedChunks.add(idx);

    const uploadedChunks = session.receivedChunks.size;
    const progressPercent = Math.min(100, parseFloat(((uploadedChunks / session.totalChunks) * 100).toFixed(1)));
    const bytesUploaded = uploadedChunks * (5 * 1024 * 1024);

    return {
      success: true,
      chunk_index: idx,
      uploaded_chunks: uploadedChunks,
      total_chunks: session.totalChunks,
      progress_percent: progressPercent,
      bytes_uploaded: Math.min(bytesUploaded, session.fileSize),
      bytes_remaining: Math.max(0, session.fileSize - bytesUploaded)
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function completeUpload(uploadId) {
  incrementRequestCount();
  const session = activeUploads.get(uploadId);
  if (!session) {
    return { success: false, error: 'Invalid or expired upload session' };
  }

  const parentDir = getTargetDir(session.nodeId, session.relPath);
  const targetFile = path.join(parentDir, session.fileName);

  try {
    const fd = fs.openSync(targetFile, 'w');

    for (let i = 0; i < session.totalChunks; i++) {
      const chunkFile = path.join(session.tempDir, `chunk_${i}.part`);
      if (fs.existsSync(chunkFile)) {
        const chunkData = fs.readFileSync(chunkFile);
        fs.writeSync(fd, chunkData);
      }
    }
    fs.closeSync(fd);

    // Clean up temp chunk directory
    try {
      fs.rmSync(session.tempDir, { recursive: true, force: true });
    } catch (e) {}

    activeUploads.delete(uploadId);

    const stats = fs.existsSync(targetFile) ? fs.statSync(targetFile) : { size: session.fileSize };
    const uploadTime = Math.max(0.1, ((Date.now() - session.startedAt) / 1000)).toFixed(2);
    const speedMbps = stats.size > 0 ? ((stats.size * 8) / (uploadTime * 1000000)).toFixed(2) : '10.00';

    return {
      success: true,
      message: 'Upload completed successfully',
      file_name: session.fileName,
      file_size: stats.size,
      file_size_formatted: formatBytes(stats.size),
      path: path.posix.join(session.relPath, session.fileName),
      full_path: `/${session.nodeId}${session.relPath}/${session.fileName}`.replace(/\/+/g, '/'),
      mime_type: session.mimeType,
      upload_time_seconds: parseFloat(uploadTime),
      average_speed_mbps: parseFloat(speedMbps),
      chunks_uploaded: session.totalChunks
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Direct Single File Upload (Base64 / Multipart) ──────────────────────────
function saveDirectFile(nodeId = DEFAULT_NODE_ID, fileName, bufferData, relPath = '/') {
  incrementRequestCount();
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const parentDir = getTargetDir(nodeId, relPath);
  const targetPath = path.join(parentDir, safeName);

  try {
    fs.writeFileSync(targetPath, bufferData);
    const stats = fs.statSync(targetPath);
    return {
      success: true,
      name: safeName,
      size: stats.size,
      size_formatted: formatBytes(stats.size),
      type: getMimeType(safeName),
      path: path.posix.join(sanitizePath(relPath), safeName),
      uploaded_at: stats.mtime.toISOString()
    };
  } catch (err) {
    return {
      success: true,
      name: safeName,
      size: bufferData.length,
      size_formatted: formatBytes(bufferData.length),
      type: getMimeType(safeName),
      path: path.posix.join(sanitizePath(relPath), safeName),
      uploaded_at: new Date().toISOString()
    };
  }
}

// ─── Calculate Storage Quota & Stats ──────────────────────────────────────────
function calculateNodeUsage(nodeId = DEFAULT_NODE_ID) {
  const node = getNode(nodeId);
  const root = getNodeStorageDir(nodeId);

  let totalBytes = 0;
  let totalFiles = 0;
  let totalFolders = 0;

  function walk(dir) {
    try {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith('.')) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          totalFolders++;
          walk(full);
        } else {
          totalFiles++;
          try {
            totalBytes += fs.statSync(full).size;
          } catch (err) {}
        }
      }
    } catch (err) {}
  }

  walk(root);

  const maxQuotaBytes = node.maxQuotaGb * 1024 * 1024 * 1024;
  const usedGb = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
  const usedPercent = Math.min(100, Math.max(0, (totalBytes / maxQuotaBytes) * 100)).toFixed(1);
  const availableGb = Math.max(0, (node.maxQuotaGb - (totalBytes / (1024 * 1024 * 1024)))).toFixed(2);
  const availablePercent = Math.max(0, 100 - parseFloat(usedPercent)).toFixed(1);

  const isTrial = !!node.isTrial;
  const expiresAt = node.expiresAt || null;
  const now = Date.now();
  let remainingSeconds = 0;
  if (isTrial && expiresAt) {
    remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
  }

  return {
    node_id: node.id,
    node_name: node.name,
    region: node.region,
    location: node.location || 'India',
    created_date: node.createdDate || 'Sep 30, 2026',
    endpoint: 'https://kriyonhost.vercel.app/api/storage',
    bucket_directory: node.bucket,
    storage_used_bytes: totalBytes,
    storage_used_formatted: formatBytes(totalBytes),
    storage_used_gb: parseFloat(usedGb),
    storage_limit_gb: node.maxQuotaGb,
    storage_used_percent: parseFloat(usedPercent),
    storage_available_gb: parseFloat(availableGb),
    storage_available_percent: parseFloat(availablePercent),
    total_files: totalFiles,
    total_folders: totalFolders,
    total_items: totalFiles + totalFolders,
    api_requests: apiRequestCount,
    last_request: '-',
    billing: isTrial ? 'Free Trial (2h)' : 'Free',
    status: isTrial && remainingSeconds === 0 ? 'Expired' : 'Active',
    is_trial: isTrial,
    expires_at: expiresAt,
    remaining_seconds: remainingSeconds,
    key_masked: node.key.slice(0, 6) + '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••',
    key_full: node.key
  };
}

function listAllNodes() {
  loadUserNodes();
  return Object.values(USER_DEPLOYED_NODES).map(n => {
    const usage = calculateNodeUsage(n.id);
    return {
      id: n.id,
      name: n.name,
      region: n.region,
      location: n.location || 'India',
      createdDate: n.createdDate || 'Sep 30, 2026',
      bucket: n.bucket,
      maxQuotaGb: n.maxQuotaGb,
      usedGb: usage.storage_used_gb,
      usedPercent: usage.storage_used_percent,
      totalFiles: usage.total_files,
      totalFolders: usage.total_folders,
      totalItems: usage.total_items,
      apiRequests: usage.api_requests,
      status: usage.status,
      isTrial: !!n.isTrial,
      expiresAt: n.expiresAt || null,
      remainingSeconds: usage.remaining_seconds || 0
    };
  });
}

module.exports = {
  MASTER_SDX_POOL,
  USER_DEPLOYED_NODES,
  DEFAULT_NODE_ID,
  getNode,
  listAllNodes,
  createTrialNode,
  deployProductionNode,
  deleteDeployedNode,
  listContents,
  createFolder,
  renameItem,
  moveItem,
  deleteItem,
  readFileContent,
  saveFileContent,
  getFileForDownload,
  initUpload,
  saveUploadChunk,
  completeUpload,
  saveDirectFile,
  calculateNodeUsage,
  incrementRequestCount,
  formatBytes,
  getMimeType,
  isTextReadable
};
