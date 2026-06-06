import { requestSOABus } from './lib/soabus';
import { prisma } from './lib/prisma';

async function testAction(actionName: string) {
  try {
    console.log(`Testing action: ${actionName}`);
    const { status, data } = await requestSOABus('sales', JSON.stringify({ action: actionName }));
    console.log(`Status: ${status}`);
    if (status === 'NK') {
      console.error(`Error from ESB: ${data}`);
    } else {
      console.log(`Success! Data length: ${data.length}`);
      console.log(`Preview: ${data.substring(0, 150)}...`);
    }
  } catch (err: any) {
    console.error(`Exception during action ${actionName}:`, err.message);
  }
}

async function main() {
  await testAction('orders');
  await testAction('reservations');
  await testAction('history');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
