// @ts-check

import { PrismaClient } from "@/generated/prisma";
// Remove auth import if not needed elsewhere
// import { auth } from "@/server/auth"; 
import bcrypt from "bcrypt"; // Import bcrypt
// Import Node.js crypto for Web Crypto API access in script environment
import { webcrypto as crypto } from 'node:crypto'; 
// Import encryption utils using alias
import { generateEncryptionKey, encryptString } from "@/lib/encryption"; 

const prisma = new PrismaClient();

// users array definition might not be needed anymore if we don't create users here
/*
const users: { ... }[] = [ ... ];
*/

// --- Define Seed Passphrase --- 
// IMPORTANT: Use this same passphrase in your app to decrypt these seeds
const SEED_PASSPHRASE = "seedPhrase123"; 
// -----------------------------

(async function main() {
  // Generate the CryptoKey for seeding
  console.log(`Generating encryption key from seed passphrase...`);
  let encryptionKey: CryptoKey;
  try {
    // @ts-ignore Assuming generateEncryptionKey is compatible with Node's CryptoKey
    encryptionKey = await generateEncryptionKey(SEED_PASSPHRASE);
    console.log("✅ Seed encryption key generated.");
  } catch(e) {
    console.error("❌ Failed to generate seed encryption key:", e);
    process.exit(1);
  }

  // --- Add Test User --- 
  console.log("Attempting to create test user...");
  const testEmail = "testuser@example.com";
  const testPlainPassword = "password123"; // Changed back to 8+ characters

  try {
    const existingTestUser = await prisma.user.findUnique({ where: { email: testEmail } });
    // Find existing account to update password, or create if not found
    const existingAccount = await prisma.account.findFirst({
        where: {
            userId: existingTestUser?.id,
            providerId: "credential",
        }
    });

    const hashedTestPassword = await bcrypt.hash(testPlainPassword, 10);

    if (existingTestUser && existingAccount) {
        console.log(`Test user ${testEmail} and credential account exist. Updating password.`);
        await prisma.account.update({
            where: { id: existingAccount.id },
            data: { 
                password: hashedTestPassword, 
                type: "credentials"
            }
        });
        console.log(`✅ Updated password for test user ${testEmail} to '${testPlainPassword}'`);
    } else if (existingTestUser && !existingAccount) {
        console.log(`Test user ${testEmail} exists, but credential account missing. Creating account.`);
        await prisma.account.create({
            data: {
                userId: existingTestUser.id,
                providerId: "credential", 
                accountId: testEmail, 
                password: hashedTestPassword,
                type: "credentials",
                createdAt: new Date(),
            },
        });
        console.log(`✅ Created account and set password for ${testEmail} to '${testPlainPassword}'`);
    } else {
        console.log(`Creating test user ${testEmail}.`);
        const testUser = await prisma.user.create({
            data: {
            email: testEmail,
            name: "Test User",
            emailVerified: true, 
            role: "user",
            },
        });

        await prisma.account.create({
            data: {
            userId: testUser.id,
            providerId: "credential", 
            accountId: testEmail, 
            password: hashedTestPassword,
            type: "credentials",
            createdAt: new Date(), 
            },
        });
        console.log(`✅ Created test user ${testEmail} with password '${testPlainPassword}'`);
    }
  } catch (error) {
    console.error("Error creating/updating test user:", error);
  }
  // --- End Add Test User ---

  // --- Find or Create user1@gmail.com ---
  const user1Email = "user1@gmail.com";
  console.log(`Finding or creating user ${user1Email}...`);
  let user1 = await prisma.user.findUnique({ where: { email: user1Email } });

  if (!user1) {
    console.log(`User ${user1Email} not found. Creating...`);
    try {
      user1 = await prisma.user.create({
        data: {
          email: user1Email,
          name: "User One",
          emailVerified: true, // Assuming verified for simplicity in seeding
          role: "user",
          // Add any other required fields for the User model
        },
      });
      console.log(`✅ Created user ${user1Email}.`);
      // Optionally create a credential account for user1 as well, similar to testuser
      // const user1Password = "password123"; // Example password
      // const hashedUser1Password = await bcrypt.hash(user1Password, 10);
      // await prisma.account.create({ data: { userId: user1.id, ... } });
    } catch (error) {
      console.error(`❌ Failed to create user ${user1Email}:`, error);
      process.exit(1); // Exit if user creation fails
    }
  } else {
    console.log(`Found existing user ${user1Email}.`);
  }
  // --- End Find or Create user1@gmail.com ---

  console.log(`Deleting existing transactions for ${user1.email}...`); // Use user1 safely now
  await prisma.bitcoinTransaction.deleteMany({ where: { userId: user1.id } });
  console.log(`✅ Existing transactions deleted for ${user1.email}.`);

  console.log(`Seeding encrypted transactions for ${user1.email}...`);

  const sampleTransactionsRaw = [
    {
      type: "buy",
      amount: 0.5,
      price: 65000,
      timestamp: new Date("2024-03-10T10:00:00Z"),
      fee: 15.50,
      wallet: "Ledger Nano X",
      tags: ["long-term", "hardware"],
      notes: "First major BTC purchase",
      userId: user1.id,
    },
    {
      type: "buy",
      amount: 0.2,
      price: 68500,
      timestamp: new Date("2024-04-15T14:30:00Z"),
      fee: 8.20,
      wallet: "Coinbase",
      tags: ["dca"],
      notes: "Dollar cost averaging buy",
      userId: user1.id,
    },
    {
      type: "sell",
      amount: 0.1,
      price: 71000,
      timestamp: new Date("2024-05-01T09:15:00Z"),
      fee: 5.00,
      wallet: "Coinbase",
      tags: ["short-term", "profit"],
      notes: "Taking small profit",
      userId: user1.id,
    },
    {
      type: "buy",
      amount: 0.3,
      price: 66000,
      timestamp: new Date("2024-05-20T18:00:00Z"),
      fee: 12.00,
      wallet: "Ledger Nano X",
      tags: ["long-term"],
      userId: user1.id, 
    },
  ];

  // Encrypt the transactions
  const encryptedTransactionsData = await Promise.all(
    sampleTransactionsRaw.map(async (tx) => {
      // Select fields to encrypt
      const payloadToEncrypt = {
        type: tx.type,
        amount: tx.amount,
        price: tx.price,
        fee: tx.fee,
        wallet: tx.wallet,
        tags: tx.tags,
        notes: tx.notes,
      };
      // Encrypt the payload
      // @ts-ignore Assuming encryptString is compatible with Node's CryptoKey
      const encrypted = await encryptString(JSON.stringify(payloadToEncrypt), encryptionKey);
      
      // Return data structure for createMany
      return {
        userId: user1.id,
        timestamp: tx.timestamp, // Keep original timestamp
        encryptedData: encrypted, // Store the encrypted blob
      };
    })
  );

  // Seed the encrypted data
  await prisma.bitcoinTransaction.createMany({
    data: encryptedTransactionsData,
  });

  console.log(`✅ ${encryptedTransactionsData.length} encrypted transactions seeded for ${user1.email}.`);

})().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
