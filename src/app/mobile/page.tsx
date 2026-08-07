'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import useEmblaCarousel from 'embla-carousel-react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  Calculator as CalcIcon, 
  PlusCircle, 
  TrendingUp, 
  TrendingDown, 
  ArrowRightLeft,
  Loader2,
  Check,
  Monitor,
  LogOut
} from 'lucide-react';
import { cn, generateUUID } from '@/lib/utils';
import { useTransactionLedger } from '@/app/transactions/hooks/use-transaction-ledger';
import { useFloatingCalculator } from '@/hooks/use-floating-calculator';
import type { AccountDetails } from '@/types';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function MobileTransactionPage() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  
  // Date ranges for transaction ledger
  const today = useMemo(() => new Date(), []);
  const startOfCurrMonth = useMemo(() => format(startOfMonth(today), 'yyyy-MM-dd'), [today]);
  const endOfCurrMonth = useMemo(() => format(endOfMonth(today), 'yyyy-MM-dd'), [today]);

  const {
    accounts,
    categories,
    isLoading: isLoadingData,
    addTransaction,
  } = useTransactionLedger(startOfCurrMonth, endOfCurrMonth);

  // Layout states
  const [activeDialog, setActiveDialog] = useState<'expense' | 'income' | 'transfer' | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Form States (Inside popups)
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculator Integration
  const setIsCalculatorOpen = useFloatingCalculator(state => state.setIsOpen);
  const setIsCalculatorMinimized = useFloatingCalculator(state => state.setIsMinimized);
  const setOnUseCalculatorResult = useFloatingCalculator(state => state.setOnUseResult);

  // Filter to show ONLY the first 3 requested accounts in order
  const filteredAccounts = useMemo(() => {
    const allowedNames = ['Libro Chequing', 'EQ Card', 'Wealthsimple Mastercard'];
    const matches = allowedNames
      .map(name => accounts.find(a => a.name.toLowerCase() === name.toLowerCase()))
      .filter((a): a is AccountDetails => !!a);
      
    if (matches.length > 0) return matches;
    return accounts.slice(0, 3); // Fallback to first 3 if none match in dev
  }, [accounts]);

  // Embla Carousel Setup for looping
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'center' });

  // Sync selected account with active carousel slide
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const selectedIndex = emblaApi.selectedScrollSnap();
      const activeAccount = filteredAccounts[selectedIndex];
      if (activeAccount && activeAccount.id !== selectedAccountId) {
        setSelectedAccountId(activeAccount.id);
      }
    };

    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, filteredAccounts, selectedAccountId]);

  // Sync carousel slide when selected account changes (e.g. initial load)
  useEffect(() => {
    if (!emblaApi || !selectedAccountId) return;
    const activeIndex = filteredAccounts.findIndex(a => a.id === selectedAccountId);
    if (activeIndex !== -1 && emblaApi.selectedScrollSnap() !== activeIndex) {
      emblaApi.scrollTo(activeIndex);
    }
  }, [emblaApi, selectedAccountId, filteredAccounts]);

  // Set default account when accounts load
  useEffect(() => {
    if (filteredAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(filteredAccounts[0].id);
    }
  }, [filteredAccounts, selectedAccountId]);

  // Set default category when categories load
  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // Reset form when dialog type changes
  useEffect(() => {
    setAmount('');
    setDescription('');
    setDestinationAccountId('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    if (categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [activeDialog, categories]);

  // Bind calculator result callback
  const handleOpenCalculator = () => {
    // Blur any focused input in the background dialog to prevent physical keyboard typing
    // from going to the form instead of the calculator
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    setOnUseCalculatorResult((value) => {
      setAmount(value);
      setIsCalculatorOpen(false);
    });
    setIsCalculatorOpen(true);
    setIsCalculatorMinimized(false);
  };

  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      toast({
        title: 'Error signing out',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSwitchToDesktop = () => {
    sessionStorage.setItem('forceDesktop', 'true');
    router.push('/budget');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDialog) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount greater than 0.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedAccountId) {
      toast({
        title: 'Account Required',
        description: 'Please select an account.',
        variant: 'destructive',
      });
      return;
    }

    if (activeDialog === 'transfer' && !destinationAccountId) {
      toast({
        title: 'Destination Account Required',
        description: 'Please select a destination account.',
        variant: 'destructive',
      });
      return;
    }

    if (activeDialog === 'transfer' && selectedAccountId === destinationAccountId) {
      toast({
        title: 'Invalid Transfer',
        description: 'Source and destination accounts must be different.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let transactionData: any = {
        description: description || (activeDialog === 'transfer' ? 'Transfer' : ''),
        amount: numAmount,
        date: date,
      };

      if (activeDialog === 'expense') {
        transactionData.sourceAccountId = selectedAccountId;
        transactionData.splits = [{
          id: generateUUID(),
          type: 'expense' as const,
          amount: numAmount,
          categoryId: categoryId,
        }];
      } else if (activeDialog === 'income') {
        transactionData.splits = [{
          id: generateUUID(),
          type: 'income' as const,
          amount: numAmount,
          destinationAccountId: selectedAccountId,
        }];
      } else if (activeDialog === 'transfer') {
        transactionData.sourceAccountId = selectedAccountId;
        transactionData.splits = [{
          id: generateUUID(),
          type: 'transfer' as const,
          amount: numAmount,
          destinationAccountId: destinationAccountId,
        }];
      }

      await addTransaction(transactionData);
      setActiveDialog(null); // Close popup on success
    } catch (err) {
      // Error toast is handled inside addTransaction
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-semibold">Loading your budget...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col justify-between p-4 bg-background mobile-page overflow-hidden no-print">
      
      {/* Top Section Group (Packs elements closely together with gap-4) */}
      <div className="flex flex-col gap-4 w-full">
        {/* Title Header (Super compact, saves vertical space) */}
        <div className="flex justify-center items-center px-1 py-2 flex-shrink-0 text-center w-full">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-primary">Budget Quick Log</h1>
          </div>
        </div>

        {/* Account Selector (Infinite looping Embla Carousel, one card at a time) */}
        <section className="space-y-1.5 w-full max-w-full overflow-hidden flex-shrink-0">
          <div className="flex justify-center items-center px-1">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-center">Select Account</h2>
          </div>
          
          {/* Embla Viewport */}
          <div className="overflow-hidden w-full cursor-grab active:cursor-grabbing" ref={emblaRef}>
            {/* Embla Container */}
            <div className="flex">
              {filteredAccounts.map((acc, index) => {
                const isSelected = acc.id === selectedAccountId;
                const isCredit = acc.type === 'Credit';
                return (
                  /* Embla Slide: takes up 100% width of the viewport so only 1 card is visible */
                  <div key={acc.id} className="flex-[0_0_100%] min-w-0 flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        if (emblaApi) emblaApi.scrollTo(index);
                      }}
                      className={cn(
                        "w-full max-w-sm h-32 p-5 rounded-2xl border text-left transition-all duration-200 relative overflow-hidden select-none flex flex-col justify-between",
                        isSelected 
                          ? "border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20 scale-[0.98]" 
                          : "border-border bg-card/65 hover:bg-card/90"
                      )}
                    >
                      <div>
                        <p className="text-sm font-black text-muted-foreground uppercase tracking-wide truncate">{acc.name}</p>
                      </div>
                      <p className={cn(
                        "text-2xl font-black tracking-tight",
                        isCredit ? "text-rose-500" : "text-emerald-500"
                      )}>
                        {formatCurrency(acc.balance || 0)}
                      </p>
                      <div className="absolute right-4 top-4">
                        {acc.type === 'Chequing' && <TrendingUp className="h-5 w-5 opacity-20 text-emerald-500" />}
                        {acc.type === 'Credit' && <TrendingDown className="h-5 w-5 opacity-20 text-rose-500" />}
                      </div>
                      {isSelected && (
                        <div className="absolute bottom-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground stroke-[3]" />
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Quick Action Buttons (Simple, compact buttons directly below accounts) */}
        <section className="space-y-3 max-w-sm mx-auto w-full mt-2">
          {/* Expense Action */}
          <Button
            onClick={() => setActiveDialog('expense')}
            className="w-full h-14 text-base font-bold rounded-2xl bg-rose-500 hover:bg-rose-600 text-white shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            <TrendingDown className="h-5 w-5 stroke-[2.5]" />
            <span>Log Expense</span>
          </Button>

          {/* Income Action */}
          <Button
            onClick={() => setActiveDialog('income')}
            className="w-full h-14 text-base font-bold rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            <TrendingUp className="h-5 w-5 stroke-[2.5]" />
            <span>Log Income</span>
          </Button>

          {/* Transfer Action */}
          <Button
            onClick={() => setActiveDialog('transfer')}
            className="w-full h-14 text-base font-bold rounded-2xl bg-blue-500 hover:bg-blue-600 text-white shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            <ArrowRightLeft className="h-5 w-5 stroke-[2.5]" />
            <span>Log Transfer</span>
          </Button>
        </section>
      </div>

      {/* Tiny clean footer for secondary options */}
      <footer className="flex-shrink-0 flex items-center justify-center gap-6 py-2 border-t text-[11px] text-muted-foreground font-semibold">
        <button 
          onClick={handleSwitchToDesktop}
          className="flex items-center gap-1 hover:text-primary active:scale-95 transition-all"
        >
          <Monitor className="h-3.5 w-3.5" />
          <span>Desktop Version</span>
        </button>
        <div className="h-3 w-px bg-border"></div>
        <button 
          onClick={handleSignOut}
          className="flex items-center gap-1 text-destructive/80 hover:text-destructive active:scale-95 transition-all"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Log Out</span>
        </button>
      </footer>

      {/* Popups / Dialogs for each transaction type */}
      <Dialog modal={false} open={activeDialog !== null} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent 
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target?.closest && target.closest('[data-calculator="floating"]')) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target?.closest && target.closest('[data-calculator="floating"]')) {
              e.preventDefault();
            }
          }}
          className="max-w-[90%] w-full rounded-3xl p-5 !gap-1 border border-border bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden box-border"
        >
          <DialogHeader className="pb-0 space-y-0 text-left">
            <DialogTitle className="capitalize text-xl font-bold flex items-center gap-2">
              {activeDialog === 'expense' && <TrendingDown className="h-5 w-5 text-rose-500" />}
              {activeDialog === 'income' && <TrendingUp className="h-5 w-5 text-emerald-500" />}
              {activeDialog === 'transfer' && <ArrowRightLeft className="h-5 w-5 text-blue-500" />}
              <span>Log {activeDialog}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3 w-full max-w-full box-border mt-1">
            {/* Amount Field with Calculator Trigger */}
            <div className="space-y-1.5 w-full">
              <Label htmlFor="amount" className="font-semibold text-xs">Amount ($)</Label>
              <div className="relative flex rounded-md shadow-sm w-full">
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="pr-12 text-lg h-12 rounded-xl w-full box-border"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenCalculator}
                  className="absolute right-1 top-1 h-10 w-10 text-muted-foreground hover:text-primary hover:bg-transparent"
                >
                  <CalcIcon className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Payee / Description */}
            <div className="space-y-1.5 w-full">
              <Label htmlFor="description" className="font-semibold text-xs">
                {activeDialog === 'transfer' ? 'Description (Optional)' : 'Payee / Description'}
              </Label>
              <Input
                id="description"
                type="text"
                placeholder={activeDialog === 'transfer' ? 'Transfer details' : 'Enter payee name'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-11 rounded-xl w-full box-border"
                required={activeDialog !== 'transfer'}
              />
            </div>

            {/* Conditional Category/Destination Selectors */}
            {activeDialog !== 'transfer' && activeDialog !== null && (
              <div className="space-y-1.5 w-full">
                <Label htmlFor="category" className="font-semibold text-xs">Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="category" className="h-11 text-left rounded-xl w-full box-border">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeDialog === 'transfer' && (
              <div className="space-y-1.5 w-full">
                <Label htmlFor="destinationAccount" className="font-semibold text-xs">Transfer To</Label>
                <Select 
                  value={destinationAccountId} 
                  onValueChange={setDestinationAccountId}
                >
                  <SelectTrigger id="destinationAccount" className="h-11 text-left rounded-xl w-full box-border">
                    <SelectValue placeholder="Select destination account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.id !== selectedAccountId)
                      .map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} ({formatCurrency(acc.balance || 0)})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date */}
            <div className="space-y-1.5 w-full">
              <Label htmlFor="date" className="font-semibold text-xs">Date</Label>
              <div className="w-full overflow-hidden flex">
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="h-11 rounded-xl w-full min-w-0 box-border"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className={cn(
                "w-full h-12 text-sm font-bold mt-4 rounded-xl transition-all duration-200",
                activeDialog === 'expense' && "bg-rose-500 hover:bg-rose-600 text-white",
                activeDialog === 'income' && "bg-emerald-500 hover:bg-emerald-600 text-white",
                activeDialog === 'transfer' && "bg-blue-500 hover:bg-blue-600 text-white"
              )}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Save {activeDialog}
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
