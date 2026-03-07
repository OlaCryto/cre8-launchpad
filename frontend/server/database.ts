import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false,
});

export async function initDatabase() {
  await pool.query(`
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      token_address TEXT NOT NULL,
      author_address TEXT NOT NULL,
      author_name TEXT,
      author_avatar TEXT,
      content TEXT NOT NULL,
      parent_id INTEGER REFERENCES comments(id),
      likes INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS comment_likes (
      comment_id INTEGER NOT NULL REFERENCES comments(id),
      user_address TEXT NOT NULL,
      PRIMARY KEY (comment_id, user_address)
    );

    CREATE TABLE IF NOT EXISTS price_snapshots (
      id SERIAL PRIMARY KEY,
      token_address TEXT NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      reserve DOUBLE PRECISION NOT NULL,
      market_cap DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_address TEXT NOT NULL,
      token_address TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_address, token_address)
    );

    CREATE TABLE IF NOT EXISTS creator_applications (
      id SERIAL PRIMARY KEY,
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
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_address TEXT NOT NULL,
      creator_address TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_address, creator_address)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_address TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      token_address TEXT,
      token_symbol TEXT,
      creator_name TEXT,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS presale_events (
      id SERIAL PRIMARY KEY,
      launch_id INTEGER NOT NULL,
      creator_address TEXT NOT NULL,
      token_name TEXT NOT NULL,
      token_symbol TEXT NOT NULL,
      hard_cap DOUBLE PRECISION NOT NULL,
      soft_cap DOUBLE PRECISION NOT NULL DEFAULT 0,
      max_per_wallet DOUBLE PRECISION NOT NULL,
      duration_seconds INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      vault_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS token_images (
      token_address TEXT PRIMARY KEY,
      mime_type TEXT NOT NULL,
      image_data BYTEA NOT NULL,
      uploaded_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS token_creators (
      token_address TEXT PRIMARY KEY,
      creator_address TEXT NOT NULL,
      token_name TEXT NOT NULL,
      token_symbol TEXT NOT NULL,
      created_block BIGINT,
      description TEXT NOT NULL DEFAULT '',
      twitter TEXT NOT NULL DEFAULT '',
      telegram TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_token_creators_creator ON token_creators(creator_address);
    CREATE INDEX IF NOT EXISTS idx_comments_token ON comments(token_address, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
    CREATE INDEX IF NOT EXISTS idx_price_snapshots_token ON price_snapshots(token_address, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_creator_apps_user ON creator_applications(user_id);
    CREATE INDEX IF NOT EXISTS idx_creator_apps_status ON creator_applications(status);
    CREATE INDEX IF NOT EXISTS idx_creator_apps_wallet ON creator_applications(wallet_address);
  `);

  // Migrate: drop old notifications table if it has wrong schema (missing user_address)
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'user_address'`
    );
    if (rows.length === 0) {
      // Table exists but lacks user_address — drop and let the CREATE TABLE above recreate it
      await pool.query('DROP TABLE IF EXISTS notifications CASCADE');
      await pool.query(`
        CREATE TABLE notifications (
          id SERIAL PRIMARY KEY,
          user_address TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          token_address TEXT,
          token_symbol TEXT,
          creator_name TEXT,
          read BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      console.log('[Database] Recreated notifications table with correct schema');
    }
  } catch (e: any) {
    console.warn('[Database] Notifications migration check:', e.message);
  }

  // Migrate: add metadata columns to token_creators if missing
  for (const col of ['description', 'twitter', 'telegram', 'website']) {
    try {
      await pool.query(`ALTER TABLE token_creators ADD COLUMN IF NOT EXISTS ${col} TEXT NOT NULL DEFAULT ''`);
    } catch { /* column already exists */ }
  }

  // Indexes for new tables (created separately to handle pre-existing schema mismatches)
  for (const ddl of [
    'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_address, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_address, read)',
    'CREATE INDEX IF NOT EXISTS idx_presale_events_launch ON presale_events(launch_id)',
    'CREATE INDEX IF NOT EXISTS idx_presale_events_creator ON presale_events(creator_address)',
  ]) {
    try { await pool.query(ddl); } catch (e: any) {
      console.warn(`[Database] Index creation skipped: ${e.message}`);
    }
  }

  await pool.query(`DELETE FROM sessions WHERE expires_at < NOW()`);
  setInterval(async () => {
    try { await pool.query(`DELETE FROM sessions WHERE expires_at < NOW()`); } catch {}
  }, 3600_000);

  console.log('[Database] PostgreSQL tables initialized');
}

