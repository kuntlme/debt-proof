import prisma from '@repo/db';

async function main() {
  console.log("=== USERS ===");
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, walletAddress: true, encryptedSeedPhrase: true }
  });
  console.log(JSON.stringify(users, null, 2));

  console.log("=== PERSONAL TOKENS ===");
  const tokens = await prisma.personalToken.findMany({
    include: {
      owner: { select: { name: true, email: true } }
    }
  });
  console.log(JSON.stringify(tokens, null, 2));

  console.log("=== TOKEN HOLDINGS ===");
  const holdings = await prisma.tokenHolding.findMany({
    include: {
      token: { select: { tokenName: true, symbol: true } },
      holder: { select: { name: true, email: true } }
    }
  });
  console.log(JSON.stringify(holdings, null, 2));

  console.log("=== LOANS ===");
  const loans = await prisma.loan.findMany();
  console.log(JSON.stringify(loans, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
