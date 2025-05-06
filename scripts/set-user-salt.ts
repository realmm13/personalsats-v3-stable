import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  // Find all users missing encryptionSalt
  const users = await prisma.user.findMany({ where: { encryptionSalt: null } });
  for (const user of users) {
    const salt = crypto.randomBytes(16).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: { encryptionSalt: salt },
    });
    console.log(`✅ Set salt for user ${user.email} (${user.id})`);
  }
  console.log(`Done. Set salt for ${users.length} users.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect()); 