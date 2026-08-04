import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from '../src/lib/firebase-admin';

function calculateMonthlyAmount(item: any): number {
  if (item.isCustomGoal && item.goal != null) {
    return item.goal;
  }

  const totalCost = item.totalCost || 0;
  const amount = item.amount || 0;
  const remainingCost = Math.max(0, totalCost - amount);

  if (item.dueDate) {
    const today = new Date();
    const parts = item.dueDate.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dueDate = new Date(year, month, day);

      const yearDiff = dueDate.getFullYear() - today.getFullYear();
      const monthDiff = dueDate.getMonth() - today.getMonth();
      const monthsRemaining = yearDiff * 12 + monthDiff + 1;

      if (monthsRemaining > 0) {
        return remainingCost / monthsRemaining;
      }
    }
  }

  if (item.recurrence) {
    switch (item.recurrence) {
      case 'Quarterly':
        return totalCost / 3;
      case 'Semi-Annually':
      case 'Semi-Annually (Custom)':
        return totalCost / 6;
      case 'Annually':
        return totalCost / 12;
      case 'Bi-Annually':
        return totalCost / 24;
      default:
        return 0;
    }
  }

  return 0;
}

async function main() {
  const snapshot = await db.collection('sinking-funds').get();
  console.log('=== Sinking Funds for EQ Sinking Funds ===');
  let sum = 0;
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.accountId === 'dicycI59Pk7C0hpDaHPA') {
      const m = calculateMonthlyAmount({ id: doc.id, ...data });
      sum += m;
      console.log(`- Name: ${data.name}, Calculated: ${m}`);
    }
  });
  console.log('Total Sum:', sum);
}

main().catch(console.error);
