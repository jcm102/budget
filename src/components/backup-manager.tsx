'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  getBackups, 
  restoreBackup, 
  deleteBackup, 
  createAutomatedBackup, 
  resetForFreshStart,
  getBackupDetails,
  type BackupSummary, 
  type FreshStartOptions 
} from '@/services/backup-service';
import { useTransferees } from '@/hooks/use-transferees';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Sparkles, 
  RotateCcw, 
  Database, 
  DownloadCloud, 
  Trash2, 
  AlertTriangle, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCw, 
  Info,
  Clock,
  Archive,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

function formatBackupDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return format(d, 'MMM d, yyyy h:mm a');
  } catch {
    return isoStr;
  }
}

export function BackupManager() {
  const { toast } = useToast();
  const { accounts, loading: loadingAccounts } = useTransferees();

  // Backups list state
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(true);

  // Manual backup dialog state
  const [isManualBackupOpen, setIsManualBackupOpen] = useState(false);
  const [manualBackupReason, setManualBackupReason] = useState('');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  // Restore dialog state
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<BackupSummary | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Details dialog state
  const [selectedBackupDetails, setSelectedBackupDetails] = useState<{ id: string; reason: string; counts: Record<string, number> } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Delete dialog state
  const [selectedBackupForDelete, setSelectedBackupForDelete] = useState<BackupSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fresh Start dialog state
  const [isFreshStartOpen, setIsFreshStartOpen] = useState(false);
  const [freshStartReason, setFreshStartReason] = useState('');
  const [resetSinkingFunds, setResetSinkingFunds] = useState(true);
  const [resetCompletedOverviewItems, setResetCompletedOverviewItems] = useState(true);
  const [showInitialBalances, setShowInitialBalances] = useState(false);
  const [initialBalances, setInitialBalances] = useState<Record<string, string>>({});
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const fetchBackups = useCallback(async () => {
    setIsLoadingBackups(true);
    try {
      const data = await getBackups();
      setBackups(data);
    } catch (err: any) {
      console.error('Failed to load backups:', err);
      toast({
        title: 'Error loading backups',
        description: err.message || 'Could not fetch backups list.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingBackups(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  // Handler: Manual Backup
  const handleCreateManualBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const reason = manualBackupReason.trim() || `Manual Backup (${format(new Date(), 'yyyy-MM-dd HH:mm')})`;
      const backupId = await createAutomatedBackup(reason);
      toast({
        title: 'Backup Created',
        description: `Successfully created backup "${reason}".`,
      });
      setIsManualBackupOpen(false);
      setManualBackupReason('');
      await fetchBackups();
    } catch (err: any) {
      toast({
        title: 'Backup Failed',
        description: err.message || 'Could not create backup.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Handler: Restore Backup
  const handleConfirmRestore = async () => {
    if (!selectedBackupForRestore) return;
    setIsRestoring(true);
    try {
      const res = await restoreBackup(selectedBackupForRestore.id);
      toast({
        title: 'Backup Restored Successfully',
        description: `${res.message} Reloading application...`,
      });
      setSelectedBackupForRestore(null);
      // Wait briefly so user sees the toast, then reload to refresh all real-time listeners and stores
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error('Restore error:', err);
      toast({
        title: 'Restoration Failed',
        description: err.message || 'Failed to restore backup.',
        variant: 'destructive',
      });
      setIsRestoring(false);
    }
  };

  // Handler: Delete Backup
  const handleConfirmDelete = async () => {
    if (!selectedBackupForDelete) return;
    setIsDeleting(true);
    try {
      await deleteBackup(selectedBackupForDelete.id);
      toast({
        title: 'Backup Deleted',
        description: 'The backup snapshot has been removed.',
      });
      setSelectedBackupForDelete(null);
      await fetchBackups();
    } catch (err: any) {
      toast({
        title: 'Delete Failed',
        description: err.message || 'Could not delete backup.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler: Inspect Backup Details
  const handleInspectBackup = async (b: BackupSummary) => {
    setIsLoadingDetails(true);
    try {
      const counts = await getBackupDetails(b.id);
      if (counts) {
        setSelectedBackupDetails({ id: b.id, reason: b.reason, counts });
      } else {
        toast({
          title: 'Details Unavailable',
          description: 'No detailed collection metadata found in this backup.',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error loading details',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Handler: Fresh Start
  const handleExecuteFreshStart = async () => {
    if (confirmText.trim().toUpperCase() !== 'RESET') {
      toast({
        title: 'Confirmation required',
        description: 'Please type RESET to confirm you want to perform a fresh start.',
        variant: 'destructive',
      });
      return;
    }

    setIsResetting(true);
    try {
      const parsedBalances: Record<string, number> = {};
      Object.entries(initialBalances).forEach(([accId, val]) => {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          parsedBalances[accId] = num;
        }
      });

      const options: FreshStartOptions = {
        resetSinkingFunds,
        resetCompletedOverviewItems,
        initialBalances: parsedBalances,
        customBackupReason: freshStartReason.trim() || `Pre-Fresh Start Reset (${format(new Date(), 'yyyy-MM-dd HH:mm')})`,
      };

      const result = await resetForFreshStart(options);

      toast({
        title: 'Fresh Start Complete!',
        description: `${result.message} Reloading application...`,
      });

      setIsFreshStartOpen(false);
      setConfirmText('');
      setInitialBalances({});

      // Reload to ensure all client caches, running balance calculators, and listeners update
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error('Fresh start error:', err);
      toast({
        title: 'Fresh Start Failed',
        description: err.message || 'An error occurred while resetting balances.',
        variant: 'destructive',
      });
      setIsResetting(false);
    }
  };

  const getReasonBadge = (reason: string) => {
    const lower = reason.toLowerCase();
    if (lower.includes('fresh-start') || lower.includes('fresh start')) {
      return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Fresh Start</Badge>;
    }
    if (lower.includes('safety') || lower.includes('pre-restore')) {
      return <Badge variant="secondary">Pre-Restore Safety</Badge>;
    }
    if (lower.includes('manual')) {
      return <Badge variant="outline" className="border-primary text-primary">Manual</Badge>;
    }
    if (lower.includes('debt')) {
      return <Badge variant="outline">Debt Cycle</Badge>;
    }
    return <Badge variant="secondary">Automated</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* CARD 1: FRESH START (RESET) */}
      <Card className="border-amber-200 dark:border-amber-900/60 shadow-sm bg-gradient-to-b from-amber-50/40 to-background dark:from-amber-950/10 dark:to-background">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Make a Fresh Start</CardTitle>
                <CardDescription>
                  Reset your account balances and clear the transaction ledger to start completely fresh.
                </CardDescription>
              </div>
            </div>
            <Button 
              variant="default"
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm"
              onClick={() => {
                setFreshStartReason(`Pre-Fresh Start Reset (${format(new Date(), 'yyyy-MM-dd HH:mm')})`);
                setConfirmText('');
                setIsFreshStartOpen(true);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Start Fresh...
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 rounded-lg border bg-card/80 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
                <span>Safely Retained (Never Deleted)</span>
              </div>
              <ul className="space-y-1.5 text-muted-foreground text-xs pl-1">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span><strong>Debt Payment Sheet:</strong> All debts, balances, interest rates, and payoff plans.</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span><strong>Monthly Budget Templates:</strong> All category budget targets, default amounts, and breakdowns.</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span><strong>Overview Templates:</strong> Recurring Income, Pre-Authorized Payments, and Transfers.</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span><strong>Accounts & Categories:</strong> All account names, budget categories, payees, and people.</span>
                </li>
              </ul>
            </div>

            <div className="p-3 rounded-lg border bg-card/80 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span>What Will Be Reset</span>
              </div>
              <ul className="space-y-1.5 text-muted-foreground text-xs pl-1">
                <li className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span><strong>Account Balances:</strong> All balances reset to $0.00 (or custom opening balances you enter).</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span><strong>Transaction Ledger:</strong> All past transactions in the ledger are permanently cleared.</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span><strong>Sinking Fund Balances:</strong> Saved fund balances reset to $0.00 (optional).</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span><strong>Monthly Overview Flags:</strong> Recurring items mark as uncompleted so you can budget fresh.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/60 text-xs text-muted-foreground">
            <Info className="h-4 w-4 text-primary shrink-0" />
            <span>
              <strong>Automatic Safety Net:</strong> A full backup of your current database is automatically created right before the reset is performed, allowing you to restore back at any time from the list below.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* CARD 2: BACKUPS & RESTORE MENU */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Database Backups & Restore Menu
              </CardTitle>
              <CardDescription>
                Select any backup snapshot to restore your database, or create a manual backup anytime.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={fetchBackups}
                disabled={isLoadingBackups}
                title="Refresh list"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingBackups ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                variant="default"
                size="sm"
                onClick={() => {
                  setManualBackupReason(`Manual Backup (${format(new Date(), 'yyyy-MM-dd HH:mm')})`);
                  setIsManualBackupOpen(true);
                }}
              >
                <Archive className="mr-2 h-4 w-4" />
                Create Backup Now
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingBackups ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-lg">
              <Database className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No backups found.</p>
              <p className="text-xs text-muted-foreground mt-1">Create a backup using the button above.</p>
            </div>
          ) : (
            <div className="divide-y rounded-md border">
              {backups.map((b) => (
                <div 
                  key={b.id} 
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{b.reason}</span>
                      {getReasonBadge(b.reason)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatBackupDate(b.createdAt)}
                      </span>
                      <span>•</span>
                      <span>{b.totalDocs} documents</span>
                      <span>•</span>
                      <code className="text-[10px] text-muted-foreground/70 font-mono">ID: {b.id.slice(0, 8)}...</code>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleInspectBackup(b)}
                      disabled={isLoadingDetails}
                      className="text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground"
                    >
                      Inspect
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedBackupForRestore(b)}
                      className="text-xs h-8 px-3 font-medium text-primary hover:text-primary hover:bg-primary/5 border-primary/30"
                    >
                      <DownloadCloud className="mr-1.5 h-3.5 w-3.5" />
                      Restore...
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedBackupForDelete(b)}
                      className="text-xs h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete Backup"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground border-t pt-3">
          Showing up to 50 most recent backups stored securely in Firestore.
        </CardFooter>
      </Card>

      {/* DIALOG: FRESH START CONFIRMATION & SETUP */}
      <Dialog open={isFreshStartOpen} onOpenChange={(open) => !isResetting && setIsFreshStartOpen(open)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-amber-700 dark:text-amber-400">
              <Sparkles className="h-5 w-5" />
              Configure Fresh Start
            </DialogTitle>
            <DialogDescription>
              This will reset your account balances and clear the transaction ledger. Your debt sheet and budget templates will remain completely intact.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Backup reason label */}
            <div className="space-y-1.5">
              <Label htmlFor="backup-reason" className="text-xs font-semibold">
                Backup Label (Safety Backup)
              </Label>
              <Input
                id="backup-reason"
                value={freshStartReason}
                onChange={(e) => setFreshStartReason(e.target.value)}
                placeholder="Pre-Fresh Start Reset"
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                A complete backup with this label will be created automatically before any changes are made.
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <div className="text-xs font-semibold text-foreground">Reset Options</div>
              
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="reset-sf"
                  checked={resetSinkingFunds}
                  onCheckedChange={(checked) => setResetSinkingFunds(!!checked)}
                />
                <div className="grid gap-0.5 leading-none">
                  <label htmlFor="reset-sf" className="text-xs font-medium cursor-pointer">
                    Reset Sinking Fund balances to $0.00
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Sets current fund balances to zero and clears sinking fund deposit/withdraw logs. Fund categories and targets are retained.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="reset-overview"
                  checked={resetCompletedOverviewItems}
                  onCheckedChange={(checked) => setResetCompletedOverviewItems(!!checked)}
                />
                <div className="grid gap-0.5 leading-none">
                  <label htmlFor="reset-overview" className="text-xs font-medium cursor-pointer">
                    Reset recurring budget items to uncompleted
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Removes month-specific completed status on Overview items so they appear ready to budget for this month.
                  </p>
                </div>
              </div>
            </div>

            {/* Optional Initial Balances */}
            <div className="border rounded-lg p-3 space-y-3">
              <button
                type="button"
                onClick={() => setShowInitialBalances(!showInitialBalances)}
                className="w-full flex items-center justify-between text-xs font-semibold text-foreground hover:text-primary transition-colors text-left"
              >
                <span>Set Starting Opening Balances (Optional)</span>
                {showInitialBalances ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              
              {showInitialBalances && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-[11px] text-muted-foreground">
                    Leave as empty or 0 to set all accounts to $0.00, or enter your real bank balances to start fresh today:
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {loadingAccounts ? (
                      <p className="text-xs text-muted-foreground">Loading accounts...</p>
                    ) : accounts.filter(a => a.type !== 'Credit').map((acc) => (
                      <div key={acc.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate max-w-[180px] font-medium">{acc.name} ({acc.type})</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={initialBalances[acc.id] ?? ''}
                            onChange={(e) => {
                              setInitialBalances(prev => ({
                                ...prev,
                                [acc.id]: e.target.value
                              }));
                            }}
                            className="h-7 w-28 text-right text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Type RESET to confirm */}
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
              <Label htmlFor="confirm-reset-input" className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Type <span className="underline font-mono">RESET</span> to confirm
              </Label>
              <Input
                id="confirm-reset-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type RESET"
                className="font-mono text-sm border-destructive/40 focus-visible:ring-destructive"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsFreshStartOpen(false)}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleExecuteFreshStart}
              disabled={confirmText.trim().toUpperCase() !== 'RESET' || isResetting}
            >
              {isResetting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Resetting Data...
                </>
              ) : (
                'Create Backup & Execute Fresh Start'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CREATE MANUAL BACKUP */}
      <Dialog open={isManualBackupOpen} onOpenChange={setIsManualBackupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-primary" />
              Create Database Backup
            </DialogTitle>
            <DialogDescription>
              Save a full snapshot of your budget database right now.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="manual-backup-label" className="text-xs font-semibold">
              Backup Reason / Note
            </Label>
            <Input
              id="manual-backup-label"
              value={manualBackupReason}
              onChange={(e) => setManualBackupReason(e.target.value)}
              placeholder="e.g. End of Month check-in"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManualBackupOpen(false)} disabled={isCreatingBackup}>
              Cancel
            </Button>
            <Button onClick={handleCreateManualBackup} disabled={isCreatingBackup}>
              {isCreatingBackup ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Backing up...
                </>
              ) : (
                'Save Backup'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG: CONFIRM RESTORE */}
      <AlertDialog 
        open={!!selectedBackupForRestore} 
        onOpenChange={(open) => !isRestoring && !open && setSelectedBackupForRestore(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Restore Database to this Backup?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left">
              <span>
                You are about to restore the database to the snapshot:
              </span>
              <div className="p-3 rounded-md bg-muted font-medium text-foreground text-xs space-y-1">
                <div><strong>Reason:</strong> {selectedBackupForRestore?.reason}</div>
                <div><strong>Date:</strong> {selectedBackupForRestore && formatBackupDate(selectedBackupForRestore.createdAt)}</div>
                <div><strong>Total Docs:</strong> {selectedBackupForRestore?.totalDocs}</div>
              </div>
              <span className="block text-xs text-muted-foreground">
                🛡️ <strong>Safety Net:</strong> A pre-restore safety snapshot of your current database will be saved first before any data is replaced.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              disabled={isRestoring}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRestoring ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Restoring Data...
                </>
              ) : (
                'Confirm & Restore'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALERT DIALOG: CONFIRM DELETE BACKUP */}
      <AlertDialog 
        open={!!selectedBackupForDelete} 
        onOpenChange={(open) => !isDeleting && !open && setSelectedBackupForDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete backup snapshot &quot;{selectedBackupForDelete?.reason}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Backup'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG: INSPECT BACKUP DETAILS */}
      <Dialog 
        open={!!selectedBackupDetails} 
        onOpenChange={(open) => !open && setSelectedBackupDetails(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Backup Breakdown
            </DialogTitle>
            <DialogDescription>
              {selectedBackupDetails?.reason}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-1.5 py-2">
            {selectedBackupDetails && Object.entries(selectedBackupDetails.counts).map(([col, count]) => (
              <div key={col} className="flex items-center justify-between py-1 px-2 rounded bg-muted/40 text-xs">
                <span className="font-mono text-muted-foreground">{col}</span>
                <Badge variant="secondary" className="font-semibold">{count} docs</Badge>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedBackupDetails(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
