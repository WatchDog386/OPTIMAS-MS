/**
 * Demo data so the app is usable immediately after setup.
 * Default password for every account: Optimas@2026
 */
import { PrismaClient, type Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Sample accounts share a known password: never on a live server
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== '1') {
    throw new Error('Refusing to load sample data on a production server (NODE_ENV=production).');
  }
  const passwordHash = await bcrypt.hash('Optimas@2026', 10);
  const people: { staffNo: string; name: string; email: string; role: Role; region: string; phone: string }[] = [
    { staffNo: 'OPT-ADM-001', name: 'Grace Wanjiru', email: 'admin@optimas.co.ke', role: 'ADMIN', region: 'HQ', phone: '+254700000001' },
    { staffNo: 'OPT-SUP-001', name: 'Daniel Otieno', email: 'supervisor@optimas.co.ke', role: 'SUPERVISOR', region: 'Nairobi', phone: '+254700000002' },
    { staffNo: 'OPT-STR-001', name: 'Mercy Achieng', email: 'store@optimas.co.ke', role: 'STOREKEEPER', region: 'Nairobi', phone: '+254700000003' },
    { staffNo: 'OPT-TEC-001', name: 'Brian Kiprono', email: 'brian@optimas.co.ke', role: 'TECHNICIAN', region: 'Westlands', phone: '+254700000011' },
    { staffNo: 'OPT-TEC-002', name: 'Kevin Mwangi', email: 'kevin@optimas.co.ke', role: 'TECHNICIAN', region: 'Kilimani', phone: '+254700000012' },
    { staffNo: 'OPT-TEC-003', name: 'Faith Njeri', email: 'faith@optimas.co.ke', role: 'TECHNICIAN', region: 'Kasarani', phone: '+254700000013' },
  ];
  const users: Record<string, string> = {};
  // A demo customer login (Amani Apartments, account OPT-CUS-10421)
  await prisma.user.upsert({
    where: { staffNo: 'OPT-CUS-10421' },
    update: {},
    create: {
      staffNo: 'OPT-CUS-10421',
      name: 'Amani Apartments B4',
      email: 'amani.b4@example.com',
      phone: '+254711222333',
      role: 'CUSTOMER',
      customerAccount: 'OPT-CUS-10421',
      address: 'Ring Rd Kilimani, Nairobi',
      passwordHash,
    },
  });
  for (const p of people) {
    const u = await prisma.user.upsert({ where: { staffNo: p.staffNo }, update: {}, create: { ...p, passwordHash } });
    users[p.staffNo] = u.id;
  }
  const store = users['OPT-STR-001'];

  const catalogue = [
    { sku: 'RTR-HW-AX3', name: 'Huawei AX3 Wi-Fi 6 Router', category: 'ROUTER', tracking: 'SERIALIZED', unit: 'pcs', unitPrice: 6500, reorderLevel: 10 },
    { sku: 'RTR-TP-C6', name: 'TP-Link Archer C6 Router', category: 'ROUTER', tracking: 'SERIALIZED', unit: 'pcs', unitPrice: 4800, reorderLevel: 10 },
    { sku: 'ONT-HG8145', name: 'Huawei HG8145V5 ONT', category: 'ONT', tracking: 'SERIALIZED', unit: 'pcs', unitPrice: 5200, reorderLevel: 10 },
    { sku: 'CBL-DROP-1C', name: 'Fibre drop cable (1 core)', category: 'CABLE', tracking: 'BULK', unit: 'm', unitPrice: 35, reorderLevel: 500 },
    { sku: 'CBL-CAT6', name: 'CAT6 UTP cable', category: 'CABLE', tracking: 'BULK', unit: 'm', unitPrice: 60, reorderLevel: 300 },
    { sku: 'CON-SC-APC', name: 'SC/APC fast connector', category: 'CONNECTOR', tracking: 'BULK', unit: 'pcs', unitPrice: 150, reorderLevel: 100 },
    { sku: 'CON-RJ45', name: 'RJ45 connector', category: 'CONNECTOR', tracking: 'BULK', unit: 'pcs', unitPrice: 20, reorderLevel: 200 },
    { sku: 'ACC-CLIP', name: 'Cable clips (pack of 100)', category: 'ACCESSORY', tracking: 'BULK', unit: 'packs', unitPrice: 250, reorderLevel: 20 },
  ] as const;

  const items: Record<string, string> = {};
  for (const c of catalogue) {
    const item = await prisma.inventoryItem.upsert({ where: { sku: c.sku }, update: {}, create: { ...c } });
    items[c.sku] = item.id;
  }

  // Receive stock into the store (idempotent: only when the store is empty).
  if ((await prisma.serialUnit.count()) === 0) {
    const serialised = ['RTR-HW-AX3', 'RTR-TP-C6', 'ONT-HG8145'];
    for (const sku of serialised) {
      for (let i = 1; i <= 12; i++) {
        const serialNumber = `${sku.split('-')[1]}${String(240000 + i * 37)}`.toUpperCase();
        const unit = await prisma.serialUnit.create({ data: { itemId: items[sku], serialNumber } });
        await prisma.stockMovement.create({ data: { type: 'RECEIVE', itemId: items[sku], serialUnitId: unit.id, quantity: 1, actorId: store } });
      }
    }
    const bulk: [string, number][] = [['CBL-DROP-1C', 3000], ['CBL-CAT6', 1500], ['CON-SC-APC', 400], ['CON-RJ45', 1000], ['ACC-CLIP', 80]];
    for (const [sku, qty] of bulk) {
      await prisma.inventoryItem.update({ where: { id: items[sku] }, data: { storeQuantity: qty } });
      await prisma.stockMovement.create({ data: { type: 'RECEIVE', itemId: items[sku], quantity: qty, actorId: store } });
    }

    // Issue a starter kit to each technician: 2 routers pending acceptance + cable and connectors.
    const techs = ['OPT-TEC-001', 'OPT-TEC-002', 'OPT-TEC-003'].map((s) => users[s]);
    const routers = await prisma.serialUnit.findMany({ where: { itemId: items['RTR-HW-AX3'] }, take: techs.length * 2 });
    for (const [i, techId] of techs.entries()) {
      for (const unit of routers.slice(i * 2, i * 2 + 2)) {
        await prisma.serialUnit.update({ where: { id: unit.id }, data: { status: 'IN_TRANSIT', holderId: techId, heldSince: new Date() } });
        await prisma.stockMovement.create({
          data: { type: 'ISSUE', itemId: unit.itemId, serialUnitId: unit.id, quantity: 1, toUserId: techId, actorId: store },
        });
      }
      for (const [sku, qty] of [['CBL-DROP-1C', 200], ['CON-SC-APC', 20], ['CON-RJ45', 30]] as const) {
        await prisma.inventoryItem.update({ where: { id: items[sku] }, data: { storeQuantity: { decrement: qty } } });
        await prisma.bulkHolding.create({ data: { itemId: items[sku], userId: techId, quantity: qty } });
        await prisma.stockMovement.create({ data: { type: 'ISSUE', itemId: items[sku], quantity: qty, toUserId: techId, actorId: store } });
      }
    }
  }

  if ((await prisma.task.count()) === 0) {
    const sup = users['OPT-SUP-001'];
    const jobs = [
      { title: 'New fibre installation — 20 Mbps', type: 'INSTALLATION', priority: 'HIGH', customerName: 'Amani Apartments, Unit B4', customerPhone: '+254711222333', customerAccount: 'OPT-CUS-10421', address: 'Ring Rd Kilimani, Nairobi', lat: -1.2905, lng: 36.7834, assigneeId: users['OPT-TEC-001'] },
      { title: 'No internet — LOS red light', type: 'REPAIR', priority: 'URGENT', customerName: 'Mama Njeri Supermarket', customerPhone: '+254722444555', customerAccount: 'OPT-CUS-08817', address: 'Kasarani Mwiki Rd', lat: -1.2208, lng: 36.8986, assigneeId: users['OPT-TEC-003'] },
      { title: 'Router relocation to 2nd floor', type: 'RELOCATION', priority: 'NORMAL', customerName: 'Peter Kamau', customerPhone: '+254733666777', customerAccount: 'OPT-CUS-09902', address: 'Westlands, Rhapta Rd', lat: -1.2669, lng: 36.8045, assigneeId: users['OPT-TEC-001'] },
      { title: 'Site survey for business link', type: 'SURVEY', priority: 'LOW', customerName: 'Savannah Logistics Ltd', customerPhone: '+254744888999', address: 'Mombasa Rd, ICD', assigneeId: users['OPT-TEC-002'] },
    ] as const;
    for (const [i, j] of jobs.entries()) {
      await prisma.task.create({
        data: { ...j, code: `JOB-DEMO-${String(i + 1).padStart(3, '0')}`, createdById: sup, dueAt: new Date(Date.now() + (i + 1) * 3 * 3600_000) },
      });
    }
  }

  console.log('✅ Seed complete. Log in with a staff number (e.g. OPT-TEC-001 / OPT-SUP-001) or the customer account OPT-CUS-10421; password Optimas@2026');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
