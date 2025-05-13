import { PrismaClient } from '@prisma/client';
import { hexToBytes, deriveKey } from '../src/lib/encryption';
import { decryptTxPayload } from '../src/lib/serverCrypto';

async function main() {
  const prisma = new PrismaClient();
  // TODO: Replace with your actual user selection logic
  const user = await prisma.user.findFirst({ where: { /* your test user criteria */ } });
  if (!user?.encryptionSalt) {
    console.error('❌ NO encryptionSalt for user!');
    process.exit(1);
  }
  // Derive key once
  const key = await deriveKey('your-passphrase', hexToBytes(user.encryptionSalt));
  console.log('🔑 Derived key ok');

  // Fetch first 10 records
  const txs = await prisma.bitcoinTransaction.findMany({
    where: { userId: user.id },
    take: 10,
    select: { id: true, encryptedData: true },
  });

  for (const { id, encryptedData } of txs) {
    try {
      const clear = await decryptTxPayload(encryptedData, key);
      console.log(`✅ ${id} decrypted`, clear);
    } catch (err) {
      console.error(`❌ ${id} failed:`, err);
    }
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 