// ============ User operations ============

export async function findUserByTwitterId(twitterId: string) {
  const { rows } = await pool.query('SELECT * FROM users WHERE twitter_id = $1', [twitterId]);
  return rows[0] || null;
}

export async function findUserById(id: string) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createUser(user: any) {
  await pool.query(
    `INSERT INTO users (id, twitter_id, twitter_handle, twitter_name, twitter_avatar,
      wallet_address, encrypted_private_key, encryption_iv, encryption_tag, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [user.id, user.twitter_id, user.twitter_handle, user.twitter_name, user.twitter_avatar,
     user.wallet_address, user.encrypted_private_key, user.encryption_iv, user.encryption_tag, user.created_at]
  );
}

export async function updateUserProfile(id: string, handle: string, name: string, avatar: string) {
  await pool.query('UPDATE users SET twitter_handle = $1, twitter_name = $2, twitter_avatar = $3 WHERE id = $4',
    [handle, name, avatar, id]);
}

export async function findUsersByWalletAddresses(addresses: string[]): Promise<Record<string, { handle: string; name: string; avatar: string }>> {
  if (addresses.length === 0) return {};
  const lower = addresses.map(a => a.toLowerCase());
  const placeholders = lower.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await pool.query(
    `SELECT wallet_address, twitter_handle, twitter_name, twitter_avatar FROM users WHERE LOWER(wallet_address) IN (${placeholders})`,
    lower
  );
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

export async function findValidSession(token: string) {
  const { rows } = await pool.query(
    `SELECT s.*, u.id as uid, u.twitter_id, u.twitter_handle, u.twitter_name, u.twitter_avatar,
            u.wallet_address, u.created_at as user_created_at
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  if (rows.length === 0) return undefined;
  const row = rows[0];
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

export async function findValidSessionWithKeys(token: string) {
  const { rows } = await pool.query(
    `SELECT s.*, u.id as uid, u.twitter_id, u.twitter_handle, u.twitter_name, u.twitter_avatar,
            u.wallet_address, u.encrypted_private_key, u.encryption_iv, u.encryption_tag, u.created_at as user_created_at
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  if (rows.length === 0) return undefined;
  const row = rows[0];
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

export async function createSession(session: any) {
  await pool.query(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
    [session.token, session.user_id, session.created_at, session.expires_at]
  );
}

export async function deleteSession(token: string) {
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

// ============ Comment operations ============

export async function addComment(data: { token_address: string; author_address: string; author_name?: string; author_avatar?: string; content: string; parent_id?: number }) {
  const { rows } = await pool.query(
    `INSERT INTO comments (token_address, author_address, author_name, author_avatar, content, parent_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [data.token_address, data.author_address, data.author_name || null, data.author_avatar || null, data.content, data.parent_id || null]
  );
  return { id: rows[0].id };
}

export async function getComments(tokenAddress: string, limit = 20, offset = 0) {
  const { rows: comments } = await pool.query(
    `SELECT c.*, (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id)::int as likes
     FROM comments c WHERE c.token_address = $1 AND c.parent_id IS NULL
     ORDER BY c.created_at DESC LIMIT $2 OFFSET $3`,
    [tokenAddress, limit, offset]
  );
  const { rows: countRows } = await pool.query('SELECT COUNT(*)::int as count FROM comments WHERE token_address = $1', [tokenAddress]);
  return { comments, total: countRows[0].count };
}

export async function getReplies(commentId: number) {
  const { rows } = await pool.query(
    `SELECT c.*, (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id)::int as likes
     FROM comments c WHERE c.parent_id = $1 ORDER BY c.created_at ASC`,
    [commentId]
  );
  return rows;
}

export async function getComment(id: number) {
  const { rows } = await pool.query('SELECT * FROM comments WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function toggleLike(commentId: number, userAddress: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_address = $2', [commentId, userAddress]);
  if (rows.length > 0) {
    await pool.query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_address = $2', [commentId, userAddress]);
    return false;
  } else {
    await pool.query('INSERT INTO comment_likes (comment_id, user_address) VALUES ($1, $2) ON CONFLICT DO NOTHING', [commentId, userAddress]);
    return true;
  }
}

export async function isLikedByUser(commentId: number, userAddress: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_address = $2', [commentId, userAddress]);
  return rows.length > 0;
}

// ============ Price snapshot operations ============

export async function addPriceSnapshot(tokenAddress: string, price: number, reserve: number, marketCap: number) {
  await pool.query('INSERT INTO price_snapshots (token_address, price, reserve, market_cap) VALUES ($1, $2, $3, $4)',
    [tokenAddress, price, reserve, marketCap]);
}

export async function getLatestSnapshot(tokenAddress: string) {
  const { rows } = await pool.query('SELECT * FROM price_snapshots WHERE token_address = $1 ORDER BY created_at DESC LIMIT 1', [tokenAddress]);
  return rows[0] || null;
}

export async function getSnapshotAt(tokenAddress: string, interval: string) {
  const { rows } = await pool.query(
    `SELECT * FROM price_snapshots WHERE token_address = $1 AND created_at <= NOW() - $2::interval ORDER BY created_at DESC LIMIT 1`,
    [tokenAddress, interval]
  );
  return rows[0] || null;
}

export async function getPriceHistory(tokenAddress: string, limit = 100) {
  const { rows } = await pool.query('SELECT * FROM price_snapshots WHERE token_address = $1 ORDER BY created_at DESC LIMIT $2', [tokenAddress, limit]);
  return rows;
}

export async function getPriceChanges(tokenAddress: string) {
  const now = await getLatestSnapshot(tokenAddress);
  if (!now) return { price: 0, change_5m: 0, change_1h: 0, change_6h: 0, change_24h: 0 };

  const [snap5m, snap1h, snap6h, snap24h] = await Promise.all([
    getSnapshotAt(tokenAddress, '5 minutes'),
    getSnapshotAt(tokenAddress, '1 hour'),
    getSnapshotAt(tokenAddress, '6 hours'),
    getSnapshotAt(tokenAddress, '24 hours'),
  ]);

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

export async function addFavorite(userAddress: string, tokenAddress: string) {
  await pool.query('INSERT INTO favorites (user_address, token_address) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userAddress, tokenAddress]);
}

export async function removeFavorite(userAddress: string, tokenAddress: string) {
  await pool.query('DELETE FROM favorites WHERE user_address = $1 AND token_address = $2', [userAddress, tokenAddress]);
}

export async function getFavorites(userAddress: string): Promise<string[]> {
  const { rows } = await pool.query('SELECT token_address FROM favorites WHERE user_address = $1 ORDER BY created_at DESC', [userAddress]);
  return rows.map(r => r.token_address);
}

export async function isFavorite(userAddress: string, tokenAddress: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT 1 FROM favorites WHERE user_address = $1 AND token_address = $2', [userAddress, tokenAddress]);
  return rows.length > 0;
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

export async function createApplication(data: CreatorApplicationInput) {
  const { rows } = await pool.query(
    `INSERT INTO creator_applications (user_id, wallet_address, project_name, category, description,
      website, product_proof, twitter, telegram, discord, youtube, team_info, token_utility, roadmap)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
    [data.user_id, data.wallet_address, data.project_name, data.category, data.description,
     data.website || null, data.product_proof || null, data.twitter || null, data.telegram || null,
     data.discord || null, data.youtube || null, data.team_info || null, data.token_utility || null, data.roadmap || null]
  );
  return { id: rows[0].id };
}

export async function getApplicationById(id: number) {
  const { rows } = await pool.query('SELECT * FROM creator_applications WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function getApplicationsByUser(userId: string) {
  const { rows } = await pool.query('SELECT * FROM creator_applications WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return rows;
}

export async function getApprovedApplicationByWallet(walletAddress: string) {
  const { rows } = await pool.query("SELECT * FROM creator_applications WHERE wallet_address = $1 AND status = 'approved' LIMIT 1", [walletAddress.toLowerCase()]);
  return rows[0] || null;
}

export async function getPendingApplications() {
  const { rows } = await pool.query("SELECT * FROM creator_applications WHERE status = 'pending' ORDER BY created_at ASC");
  return rows;
}

export async function getAllApplications(limit = 20, offset = 0) {
  const { rows } = await pool.query('SELECT * FROM creator_applications ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
  const { rows: countRows } = await pool.query('SELECT COUNT(*)::int as count FROM creator_applications');
  return { applications: rows, total: countRows[0].count };
}

export async function getApplicationCountByStatus(status: string): Promise<number> {
  const { rows } = await pool.query('SELECT COUNT(*)::int as count FROM creator_applications WHERE status = $1', [status]);
  return rows[0].count;
}

export async function reviewApplication(id: number, status: 'approved' | 'rejected', adminNotes: string, reviewedBy: string) {
  await pool.query(
    `UPDATE creator_applications SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW() WHERE id = $4`,
    [status, adminNotes, reviewedBy, id]
  );
}

export async function hasPendingApplication(userId: string): Promise<boolean> {
  const { rows } = await pool.query("SELECT 1 FROM creator_applications WHERE user_id = $1 AND status = 'pending'", [userId]);
  return rows.length > 0;
}

export async function isVerifiedCreator(walletAddress: string): Promise<boolean> {
  const { rows } = await pool.query("SELECT 1 FROM creator_applications WHERE wallet_address = $1 AND status = 'approved'", [walletAddress.toLowerCase()]);
  return rows.length > 0;
}

// ============ Follows ============

export async function toggleFollow(followerAddress: string, creatorAddress: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT 1 FROM follows WHERE follower_address = $1 AND creator_address = $2', [followerAddress.toLowerCase(), creatorAddress.toLowerCase()]);
  if (rows.length > 0) {
    await pool.query('DELETE FROM follows WHERE follower_address = $1 AND creator_address = $2', [followerAddress.toLowerCase(), creatorAddress.toLowerCase()]);
    return false; // unfollowed
  } else {
    await pool.query('INSERT INTO follows (follower_address, creator_address) VALUES ($1, $2)', [followerAddress.toLowerCase(), creatorAddress.toLowerCase()]);
    return true; // followed
  }
}

export async function isFollowing(followerAddress: string, creatorAddress: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT 1 FROM follows WHERE follower_address = $1 AND creator_address = $2', [followerAddress.toLowerCase(), creatorAddress.toLowerCase()]);
  return rows.length > 0;
}

export async function getFollowerCount(creatorAddress: string): Promise<number> {
  const { rows } = await pool.query('SELECT COUNT(*)::int as count FROM follows WHERE creator_address = $1', [creatorAddress.toLowerCase()]);
  return rows[0].count;
}

// ============ Notifications ============

export async function getNotifications(userAddress: string, limit = 50, offset = 0) {
  const { rows } = await pool.query(
    'SELECT * FROM notifications WHERE user_address = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [userAddress.toLowerCase(), limit, offset]
  );
  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*)::int as count FROM notifications WHERE user_address = $1',
    [userAddress.toLowerCase()]
  );
  const { rows: unreadRows } = await pool.query(
    'SELECT COUNT(*)::int as count FROM notifications WHERE user_address = $1 AND read = FALSE',
    [userAddress.toLowerCase()]
  );
  return { notifications: rows, total: countRows[0].count, unread: unreadRows[0].count };
}

export async function createNotification(data: {
  user_address: string; type: string; title: string; body: string;
  token_address?: string; token_symbol?: string; creator_name?: string;
}) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_address, type, title, body, token_address, token_symbol, creator_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [data.user_address.toLowerCase(), data.type, data.title, data.body,
     data.token_address || null, data.token_symbol || null, data.creator_name || null]
  );
  return { id: rows[0].id };
}

export async function createBulkNotifications(notifications: Array<{
  user_address: string; type: string; title: string; body: string;
  token_address?: string; token_symbol?: string; creator_name?: string;
}>) {
  if (notifications.length === 0) return;
  const values: any[] = [];
  const placeholders: string[] = [];
  notifications.forEach((n, i) => {
    const base = i * 7;
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
    values.push(n.user_address.toLowerCase(), n.type, n.title, n.body,
      n.token_address || null, n.token_symbol || null, n.creator_name || null);
  });
  await pool.query(
    `INSERT INTO notifications (user_address, type, title, body, token_address, token_symbol, creator_name)
     VALUES ${placeholders.join(', ')}`,
    values
  );
}

export async function markNotificationsRead(userAddress: string, ids?: number[]) {
  if (ids && ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    await pool.query(
      `UPDATE notifications SET read = TRUE WHERE user_address = $1 AND id IN (${placeholders})`,
      [userAddress.toLowerCase(), ...ids]
    );
  } else {
    await pool.query('UPDATE notifications SET read = TRUE WHERE user_address = $1', [userAddress.toLowerCase()]);
  }
}

export async function deleteNotification(userAddress: string, id: number) {
  await pool.query('DELETE FROM notifications WHERE id = $1 AND user_address = $2', [id, userAddress.toLowerCase()]);
}

// ============ Presale Events ============

export async function createPresaleEvent(data: {
  launch_id: number; creator_address: string; token_name: string; token_symbol: string;
  hard_cap: number; soft_cap: number; max_per_wallet: number; duration_seconds: number;
  vault_address?: string;
}) {
  const { rows } = await pool.query(
    `INSERT INTO presale_events (launch_id, creator_address, token_name, token_symbol, hard_cap, soft_cap, max_per_wallet, duration_seconds, vault_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [data.launch_id, data.creator_address.toLowerCase(), data.token_name, data.token_symbol,
     data.hard_cap, data.soft_cap, data.max_per_wallet, data.duration_seconds, data.vault_address || null]
  );
  return { id: rows[0].id };
}

export async function getPresaleEvents(status?: string, limit = 20) {
  if (status) {
    const { rows } = await pool.query('SELECT * FROM presale_events WHERE status = $1 ORDER BY created_at DESC LIMIT $2', [status, limit]);
    return rows;
  }
  const { rows } = await pool.query('SELECT * FROM presale_events ORDER BY created_at DESC LIMIT $1', [limit]);
  return rows;
}

export async function getPresaleByLaunchId(launchId: number) {
  const { rows } = await pool.query('SELECT * FROM presale_events WHERE launch_id = $1', [launchId]);
  return rows[0] || null;
}

export async function updatePresaleStatus(launchId: number, status: string) {
  await pool.query('UPDATE presale_events SET status = $1 WHERE launch_id = $2', [status, launchId]);
}

export async function getFollowerAddresses(creatorAddress: string): Promise<string[]> {
  const { rows } = await pool.query(
    'SELECT follower_address FROM follows WHERE creator_address = $1',
    [creatorAddress.toLowerCase()]
  );
  return rows.map(r => r.follower_address);
}

// ============ Token Images ============

export async function saveTokenImage(tokenAddress: string, mimeType: string, imageBuffer: Buffer, uploadedBy?: string) {
  await pool.query(
    `INSERT INTO token_images (token_address, mime_type, image_data, uploaded_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (token_address) DO UPDATE SET mime_type = $2, image_data = $3, uploaded_by = $4, created_at = NOW()`,
    [tokenAddress.toLowerCase(), mimeType, imageBuffer, uploadedBy || null]
  );
}

export async function getTokenImage(tokenAddress: string) {
  const { rows } = await pool.query(
    'SELECT mime_type, image_data FROM token_images WHERE token_address = $1',
    [tokenAddress.toLowerCase()]
  );
  return rows[0] || null;
}

// ============ Token Creators ============

export async function registerTokenCreator(data: {
  token_address: string;
  creator_address: string;
  token_name: string;
  token_symbol: string;
  created_block?: number;
  description?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}) {
  await pool.query(
    `INSERT INTO token_creators (token_address, creator_address, token_name, token_symbol, created_block, description, twitter, telegram, website)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (token_address) DO NOTHING`,
    [data.token_address.toLowerCase(), data.creator_address.toLowerCase(),
     data.token_name, data.token_symbol, data.created_block || null,
     data.description || '', data.twitter || '', data.telegram || '', data.website || '']
  );
}

export async function getTokenCreator(tokenAddress: string) {
  const { rows } = await pool.query(
    'SELECT * FROM token_creators WHERE token_address = $1',
    [tokenAddress.toLowerCase()]
  );
  return rows[0] || null;
}

export async function getTokensByCreator(creatorAddress: string) {
  const { rows } = await pool.query(
    'SELECT * FROM token_creators WHERE creator_address = $1 ORDER BY created_at DESC',
    [creatorAddress.toLowerCase()]
  );
  return rows;
}

export default pool;
