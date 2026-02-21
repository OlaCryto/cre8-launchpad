import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

/** Generate a new wallet and return address + encrypted private key */
export function generateWallet() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return {
    address: account.address,
    encryptedKey: encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/** Decrypt a stored private key */
export function decryptPrivateKey(encrypted: string, iv: string, tag: string): `0x${string}` {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted as `0x${string}`;
}
