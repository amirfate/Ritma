// Ritma seed — idempotent demo data (development only)
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('Passw0rd!123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'amir@ritma.app' },
    update: { role: 'ADMIN', plan: 'PREMIUM' },
    create: {
      email: 'amir@ritma.app',
      passwordHash: adminHash,
      name: 'امیر (مدیر)',
      role: 'ADMIN',
      plan: 'PREMIUM',
    },
  });
  await prisma.user.upsert({
    where: { email: 'free2@ritma.app' },
    update: {},
    create: { email: 'free2@ritma.app', passwordHash: adminHash, name: 'کاربر رایگان' },
  });

  const plans = [
    { code: 'monthly', title: 'اشتراک ماهانه', durationDays: 30, priceIrR: 290000 },
    { code: 'quarterly', title: 'اشتراک سه‌ماهه', durationDays: 90, priceIrR: 790000 },
    { code: 'yearly', title: 'اشتراک سالانه', durationDays: 365, priceIrR: 2490000 },
  ];
  for (const plan of plans) {
    await prisma.plan.upsert({ where: { code: plan.code }, update: plan, create: plan });
  }

  const artist = await prisma.artist.upsert({
    where: { slug: 'homayoun-shajarian' },
    update: { ownerUserId: admin.id },
    create: {
      slug: 'homayoun-shajarian',
      name: 'همایون شجریان',
      bio: 'نمونه‌ی دمو برای توسعه',
      ownerUserId: admin.id,
    },
  });

  const album = await prisma.album.upsert({
    where: { artistId_slug: { artistId: artist.id, slug: 'demo-album' } },
    update: {},
    create: { slug: 'demo-album', title: 'آلبوم نمونه', artistId: artist.id },
  });

  const tracks = [
    { title: 'قطعه‌ی اول', position: 1, isPremium: false },
    { title: 'قطعه‌ی دوم', position: 2, isPremium: true },
    { title: 'قطعه‌ی سوم', position: 3, isPremium: false },
  ];
  let index = 0;
  for (const track of tracks) {
    index += 1;
    const existing = await prisma.track.findFirst({
      where: { artistId: artist.id, title: track.title },
    });
    if (existing) continue;
    await prisma.track.create({
      data: {
        title: track.title,
        artistId: artist.id,
        albumId: album.id,
        position: track.position,
        durationSec: 180 + index * 30,
        isPublished: true,
        isPremium: track.isPremium,
        // key relative to MEDIA_DIR — file is created by scripts/gen-demo-audio.sh
        audioUrl: `audio/demo-${index}.m4a`,
      },
    });
  }
  // Beta invites for the admin (phase 1) — `admin` is already defined above
  if (admin) {
    for (const code of ['RITMA-DEMO001', 'RITMA-DEMO002', 'RITMA-DEMO003']) {
      await prisma.invite.upsert({
        where: { code },
        update: {},
        create: { code, invitedByUserId: admin.id, note: 'seed demo invite' },
      });
    }
  }
  console.log('seed done');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
