// Seeds a demo dataset so evaluators can log in and test immediately without manual setup.
// Run with: npm run seed
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ticketbooking.dev' },
    update: {},
    create: { name: 'Admin', email: 'admin@ticketbooking.dev', passwordHash, role: 'ADMIN' },
  });

  const organiser = await prisma.user.upsert({
    where: { email: 'organiser@ticketbooking.dev' },
    update: {},
    create: { name: 'Demo Organiser', email: 'organiser@ticketbooking.dev', passwordHash, role: 'ORGANISER' },
  });

  await prisma.user.upsert({
    where: { email: 'customer@ticketbooking.dev' },
    update: {},
    create: { name: 'Demo Customer', email: 'customer@ticketbooking.dev', passwordHash, role: 'CUSTOMER' },
  });

  const venue = await prisma.venue.create({
    data: {
      name: 'Marquee Grand Hall',
      address: '221B Cinema Road, Chennai',
      seatLayout: {
        rows: 6,
        cols: 10,
        categories: [
          { name: 'Premium', rowLabels: ['A', 'B'] },
          { name: 'Standard', rowLabels: ['C', 'D', 'E', 'F'] },
        ],
      },
    },
  });

  const event = await prisma.event.create({
    data: {
      title: 'Midnight Reels: Sci-Fi Marathon',
      type: 'MOVIE',
      description: 'A back-to-back screening of three cult classic sci-fi films.',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      venueId: venue.id,
      organiserId: organiser.id,
      pricing: { Premium: 500, Standard: 250 },
    },
  });

  const rowLabelForIndex = (i) => String.fromCharCode(65 + i);
  const seatRows = [];
  for (let r = 0; r < venue.seatLayout.rows; r++) {
    const rowLabel = rowLabelForIndex(r);
    const category = venue.seatLayout.categories.find((c) => c.rowLabels.includes(rowLabel)).name;
    for (let c = 1; c <= venue.seatLayout.cols; c++) {
      seatRows.push({ eventId: event.id, rowLabel, seatNumber: c, category });
    }
  }
  await prisma.seat.createMany({ data: seatRows });

  console.log('Seeded demo data:');
  console.log('  Admin login:     admin@ticketbooking.dev / password123');
  console.log('  Organiser login: organiser@ticketbooking.dev / password123');
  console.log('  Customer login:  customer@ticketbooking.dev / password123');
  console.log(`  Event: "${event.title}" (id: ${event.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
