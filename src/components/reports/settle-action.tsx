'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ConfirmModal } from '@/components/guidance';
import { Button } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import { useFormatters } from '@/i18n/use-format';
import type { StaySettleResponse } from '@/lib/types';

export interface SettleActionProps {
  stayId: string;
  amount: number;
  currency: string;
  disabled?: boolean;
  onSettled: (result: StaySettleResponse) => void;
}

/**
 * Task F2d, Part 2 — Story 22.4 AC3, the inline settle action for the
 * Outstanding Balances report. Calls the SAME `POST /tenant/stays/:id/settle`
 * endpoint the stay detail modal's checkout flow uses (Epic 16.8/21.6), but is
 * a fresh, self-contained component rather than an extraction of that modal's
 * `settle()` — see the task brief's ruling: that modal's settle logic is
 * tightly interwoven with its own action-runner, checkout interlock, and a
 * money-correctness-hardened polling guard, and refactoring it here would
 * risk a regression on an already-hardened critical path for a purely
 * cosmetic gain (the backend's `StaySettlementService` is the one source of
 * truth either way). `stay-detail-modal.tsx` is intentionally left untouched.
 */
export function SettleAction({ stayId, amount, currency, disabled, onSettled }: SettleActionProps) {
  const t = useTranslations('analytics.balances');
  const { formatCurrency } = useFormatters();
  const resolveError = useApiError();
  const [confirming, setConfirming] = useState(false);
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSettling(true);
    setError(null);
    try {
      const result = await api<StaySettleResponse>(`/tenant/stays/${stayId}/settle`, { method: 'POST' });
      setConfirming(false);
      onSettled(result);
    } catch (err) {
      setError(err instanceof ApiError ? resolveError(err) : t('settleError'));
    } finally {
      setSettling(false);
    }
  }

  return (
    <>
      <Button variant="ghost" disabled={disabled} onClick={() => setConfirming(true)}>
        {t('settle')}
      </Button>
      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('confirmTitle')}
        confirmLabel={t('confirm')}
        onConfirm={handleConfirm}
        loading={settling}
        error={error}
      >
        <p className="text-sm text-ink">
          {t('confirmBody', { amount: formatCurrency(amount, currency) })}
        </p>
      </ConfirmModal>
    </>
  );
}
