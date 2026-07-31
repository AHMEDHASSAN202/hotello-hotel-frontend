'use client';

import { KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Bdi, Button, Modal } from '@/components/ui';
import { CopyButton } from '@/components/copy-button';
import type { StaffCredentials } from '@/lib/types';

/**
 * Story 9.7 AC5 / 9.8 AC1 — shows a newly created/reset account's credentials
 * exactly once. The temporary password is never retrievable afterwards, so the
 * copy is emphasised and the warning is explicit.
 */
export function CredentialsModal({
  credentials,
  staffName,
  onClose,
}: {
  credentials: StaffCredentials | null;
  staffName?: string;
  onClose: () => void;
}) {
  const t = useTranslations('staff.credentials');
  const tCommon = useTranslations('common');

  return (
    <Modal
      open={credentials !== null}
      onClose={onClose}
      title={t('title')}
    >
      {credentials && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-gold/40 bg-gold-soft px-4 py-3 text-sm text-ink">
            <KeyRound size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden />
            <p>{t('warning', { name: staffName ?? '' })}</p>
          </div>

          <dl className="space-y-3 rounded-lg border border-line bg-paper p-4">
            {credentials.username && (
              <Row label={t('username')} value={credentials.username} />
            )}
            <Row label={t('password')} value={credentials.tempPassword} mono />
            <Row label={t('loginUrl')} value={credentials.loginUrl} />
          </dl>

          <div className="flex justify-end">
            <Button onClick={onClose}>{tCommon('actions.done')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <dt className="text-xs text-ink-soft">{label}</dt>
        <dd
          className={`truncate text-sm text-ink ${mono ? 'font-mono' : ''}`}
        >
          <Bdi>{value}</Bdi>
        </dd>
      </div>
      <CopyButton value={value} label={label} />
    </div>
  );
}
