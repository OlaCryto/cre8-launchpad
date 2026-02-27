import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_FILE = process.env.SQLITE_PATH || join(process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname, 'cre8.db');

const dbDir = dirname(DB_FILE);
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_FILE);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    twitter_id TEXT UNIQUE NOT NULL,
    twitter_handle TEXT NOT NULL,
    twitter_name TEXT NOT NULL,
    twitter_avatar TEXT NOT NULL,
    wallet_address TEXT UNIQUE NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    encryption_iv TEXT NOT NULL,
    encryption_tag TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_address TEXT NOT NULL,
    author_address TEXT NOT NULL,
    author_name TEXT,
    author_avatar TEXT,
    content TEXT NOT NULL,
    parent_id INTEGER REFERENCES comments(id),
    likes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comment_likes (
    comment_id INTEGER NOT NULL REFERENCES comments(id),
    user_address TEXT NOT NULL,
    PRIMARY KEY (comment_id, user_address)
  );

  CREATE TABLE IF NOT EXISTS price_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_address TEXT NOT NULL,
    price REAL NOT NULL,
    reserve REAL NOT NULL,
    market_cap REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_address TEXT NOT NULL,
    token_address TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_address, token_address)
  );

  CREATE TABLE IF NOT EXISTS creator_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    wallet_address TEXT NOT NULL,
    project_name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    website TEXT,
    product_proof TEXT,
    twitter TEXT,
    telegram TEXT,
    discord TEXT,
    youtube TEXT,
    team_info TEXT,
    token_utility TEXT,
    roadmap TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_comments_token ON comments(token_address, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
  CREATE INDEX IF NOT EXISTS idx_price_snapshots_token ON price_snapshots(token_address, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_creator_apps_user ON creator_applications(user_id);
  CREATE INDEX IF NOT EXISTS idx_creator_apps_status ON creator_applications(status);
  CREATE INDEX IF NOT EXISTS idx_creator_apps_wallet ON creator_applications(wallet_address);
`);

// ============ User operations ============

const stmtFindUserByTwitterId = db.prepare('SELECT * FROM users WHERE twitter_id = ?');
const stmtFindUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const stmtCreateUser = db.prepare(`
  INSERT INTO users (id, twitter_id, twitter_handle, twitter_name, twitter_avatar, wallet_address, encrypted_private_key, encryption_iv, encryption_tag, created_at)
  VALUES (@id, @twitter_id, @twitter_handle, @twitter_name, @twitter_avatar, @wallet_address, @encrypted_private_key, @encryption_iv, @encryption_tag, @created_at)
`);
const stmtUpdateUserProfile = db.prepare('UPDATE users SET twitter_handle = ?, twitter_name = ?, twitter_avatar = ? WHERE id = ?');
const stmtFindUsersByWallets = (count: number) =>
  db.prepare(`SELECT wallet_address, twitter_handle, twitter_name, twitter_avatar FROM users WHERE LOWER(wallet_address) IN (${Array(count).fill('?').join(',')})`);

export function findUserByTwitterId(twitterId: string) {
  return stmtFindUserByTwitterId.get(twitterId) as any;
}

export function findUserById(id: string) {
  return stmtFindUserById.get(id) as any;
}

export function createUser(user: any) {
  stmtCreateUser.run(user);
}

export function updateUserProfile(id: string, handle: string, name: string, avatar: string) {
  stmtUpdateUserProfile.run(handle, name, avatar, id);
}

export function findUsersByWalletAddresses(addresses: string[]): Record<string, { handle: string; name: string; avatar: string }> {
  if (addresses.length === 0) return {};
  const lower = addresses.map(a => a.toLowerCase());
  const rows = stmtFindUsersByWallets(lower.length).all(...lower) as any[];
  const result: Record<string, { handle: string; name: string; avatar: string }> = {};
  for (const row of rows) {
    result[row.wallet_address.toLowerCase()] = {
      handle: row.twitter_handle,
      name: row.twitter_name,
      avatar: row.twitter_avatar,
    };
  }
  return result;
}

// ============ Session operations ============

const stmtFindSession = db.prepare(`
  SELECT s.*, u.id as uid, u.twitter_id, u.twitter_handle, u.twitter_name, u.twitter_avatar,
         u.wallet_address, u.created_at as user_created_at
  FROM sessions s JOIN users u ON s.user_id = u.id
  WHERE s.token = ? AND s.expires_at > datetime('now')
`);
const stmtFindSessionWithKeys = db.prepare(`
  SELECT s.*, u.id as uid, u.twitter_id, u.twitter_handle, u.twitter_name, u.twitter_avatar,
         u.wallet_address, u.encrypted_private_key, u.encryption_iv, u.encryption_tag, u.created_at as user_created_at
  FROM sessions s JOIN users u ON s.user_id = u.id
  WHERE s.token = ? AND s.expires_at > datetime('now')
`);
const stmtCreateSession = db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (@token, @user_id, @created_at, @expires_at)');
const stmtDeleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');
const stmtCleanExpired = db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')");

export function findValidSession(token: string) {
  const row = stmtFindSession.get(token) as any;
  if (!row) return undefined;
  return {
    token: row.token,
    user_id: row.user_id,
    created_at: row.created_at,
    expires_at: row.expires_at,
    user: {
      id: row.uid,
      twitter_id: row.twitter_id,
      twitter_handle: row.twitter_handle,
      twitter_name: row.twitter_name,
      twitter_avatar: row.twitter_avatar,
      wallet_address: row.wallet_address,
      created_at: row.user_created_at,
    },
  };
}

/**
 * Like findValidSession but also returns encrypted wallet keys.
 * Only use for the wallet-key endpoint.
 */
export function findValidSessionWithKeys(token: string) {
  const row = stmtFindSessionWithKeys.get(token) as any;
  if (!row) return undefined;
  return {
    token: row.token,
    user_id: row.user_id,
    user: {
      id: row.uid,
      wallet_address: row.wallet_address,
      encrypted_private_key: row.encrypted_private_key,
      encryption_iv: row.encryption_iv,
      encryption_tag: row.encryption_tag,
    },
  };
}

export function createSession(session: any) {
  stmtCreateSession.run(session);
}

export function deleteSession(token: string) {
  stmtDeleteSession.run(token);
}

// Clean expired sessions on startup and every hour
stmtCleanExpired.run();
setInterval(() => stmtCleanExpired.run(), 3600_000);

// ============ Comment operations ============

const stmtCreateComment = db.prepare(`
  INSERT INTO comments (token_address, author_address, author_name, author_avatar, content, parent_id)
  VALUES (@token_address, @author_address, @author_name, @author_avatar, @content, @parent_id)
`);
const stmtGetComments = db.prepare(`
  SELECT c.*, (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) as likes
  FROM comments c WHERE c.token_address = ? AND c.parent_id IS NULL
  ORDER BY c.created_at DESC LIMIT ? OFFSET ?
`);
const stmtGetReplies = db.prepare(`
  SELECT c.*, (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) as likes
  FROM comments c WHERE c.parent_id = ?
  ORDER BY c.created_at ASC
`);
const stmtCommentCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE token_address = ?');
const stmtToggleLike = db.prepare('INSERT OR IGNORE INTO comment_likes (comment_id, user_address) VALUES (?, ?)');
const stmtRemoveLike = db.prepare('DELETE FROM comment_likes WHERE comment_id = ? AND user_address = ?');
const stmtCheckLike = db.prepare('SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_address = ?');
const stmtGetComment = db.prepare('SELECT * FROM comments WHERE id = ?');

export function addComment(data: { token_address: string; author_address: string; author_name?: string; author_avatar?: string; content: string; parent_id?: number }) {
  const result = stmtCreateComment.run({
    token_address: data.token_address,
    author_address: data.author_address,
    author_name: data.author_name || null,
    author_avatar: data.author_avatar || null,
    content: data.content,
    parent_id: data.parent_id || null,
  });
  return { id: result.lastInsertRowid };
}

export function getComments(tokenAddress: string, limit = 20, offset = 0) {
  const rows = stmtGetComments.all(tokenAddress, limit, offset) as any[];
  const total = (stmtCommentCount.get(tokenAddress) as any).count;
  return { comments: rows, total };
}

export function getReplies(commentId: number) {
  return stmtGetReplies.all(commentId) as any[];
}

export function toggleLike(commentId: number, userAddress: string): boolean {
  const exists = stmtCheckLike.get(commentId, userAddress);
  if (exists) {
    stmtRemoveLike.run(commentId, userAddress);
    return false;
  } else {
    stmtToggleLike.run(commentId, userAddress);
    return true;
  }
}

export function getComment(id: number) {
  return stmtGetComment.get(id) as any;
}

export function isLikedByUser(commentId: number, userAddress: string): boolean {
  return !!stmtCheckLike.get(commentId, userAddress);
}

// ============ Price snapshot operations ============

const stmtAddSnapshot = db.prepare('INSERT INTO price_snapshots (token_address, price, reserve, market_cap) VALUES (?, ?, ?, ?)');
const stmtGetLatestSnapshot = db.prepare('SELECT * FROM price_snapshots WHERE token_address = ? ORDER BY created_at DESC LIMIT 1');
const stmtGetSnapshotAt = db.prepare(`
  SELECT * FROM price_snapshots WHERE token_address = ? AND created_at <= datetime('now', ?) ORDER BY created_at DESC LIMIT 1
`);
const stmtGetSnapshots = db.prepare('SELECT * FROM price_snapshots WHERE token_address = ? ORDER BY created_at DESC LIMIT ?');

export function addPriceSnapshot(tokenAddress: string, price: number, reserve: number, marketCap: number) {
  stmtAddSnapshot.run(tokenAddress, price, reserve, marketCap);
}

export function getLatestSnapshot(tokenAddress: string) {
  return stmtGetLatestSnapshot.get(tokenAddress) as any;
}

export function getSnapshotAt(tokenAddress: string, timeOffset: string) {
  return stmtGetSnapshotAt.get(tokenAddress, timeOffset) as any;
}

export function getPriceHistory(tokenAddress: string, limit = 100) {
  return stmtGetSnapshots.all(tokenAddress, limit) as any[];
}

export function getPriceChanges(tokenAddress: string) {
  const now = getLatestSnapshot(tokenAddress);
  if (!now) return { price: 0, change_5m: 0, change_1h: 0, change_6h: 0, change_24h: 0 };

  const snap5m = getSnapshotAt(tokenAddress, '-5 minutes');
  const snap1h = getSnapshotAt(tokenAddress, '-1 hours');
  const snap6h = getSnapshotAt(tokenAddress, '-6 hours');
  const snap24h = getSnapshotAt(tokenAddress, '-24 hours');

  const pctChange = (current: number, old: number | undefined) => {
    if (!old || old === 0) return 0;
    return ((current - old) / old) * 100;
  };

  return {
    price: now.price,
    change_5m: pctChange(now.price, snap5m?.price),
    change_1h: pctChange(now.price, snap1h?.price),
    change_6h: pctChange(now.price, snap6h?.price),
    change_24h: pctChange(now.price, snap24h?.price),
  };
}

// ============ Favorites ============

const stmtAddFavorite = db.prepare('INSERT OR IGNORE INTO favorites (user_address, token_address) VALUES (?, ?)');
const stmtRemoveFavorite = db.prepare('DELETE FROM favorites WHERE user_address = ? AND token_address = ?');
const stmtGetFavorites = db.prepare('SELECT token_address FROM favorites WHERE user_address = ? ORDER BY created_at DESC');
const stmtIsFavorite = db.prepare('SELECT 1 FROM favorites WHERE user_address = ? AND token_address = ?');

export function addFavorite(userAddress: string, tokenAddress: string) {
  stmtAddFavorite.run(userAddress, tokenAddress);
}

export function removeFavorite(userAddress: string, tokenAddress: string) {
  stmtRemoveFavorite.run(userAddress, tokenAddress);
}

export function getFavorites(userAddress: string): string[] {
  return (stmtGetFavorites.all(userAddress) as any[]).map(r => r.token_address);
}

export function isFavorite(userAddress: string, tokenAddress: string): boolean {
  return !!stmtIsFavorite.get(userAddress, tokenAddress);
}

// ============ Creator Applications ============

export interface CreatorApplicationInput {
  user_id: string;
  wallet_address: string;
  project_name: string;
  category: string;
  description: string;
  website?: string;
  product_proof?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  youtube?: string;
  team_info?: string;
  token_utility?: string;
  roadmap?: string;
}

const stmtCreateApplication = db.prepare(`
  INSERT INTO creator_applications (user_id, wallet_address, project_name, category, description,
    website, product_proof, twitter, telegram, discord, youtube, team_info, token_utility, roadmap)
  VALUES (@user_id, @wallet_address, @project_name, @category, @description,
    @website, @product_proof, @twitter, @telegram, @discord, @youtube, @team_info, @token_utility, @roadmap)
`);
const stmtGetApplicationById = db.prepare('SELECT * FROM creator_applications WHERE id = ?');
const stmtGetApplicationsByUser = db.prepare('SELECT * FROM creator_applications WHERE user_id = ? ORDER BY created_at DESC');
const stmtGetApplicationByWallet = db.prepare("SELECT * FROM creator_applications WHERE wallet_address = ? AND status = 'approved' LIMIT 1");
const stmtGetPendingApplications = db.prepare("SELECT * FROM creator_applications WHERE status = 'pending' ORDER BY created_at ASC");
const stmtGetAllApplications = db.prepare('SELECT * FROM creator_applications ORDER BY created_at DESC LIMIT ? OFFSET ?');
const stmtCountApplications = db.prepare('SELECT COUNT(*) as count FROM creator_applications');
const stmtCountByStatus = db.prepare('SELECT COUNT(*) as count FROM creator_applications WHERE status = ?');
const stmtReviewApplication = db.prepare(`
  UPDATE creator_applications SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
  WHERE id = ?
`);
const stmtHasPendingApplication = db.prepare("SELECT 1 FROM creator_applications WHERE user_id = ? AND status = 'pending'");
const stmtIsVerifiedCreator = db.prepare("SELECT 1 FROM creator_applications WHERE wallet_address = ? AND status = 'approved'");

export function createApplication(data: CreatorApplicationInput) {
  const result = stmtCreateApplication.run({
    user_id: data.user_id,
    wallet_address: data.wallet_address,
    project_name: data.project_name,
    category: data.category,
    description: data.description,
    website: data.website || null,
    product_proof: data.product_proof || null,
    twitter: data.twitter || null,
    telegram: data.telegram || null,
    discord: data.discord || null,
    youtube: data.youtube || null,
    team_info: data.team_info || null,
    token_utility: data.token_utility || null,
    roadmap: data.roadmap || null,
  });
  return { id: result.lastInsertRowid };
}

export function getApplicationById(id: number) {
  return stmtGetApplicationById.get(id) as any;
}

export function getApplicationsByUser(userId: string) {
  return stmtGetApplicationsByUser.all(userId) as any[];
}

export function getApprovedApplicationByWallet(walletAddress: string) {
  return stmtGetApplicationByWallet.get(walletAddress.toLowerCase()) as any;
}

export function getPendingApplications() {
  return stmtGetPendingApplications.all() as any[];
}

export function getAllApplications(limit = 20, offset = 0) {
  const apps = stmtGetAllApplications.all(limit, offset) as any[];
  const total = (stmtCountApplications.get() as any).count;
  return { applications: apps, total };
}

export function getApplicationCountByStatus(status: string): number {
  return (stmtCountByStatus.get(status) as any).count;
}

export function reviewApplication(id: number, status: 'approved' | 'rejected', adminNotes: string, reviewedBy: string) {
  stmtReviewApplication.run(status, adminNotes, reviewedBy, id);
}

export function hasPendingApplication(userId: string): boolean {
  return !!stmtHasPendingApplication.get(userId);
}

export function isVerifiedCreator(walletAddress: string): boolean {
  return !!stmtIsVerifiedCreator.get(walletAddress.toLowerCase());
}

export default db;
