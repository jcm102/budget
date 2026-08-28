import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve('/Users/jordan/Downloads/project-2/.env.local') });

async function test() {
  const { adminDb } = await import('../src/lib/firebase-admin');
  
  console.log('Fetching all sinking funds from DB...');
  const snap = await adminDb.collection('sinking-funds').get();
  console.log(`Found ${snap.size} sinking funds:`);
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id}, Name: "${data.name}", AccountId: "${data.accountId}", Amount: ${data.amount}`);
  });

  console.log('\nFetching all accounts (transferees) from DB...');
  const accountsSnap = await adminDb.collection('transferees').get();
  accountsSnap.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id}, Name: "${data.name}", Type: "${data.type}"`);
  });
}

test().catch(console.error);
