
import { getSinkingFundTransactions } from '@/services/savings-service';
import { SinkingFundClientPage } from './sinking-fund-client-page';
import { db } from '@/lib/firebase-admin';

export default async function SinkingFundDetailPage({ params }: { params: { fundId: string } }) {
  const { fundId } = params;

  const initialTransactions = await getSinkingFundTransactions(db, fundId);

  return (
    <SinkingFundClientPage 
      fundId={fundId}
      initialTransactions={initialTransactions}
    />
  );
}
