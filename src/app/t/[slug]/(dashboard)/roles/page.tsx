'use client';

import { Eye, Lock, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTenant } from '@/components/tenant-provider';
import {
  Badge,
  Bdi,
  Button,
  Code,
  EmptyState,
  ErrorState,
  Field,
  Modal,
} from '@/components/ui';
import type { Locale } from '@/i18n/config';
import { useFormatters } from '@/i18n/use-format';
import { api, ApiError } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  TenantPermissionCatalog,
  TenantRoleSummary,
} from '@/lib/types';

interface RoleFormState {
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  permissions: string[];
}

const EMPTY_FORM: RoleFormState = {
  nameEn: '',
  nameAr: '',
  descriptionEn: '',
  descriptionAr: '',
  permissions: [],
};

export default function RolesPage() {
  const t = useTranslations('roles');
  const tCommon = useTranslations('common');
  const resolveError = useApiError();
  const locale = useLocale() as Locale;
  const { formatDate } = useFormatters();
  const { hasPermission, readOnly } = useTenant();

  const canCreate = hasPermission('roles.create');
  const canUpdate = hasPermission('roles.update');
  const canDelete = hasPermission('roles.delete');

  const [roles, setRoles] = useState<TenantRoleSummary[] | null>(null);
  const [catalog, setCatalog] = useState<TenantPermissionCatalog>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<TenantRoleSummary | 'new' | null>(null);
  const [viewing, setViewing] = useState<TenantRoleSummary | null>(null);
  const [deleting, setDeleting] = useState<TenantRoleSummary | null>(null);
  const [form, setForm] = useState<RoleFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const localName = useCallback(
    (r: { nameEn: string; nameAr: string }) =>
      locale === 'ar' ? r.nameAr : r.nameEn,
    [locale],
  );
  const localDesc = (r: { descriptionEn: string | null; descriptionAr: string | null }) =>
    (locale === 'ar' ? r.descriptionAr : r.descriptionEn) || '';
  const groupLabel = useCallback(
    (g: { labelEn: string; labelAr: string }) =>
      locale === 'ar' ? g.labelAr : g.labelEn,
    [locale],
  );
  const permLabel = useCallback(
    (p: { labelEn: string; labelAr: string }) =>
      locale === 'ar' ? p.labelAr : p.labelEn,
    [locale],
  );

  // A permission the acting user does not hold cannot be granted (escalation
  // guard, 10.2 AC3). Owner (*) holders satisfy hasPermission for everything.
  const canGrant = useCallback((key: string) => hasPermission(key), [hasPermission]);

  const allCatalogKeys = useMemo(
    () => catalog.flatMap((g) => g.permissions.map((p) => p.key)),
    [catalog],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, catalogRes] = await Promise.all([
        api<TenantRoleSummary[]>('/tenant/roles'),
        api<TenantPermissionCatalog>('/tenant/roles/permissions/catalog'),
      ]);
      setRoles(rolesRes);
      setCatalog(catalogRes);
    } catch (err) {
      setError(err instanceof ApiError ? resolveError(err) : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [resolveError, t]);

  useEffect(() => {
    if (hasPermission('roles.read')) load();
  }, [load, hasPermission]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditing('new');
  }

  function openEdit(role: TenantRoleSummary) {
    setForm({
      nameEn: role.nameEn,
      nameAr: role.nameAr,
      descriptionEn: role.descriptionEn ?? '',
      descriptionAr: role.descriptionAr ?? '',
      permissions: role.permissions.filter((p) => allCatalogKeys.includes(p)),
    });
    setFormError(null);
    setEditing(role);
  }

  function togglePermission(key: string) {
    if (!canGrant(key)) return;
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  }

  function setGroup(keys: string[], enabled: boolean) {
    const grantable = keys.filter(canGrant);
    setForm((prev) => ({
      ...prev,
      permissions: enabled
        ? Array.from(new Set([...prev.permissions, ...grantable]))
        : prev.permissions.filter((p) => !grantable.includes(p)),
    }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload = {
      nameEn: form.nameEn,
      nameAr: form.nameAr,
      descriptionEn: form.descriptionEn || undefined,
      descriptionAr: form.descriptionAr || undefined,
      permissions: form.permissions,
    };
    try {
      if (editing === 'new') {
        await api<TenantRoleSummary>('/tenant/roles', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else if (editing) {
        await api<TenantRoleSummary>(`/tenant/roles/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(resolveError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    setFormError(null);
    try {
      await api<void>(`/tenant/roles/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      await load();
    } catch (err) {
      setFormError(resolveError(err));
    } finally {
      setSaving(false);
    }
  }

  const editingRole = editing !== 'new' ? editing : null;

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
        {canCreate && (
          <Button onClick={openCreate} disabled={readOnly}>
            <Plus size={16} aria-hidden /> {t('new')}
          </Button>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-ink-soft">{tCommon('states.loading')}</p>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !roles || roles.length === 0 ? (
          <EmptyState
            title={t('empty.title')}
            hint={t('empty.hint')}
            action={
              canCreate ? (
                <Button onClick={openCreate} disabled={readOnly}>
                  {t('new')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {roles.map((role) => (
              <div
                key={role.id}
                className="rounded-xl border border-line bg-white p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-display font-semibold text-ink">
                        <Bdi>{localName(role)}</Bdi>
                      </p>
                      {role.isSystem && (
                        <Badge tone="gold">
                          <Lock size={11} className="me-1" aria-hidden />
                          {t('card.system')}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-3 text-xs text-ink-soft">
                      <span className="flex items-center gap-1">
                        <Users size={13} aria-hidden />
                        {t('card.staffCount', { count: role.staffCount })}
                      </span>
                      <span>{t('card.created', { date: formatDate(role.createdAt) })}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => setViewing(role)}
                      aria-label={t('card.viewAria', { name: localName(role) })}
                      className="rounded p-1.5 text-ink-soft hover:text-ink"
                    >
                      <Eye size={15} />
                    </button>
                    {!role.isSystem && canUpdate && (
                      <button
                        onClick={() => openEdit(role)}
                        aria-label={t('card.editAria', { name: localName(role) })}
                        className="rounded p-1.5 text-ink-soft hover:text-ink disabled:opacity-40"
                        disabled={readOnly}
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                    {!role.isSystem && canDelete && (
                      <button
                        onClick={() => {
                          setFormError(null);
                          setDeleting(role);
                        }}
                        aria-label={t('card.deleteAria', { name: localName(role) })}
                        className="rounded p-1.5 text-ink-soft hover:text-danger disabled:opacity-40"
                        disabled={readOnly}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {localDesc(role) && (
                  <p className="mt-3 text-sm text-ink-soft">
                    <Bdi>{localDesc(role)}</Bdi>
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {role.permissions.includes('*') ? (
                    <Badge tone="gold">{t('card.fullAccess')}</Badge>
                  ) : role.permissions.length === 0 ? (
                    <Badge tone="warning">{t('card.noPermissions')}</Badge>
                  ) : (
                    role.permissions.map((p) => (
                      <span
                        key={p}
                        className="rounded-full border border-line bg-paper px-2 py-0.5 text-xs text-ink-soft"
                      >
                        <Code>{p}</Code>
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Read-only detail matrix (10.1 AC3) */}
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? localName(viewing) : ''}
        wide
      >
        {viewing?.permissions.includes('*') ? (
          <p className="rounded-lg border border-gold/40 bg-gold-soft px-4 py-3 text-sm text-ink">
            {t('detail.fullAccess')}
          </p>
        ) : (
          <div className="space-y-4">
            {catalog.map((group) => (
              <div key={group.group} className="rounded-lg border border-line p-3">
                <p className="mb-2 text-sm font-medium text-ink">
                  {groupLabel(group)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.permissions.map((perm) => {
                    const on = viewing?.permissions.includes(perm.key);
                    return (
                      <span
                        key={perm.key}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                          on
                            ? 'border-gold/60 bg-gold-soft text-ink'
                            : 'border-line bg-white text-ink-soft/50'
                        }`}
                      >
                        <span>{permLabel(perm)}</span>
                        <Code className="opacity-70">{perm.key}</Code>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Create / edit modal with the permission matrix */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? t('form.createTitle') : t('form.editTitle')}
        wide
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
            >
              {formError}
            </div>
          )}
          {editingRole && editingRole.staffCount > 0 && (
            <p className="rounded-lg border border-gold/40 bg-gold-soft px-4 py-3 text-sm text-ink">
              {t('form.impact', { count: editingRole.staffCount })}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={t('form.nameEn')}
              required
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
            />
            <Field
              label={t('form.nameAr')}
              required
              dir="rtl"
              value={form.nameAr}
              onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
            />
            <Field
              label={t('form.descriptionEn')}
              value={form.descriptionEn}
              onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
            />
            <Field
              label={t('form.descriptionAr')}
              dir="rtl"
              value={form.descriptionAr}
              onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })}
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">
              {t('form.permissions')}
            </legend>
            {form.permissions.length === 0 && (
              <p className="mb-3 text-xs text-amber-700">
                {t('form.noPermissionsWarning')}
              </p>
            )}
            <div className="space-y-4">
              {catalog.map((group) => {
                const keys = group.permissions.map((p) => p.key);
                const grantable = keys.filter(canGrant);
                const allSelected =
                  grantable.length > 0 &&
                  grantable.every((k) => form.permissions.includes(k));
                return (
                  <div
                    key={group.group}
                    className="rounded-lg border border-line p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium text-ink">
                        {groupLabel(group)}
                      </p>
                      {grantable.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setGroup(keys, !allSelected)}
                          className="text-xs text-gold underline-offset-2 hover:underline"
                        >
                          {allSelected ? t('form.clearAll') : t('form.selectAll')}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.permissions.map((perm) => {
                        const selected = form.permissions.includes(perm.key);
                        const locked = !canGrant(perm.key);
                        return (
                          <button
                            key={perm.key}
                            type="button"
                            aria-pressed={selected}
                            disabled={locked}
                            title={locked ? t('form.lockedHint') : permLabel(perm)}
                            onClick={() => togglePermission(perm.key)}
                            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                              locked
                                ? 'cursor-not-allowed border-line bg-paper text-ink-soft/40'
                                : selected
                                  ? 'border-gold/60 bg-gold-soft text-ink'
                                  : 'border-line bg-white text-ink-soft hover:border-gold/40'
                            }`}
                          >
                            {locked && <Lock size={11} aria-hidden />}
                            <span>{permLabel(perm)}</span>
                            <Code className="opacity-70">{perm.key}</Code>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button type="submit" loading={saving}>
              {editing === 'new' ? t('form.createSubmit') : t('form.saveSubmit')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('delete.title')}
      >
        {formError && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
          >
            {formError}
          </div>
        )}
        {deleting && (
          <p className="text-sm text-ink-soft">
            {t.rich('delete.body', {
              name: localName(deleting),
              strong: (chunks) => <strong className="text-ink">{chunks}</strong>,
            })}
            {deleting.staffCount > 0 && (
              <> {t('delete.assigned', { count: deleting.staffCount })}</>
            )}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            {tCommon('actions.cancel')}
          </Button>
          <Button variant="danger" loading={saving} onClick={handleDelete}>
            {t('delete.confirm')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
