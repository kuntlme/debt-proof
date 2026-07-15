import prisma from "@repo/db";
import { decryptWallet, getProvider } from "./blockchain.service";
import crypto from "crypto";
import { ethers } from "ethers";

function decryptAES(encryptedText: string): string {
  const keyStr = process.env.WALLET_ENCRYPTION_SECRET || "default-key-32-bytes-exactly!!!!";
  const key = keyStr.slice(0, 32).padEnd(32, "0");
  const parts = encryptedText.split(":");
  const ivStr = parts[0];
  const encryptedStr = parts[1];
  if (parts.length !== 2 || !ivStr || !encryptedStr) {
    throw new Error("Invalid AES encrypted format");
  }
  const iv = Buffer.from(ivStr, "hex");
  const encrypted = Buffer.from(encryptedStr, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Retrieve and decrypt a user's Ethereum private key from their stored
 * encrypted keystore JSON (written at onboarding) or AES-encrypted phrase.
 */
export async function getPrivateKeyForUser(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { encryptedSeedPhrase: true },
  });

  if (!user?.encryptedSeedPhrase) {
    throw new Error(
      `User ${userId} has no encrypted wallet. Complete onboarding first.`
    );
  }

  const phraseOrJson = user.encryptedSeedPhrase.trim();

  // If it looks like JSON, treat it as a standard keystore JSON
  if (phraseOrJson.startsWith("{") || phraseOrJson.includes('"crypto"')) {
    const password = process.env.WALLET_ENCRYPTION_SECRET || userId;
    const wallet = await decryptWallet(phraseOrJson, password);
    return wallet.privateKey;
  }

  // Otherwise, treat it as AES-256-CBC encrypted mnemonic or private key
  try {
    const decrypted = decryptAES(phraseOrJson);
    const provider = getProvider();
    
    // Check if it's a seed phrase (usually 12 or 24 words)
    if (decrypted.split(/\s+/).length >= 12) {
      const wallet = ethers.Wallet.fromPhrase(decrypted, provider);
      return wallet.privateKey;
    } else {
      // Treat as raw private key
      const wallet = new ethers.Wallet(decrypted, provider);
      return wallet.privateKey;
    }
  } catch (error: any) {
    throw new Error(`Failed to decrypt user wallet: ${error.message}`);
  }
}

