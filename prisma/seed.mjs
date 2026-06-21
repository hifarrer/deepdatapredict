// Idempotent seed: plans, the admin account, and default site settings.
// Run with `npm run db:seed` (or `npx prisma db seed`).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PLANS = [
  {
    slug: "free",
    name: "Free",
    priceCents: 0,
    yearlyPriceCents: 0,
    monthlyQuota: 3,
    sortOrder: 0,
    features: ["3 predictions / month", "Live event dashboard", "Saved history"],
  },
  {
    slug: "basic",
    name: "Basic",
    priceCents: 900,
    yearlyPriceCents: 9000,
    monthlyQuota: 10,
    sortOrder: 1,
    features: [
      "10 predictions / month",
      "Deep web research",
      "Live event dashboard",
      "Full history & export",
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    priceCents: 1900,
    yearlyPriceCents: 19000,
    monthlyQuota: 50,
    sortOrder: 2,
    features: [
      "50 predictions / month",
      "Deep web research",
      "Priority analysis queue",
      "Full history & export",
    ],
  },
];

async function main() {
  // Plans
  for (const p of PLANS) {
    await prisma.plan.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        priceCents: p.priceCents,
        yearlyPriceCents: p.yearlyPriceCents,
        monthlyQuota: p.monthlyQuota,
        sortOrder: p.sortOrder,
        features: p.features,
        isActive: true,
      },
      create: {
        slug: p.slug,
        name: p.name,
        priceCents: p.priceCents,
        yearlyPriceCents: p.yearlyPriceCents,
        monthlyQuota: p.monthlyQuota,
        sortOrder: p.sortOrder,
        features: p.features,
        interval: "month",
        isActive: true,
      },
    });
  }
  console.log(`Seeded ${PLANS.length} plans.`);

  // Admin account (password changeable from admin settings).
  const proPlan = await prisma.plan.findUnique({ where: { slug: "pro" } });
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@deepdatadirect.com" },
    update: { role: "ADMIN", planId: proPlan?.id },
    create: {
      email: "admin@deepdatadirect.com",
      passwordHash,
      name: "Admin",
      role: "ADMIN",
      planId: proPlan?.id,
      credits: proPlan?.monthlyQuota ?? 50,
      creditsResetAt: new Date(),
    },
  });
  console.log("Seeded admin user admin@deepdatadirect.com (password: admin123).");

  // Default site settings.
  await prisma.siteSetting.upsert({
    where: { key: "maxLiveEvents" },
    update: {},
    create: { key: "maxLiveEvents", value: 20 },
  });
  console.log("Seeded site settings.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
