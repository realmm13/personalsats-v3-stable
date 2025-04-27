// @ts-check

import { PrismaClient } from "@/generated/prisma";
// Remove auth import if not needed elsewhere
// import { auth } from "@/server/auth"; 
import bcrypt from "bcrypt"; // Import bcrypt

const prisma = new PrismaClient();

// users array definition might not be needed anymore if we don't create users here
/*
const users: { ... }[] = [ ... ];
*/

(async function main() {
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

  console.log("Finding existing user user1@gmail.com...");
  
  // Find user1 directly in the database
  const user1 = await prisma.user.findUnique({
    where: { email: "user1@gmail.com" },
  });

  if (!user1) {
    console.error("User user1@gmail.com not found. Please ensure this user exists.");
    process.exit(1); // Exit if user not found
    return;
  }

  console.log(`Found user ${user1.email}. Deleting existing transactions...`);

  // Delete any existing transactions for this user first
  await prisma.bitcoinTransaction.deleteMany({
    where: { userId: user1.id },
  });

  console.log(`Seeding transactions for ${user1.email}...`);

  const sampleTransactions = [
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

  await prisma.bitcoinTransaction.createMany({
    data: sampleTransactions,
  });

  console.log("Transactions seeded for user1.");

})().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
