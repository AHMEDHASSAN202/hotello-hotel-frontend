'use client';

import { KeyRound, Pencil, Plus, Search, Send, ShieldAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { AddStaffModal } from '@/components/staff/add-staff-modal';
import { CredentialsModal } from '@/components/staff/credentials-modal';
import { EditStaffModal } from '@/components/staff/edit-staff-modal';
import { useTenant } from '@/components/tenant-provider';
import {
  Badge,
  Bdi,
  Button,
  EmptyState,
  ErrorState,
  Modal,
  Pagination,
  selectClass,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import { useFormatters } from '@/i18n/use-format';
import type { Locale } from '@/i18n/config';
import type {
  Paginated,
  ResetPasswordResponse,
  StaffCredentials,
  StaffMember,
  StaffStatus,
  TenantRole,
} from '@/lib/types';

const PAGE_SIZE = 20;
const STATUS_TONE: Record<StaffStatus, 'warning' | 'success' | 'neutral'> = {
  pending: 'warning',
  active: 'success',
  disabled: 'neutral',
};

type Confirm = { member: StaffMember; action: 'disable' | 'enable' };

export default function StaffPage() {
  const t = useTranslations('staff');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();
  const locale = useLocale() as Locale;
  const { formatRelativeTime } = useFormatters();
  const { me, hasPermission, readOnly } = useTenant();

  const canInvite = hasPermission('staff.invite');
  const canUpdate = hasPermission('staff.update');
  const canDisable = hasPermission('staff.disable');
  const roleName = (r: { nameEn: string; nameAr: string } | null) =>
    !r ? '' : locale === 'ar' ? r.nameAr : r.nameEn;

  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  // One-time credentials (direct create / reset) + the member being reset.
  const [credentials, setCredentials] = useState<StaffCredentials | null>(null);
  const [credentialsName, setCredentialsName] = useState('');
  const [resetting, setResetting] = useState<StaffMember | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  // Resend cooldowns: member id → epoch ms when the button re-enables.
  const [resendUntil, setResendUntil] = useState<Record<string, number>>({});
  const [nowTs, setNowTs] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      if (roleFilter) params.set('roleId', roleFilter);
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      const [staffRes, rolesRes] = await Promise.all([
        api<Paginated<StaffMember>>(`/tenant/staff?${params.toString()}`),
        api<TenantRole[]>('/tenant/roles/options'),
      ]);
      setStaff(staffRes.data);
      setTotal(staffRes.total);
      setRoles(rolesRes);
    } catch (err) {
      setError(err instanceof ApiError ? resolveError(err) : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [query, roleFilter, statusFilter, page, resolveError, t]);

  useEffect(() => {
    if (hasPermission('staff.read')) load();
  }, [load, hasPermission]);

  // Tick once a second only while a cooldown is active (drives the countdown).
  const hasCooldown = Object.values(resendUntil).some((ms) => ms > nowTs);
  useEffect(() => {
    if (!hasCooldown) return;
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasCooldown]);

  async function handleConfirm() {
    if (!confirm) return;
    setConfirmBusy(true);
    setRowError(null);
    try {
      await api<StaffMember>(
        `/tenant/staff/${confirm.member.id}/${confirm.action}`,
        { method: 'POST' },
      );
      setConfirm(null);
      await load();
    } catch (err) {
      setRowError(resolveError(err));
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handleReset() {
    if (!resetting) return;
    setResetBusy(true);
    setRowError(null);
    try {
      const res = await api<ResetPasswordResponse>(
        `/tenant/staff/${resetting.id}/reset-password`,
        { method: 'POST' },
      );
      setCredentialsName(resetting.name);
      setCredentials(res.credentials);
      setResetting(null);
    } catch (err) {
      setRowError(resolveError(err));
    } finally {
      setResetBusy(false);
    }
  }

  async function handleResend(member: StaffMember) {
    setRowError(null);
    try {
      await api<StaffMember>(`/tenant/staff/${member.id}/resend-invite`, {
        method: 'POST',
      });
      // Local 10-minute cooldown mirrors the backend rule.
      setResendUntil((c) => ({ ...c, [member.id]: Date.now() + 10 * 60_000 }));
      setNowTs(Date.now());
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVITE_COOLDOWN') {
        const retry =
          typeof (err.details as { retryAfterSeconds?: number })
            ?.retryAfterSeconds === 'number'
            ? (err.details as { retryAfterSeconds: number }).retryAfterSeconds
            : 600;
        setResendUntil((c) => ({
          ...c,
          [member.id]: Date.now() + retry * 1000,
        }));
        setNowTs(Date.now());
      }
      setRowError(resolveError(err));
    }
  }

  if (!hasPermission('staff.read')) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('noAccess.title')}
        hint={t('noAccess.hint')}
      />
    );
  }

  const cooldownLeft = (id: string) =>
    Math.max(0, Math.ceil(((resendUntil[id] ?? 0) - nowTs) / 1000));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-gold">
            {t('eyebrow')}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
            {t('title')}
          </h1>
        </div>
        {canInvite && (
          <Button
            onClick={() => setAdding(true)}
            disabled={readOnly}
            title={readOnly ? t('readOnlyHint') : undefined}
          >
            <Plus size={16} aria-hidden /> {t('new')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <div className="relative max-w-sm flex-1">
            <Search
              size={15}
              className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft/60"
              aria-hidden
            />
            <input
              type="search"
              placeholder={t('search.placeholder')}
              aria-label={t('search.aria')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-line bg-white py-2 pe-3 ps-9 text-sm text-ink"
            />
          </div>
          <Button type="submit" variant="ghost">
            {tCommon('actions.search')}
          </Button>
        </form>
        <select
          aria-label={t('filter.role')}
          className={selectClass}
          value={roleFilter}
          onChange={(e) => {
            setPage(1);
            setRoleFilter(e.target.value);
          }}
        >
          <option value="">{t('filter.allRoles')}</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {roleName(role)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('filter.status')}
          className={selectClass}
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
        >
          <option value="">{t('filter.allStatuses')}</option>
          <option value="pending">{t('status.pending')}</option>
          <option value="active">{t('status.active')}</option>
          <option value="disabled">{t('status.disabled')}</option>
        </select>
      </div>

      {rowError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {rowError}
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-ink-soft">{tCommon('states.loading')}</p>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !staff || staff.length === 0 ? (
          <EmptyState
            title={
              query || roleFilter || statusFilter
                ? t('empty.noMatchTitle')
                : t('empty.emptyTitle')
            }
            hint={
              query || roleFilter || statusFilter
                ? t('empty.noMatchHint')
                : t('empty.emptyHint')
            }
            action={
              canInvite && !(query || roleFilter || statusFilter) ? (
                <Button onClick={() => setAdding(true)} disabled={readOnly}>
                  {t('new')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('table.member')}</th>
                  <th className="px-4 py-3 font-medium">{t('table.role')}</th>
                  <th className="px-4 py-3 font-medium">{t('table.status')}</th>
                  <th className="px-4 py-3 font-medium">
                    {t('table.lastLogin')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">{t('table.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {staff.map((member) => {
                  const isOwner = member.role?.isSystem ?? false;
                  const isSelf = member.id === me?.user.id;
                  const left = cooldownLeft(member.id);
                  return (
                    <tr key={member.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{member.name}</p>
                        <Bdi className="block font-mono text-xs text-ink-soft">
                          {member.email ??
                            (member.username
                              ? `@${member.username}`
                              : '—')}
                        </Bdi>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={isOwner ? 'gold' : 'neutral'}>
                          {roleName(member.role)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[member.status]}>
                          {t(`status.${member.status}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {member.lastLoginAt
                          ? formatRelativeTime(member.lastLoginAt)
                          : t('lastLogin.never')}
                      </td>
                      <td className="px-4 py-3">
                        {isOwner ? (
                          <span className="block text-end text-xs text-ink-soft/50">
                            —
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {member.status === 'pending' && canInvite && (
                              <button
                                onClick={() => handleResend(member)}
                                disabled={readOnly || left > 0}
                                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-ink-soft hover:text-ink disabled:opacity-40"
                              >
                                <Send size={13} aria-hidden />
                                {left > 0
                                  ? t('row.resendIn', { seconds: left })
                                  : t('row.resendInvite')}
                              </button>
                            )}
                            {canDisable && member.status === 'disabled' && (
                              <button
                                onClick={() =>
                                  setConfirm({ member, action: 'enable' })
                                }
                                disabled={readOnly}
                                className="rounded px-2 py-1 text-xs text-ink-soft hover:text-ink disabled:opacity-40"
                              >
                                {t('row.enable')}
                              </button>
                            )}
                            {canDisable &&
                              member.status !== 'disabled' &&
                              !isSelf && (
                                <button
                                  onClick={() =>
                                    setConfirm({ member, action: 'disable' })
                                  }
                                  disabled={readOnly}
                                  className="rounded px-2 py-1 text-xs text-ink-soft hover:text-danger disabled:opacity-40"
                                >
                                  {t('row.disable')}
                                </button>
                              )}
                            {canUpdate &&
                              member.status === 'active' &&
                              !isSelf && (
                                <button
                                  onClick={() => setResetting(member)}
                                  disabled={readOnly}
                                  aria-label={t('row.resetAria', {
                                    name: member.name,
                                  })}
                                  className="rounded p-1.5 text-ink-soft hover:text-ink disabled:opacity-40"
                                >
                                  <KeyRound size={15} />
                                </button>
                              )}
                            {canUpdate && (
                              <button
                                onClick={() => setEditing(member)}
                                disabled={readOnly}
                                aria-label={t('row.editAria', {
                                  name: member.name,
                                })}
                                className="rounded p-1.5 text-ink-soft hover:text-ink disabled:opacity-40"
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      <AddStaffModal
        open={adding}
        roles={roles}
        onClose={() => setAdding(false)}
        onInvited={load}
        onCreated={(creds, name) => {
          setCredentialsName(name);
          setCredentials(creds);
          load();
        }}
      />
      <EditStaffModal
        member={editing}
        roles={roles}
        isSelf={editing?.id === me?.user.id}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
      <CredentialsModal
        credentials={credentials}
        staffName={credentialsName}
        onClose={() => setCredentials(null)}
      />

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm?.action === 'disable'
            ? t('disable.title')
            : t('enable.title')
        }
      >
        {confirm && (
          <p className="text-sm text-ink-soft">
            {t.rich(
              confirm.action === 'disable' ? 'disable.body' : 'enable.body',
              {
                name: confirm.member.name,
                strong: (chunks) => (
                  <strong className="text-ink">{chunks}</strong>
                ),
              },
            )}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            {tCommon('actions.cancel')}
          </Button>
          <Button
            variant={confirm?.action === 'disable' ? 'danger' : 'primary'}
            loading={confirmBusy}
            onClick={handleConfirm}
          >
            {confirm?.action === 'disable'
              ? t('disable.confirm')
              : t('enable.confirm')}
          </Button>
        </div>
      </Modal>

      <Modal
        open={resetting !== null}
        onClose={() => setResetting(null)}
        title={t('reset.title')}
      >
        {resetting && (
          <p className="text-sm text-ink-soft">
            {t.rich('reset.body', {
              name: resetting.name,
              strong: (chunks) => <strong className="text-ink">{chunks}</strong>,
            })}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setResetting(null)}>
            {tCommon('actions.cancel')}
          </Button>
          <Button loading={resetBusy} onClick={handleReset}>
            {t('reset.confirm')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
