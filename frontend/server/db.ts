/**
 * Simple JSON file store — zero native dependencies.
 * Stores users and sessions in a JSON file on disk.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'cre8-data.json');

// Ensure parent directory exists (for Railway volumes like /app/data/cre8-data.json)
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

interface User {
  id: string;
  twitter_id: string;
  twitter_handle: string;
  twitter_name: string;
  twitter_avatar: string;
  wallet_address: string;
  encrypted_private_key: string;
  encryption_iv: string;
  encryption_tag: string;
  created_at: string;
}

interface Session {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

interface Store {
  users: User[];
  sessions: Session[];
}

function load(): Store {
  if (!existsSync(DB_PATH)) return { users: [], sessions: [] };
  try {
    return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return { users: [], sessions: [] };
  }
}

function save(store: Store) {
  writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
}

// ============ User operations ============

export function findUserByTwitterId(twitterId: string): User | undefined {
  return load().users.find(u => u.twitter_id === twitterId);
}

export function findUserById(id: string): User | undefined {
  return load().users.find(u => u.id === id);
}

export function createUser(user: User) {
  const store = load();
  store.users.push(user);
  save(store);
}

export function updateUserProfile(id: string, handle: string, name: string, avatar: string) {
  const store = load();
  const user = store.users.find(u => u.id === id);
  if (user) {
    user.twitter_handle = handle;
    user.twitter_name = name;
    user.twitter_avatar = avatar;
    save(store);
  }
}

// ============ Session operations ============

export function findValidSession(token: string): (Session & { user: User }) | undefined {
  const store = load();
  const session = store.sessions.find(s => s.token === token && new Date(s.expires_at) > new Date());
  if (!session) return undefined;
  const user = store.users.find(u => u.id === session.user_id);
  if (!user) return undefined;
  return { ...session, user };
}

export function createSession(session: Session) {
  const store = load();
  store.sessions.push(session);
  save(store);
}

export function deleteSession(token: string) {
  const store = load();
  store.sessions = store.sessions.filter(s => s.token !== token);
  save(store);
}

// ============ Wallet → User lookup ============

export function findUsersByWalletAddresses(addresses: string[]): Record<string, { handle: string; name: string; avatar: string }> {
  const store = load();
  const lower = addresses.map(a => a.toLowerCase());
  const result: Record<string, { handle: string; name: string; avatar: string }> = {};

  for (const user of store.users) {
    const idx = lower.indexOf(user.wallet_address.toLowerCase());
    if (idx !== -1) {
      result[addresses[idx].toLowerCase()] = {
        handle: user.twitter_handle,
        name: user.twitter_name,
        avatar: user.twitter_avatar,
      };
    }
  }

  return result;
}
