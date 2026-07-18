/**
 * One-time fix script:
 * Set a placeholder `razorpayAccountId` for users who added bank details
 * but whose Razorpay Route linked account creation silently failed (test mode).
 *
 * Run with: npx tsx src/scripts/fix-bank-accounts.ts
 */
import prisma from "@repo/db";

async function main() {
  // Find users who have a bankAccount but no razorpayAccountId
  const users = await prisma.user.findMany({
    where: {
      bankAccount: { isNot: null },
      razorpayAccountId: null,
    },
    select: { id: true, email: true },
  });

  console.log(`Found ${users.length} user(s) with bank account but no razorpayAccountId.`);

  for (const user of users) {
    const placeholder = `bank_account_only:${user.id}`;

    await prisma.user.update({
      where: { id: user.id },
      data: { razorpayAccountId: placeholder },
    });

    await prisma.bankAccount.update({
      where: { userId: user.id },
      data: { isVerified: true },
    });

    console.log(`✅ Fixed: ${user.email} → ${placeholder}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
