import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SEED_USER = {
  email: 'user@example.com',
  password: '123456',
  name: 'CRM Admin',
};

const SEED_LINE_ACCOUNT = {
  name: 'Demo LINE OA',
  channelSecret: '78f3efadecb5c1ded77e2bcf076c326c',
  channelAccessToken:
    'T9XyERwk3FA8WApDB/dyAPxHQ8F3d0xuNOKBs8wC2nozfHd36tT7OHiLexxRBLgw+p0W43P1r8nG6JtRWfUX8cHz3cD1T541KUFuT+jmaU5V10ibVQ4kbITSchr2O57zFeG0JPMAq3mUTOBcNCS5lgdB04t89/1O/w1cDnyilFU=',
};

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash(SEED_USER.password, 10);

  const user = await prisma.user.upsert({
    where: { email: SEED_USER.email },
    update: {
      name: SEED_USER.name,
      password: hashedPassword,
    },
    create: {
      email: SEED_USER.email,
      password: hashedPassword,
      name: SEED_USER.name,
    },
  });

  await prisma.lineAccount.upsert({
    where: { userId: user.id },
    update: {
      name: SEED_LINE_ACCOUNT.name,
      channelSecret: SEED_LINE_ACCOUNT.channelSecret,
      channelAccessToken: SEED_LINE_ACCOUNT.channelAccessToken,
    },
    create: {
      userId: user.id,
      name: SEED_LINE_ACCOUNT.name,
      channelSecret: SEED_LINE_ACCOUNT.channelSecret,
      channelAccessToken: SEED_LINE_ACCOUNT.channelAccessToken,
    },
  });

  console.log('Seed completed.');
  console.log(`Login: ${SEED_USER.email} / ${SEED_USER.password}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
