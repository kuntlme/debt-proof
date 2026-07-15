import prisma from '@repo/db';

async function main() {
  console.log("Fixing database token holdings for repaid loan cmrmj4ngj0002jwm9iwd4z37c...");

  // 1. Deduct 1000 KUNTL from borrower (CSE_66_Kuntal Majee: cmrm8ugqu00003om9mahyzm9m)
  const borrowerHolding = await prisma.tokenHolding.update({
    where: {
      tokenId_holderId: {
        tokenId: "cmrmim3fa00001km9d5f94rwf",
        holderId: "cmrm8ugqu00003om9mahyzm9m"
      }
    },
    data: {
      balance: 9010 // 10010 - 1000
    }
  });
  console.log("Updated Borrower Holding:", borrowerHolding);

  // 2. Upsert 1000 KUNTL for lender (Kuntal Magee: cmrm9c97j00005cm9n1bc39wg)
  const lenderHolding = await prisma.tokenHolding.upsert({
    where: {
      tokenId_holderId: {
        tokenId: "cmrmim3fa00001km9d5f94rwf",
        holderId: "cmrm9c97j00005cm9n1bc39wg"
      }
    },
    update: {
      balance: 1000
    },
    create: {
      tokenId: "cmrmim3fa00001km9d5f94rwf",
      holderId: "cmrm9c97j00005cm9n1bc39wg",
      balance: 1000
    }
  });
  console.log("Updated Lender Holding:", lenderHolding);

  console.log("Done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
