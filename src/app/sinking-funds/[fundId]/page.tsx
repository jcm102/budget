
import { getSinkingFundTransactions } from '@/services/savings-service';
import { SinkingFundClientPage } from './sinking-fund-client-page';

export default async function SinkingFundDetailPage({ params }: { params: { fundId: string } }) {
  const { fundId } = params;

  const initialTransactions = await getSinkingFundTransactions(fundId);

  return (
    <SinkingFundClientPage 
      fundId={fundId}
      initialTransactions={initialTransactions}
    />
  );
}
