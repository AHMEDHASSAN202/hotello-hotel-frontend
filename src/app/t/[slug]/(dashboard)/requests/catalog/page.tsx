'use client';

import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmModal, HintCard, InfoTip, PageIntro } from '@/components/guidance';
import { CustomItemModal } from '@/components/requests/custom-item-modal';
import { requestIcon } from '@/components/requests/request-icons';
import { useTenant } from '@/components/tenant-provider';
import { Badge, Button, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  CatalogCategoryManage,
  CatalogItemManage,
  RequestCatalogResponse,
} from '@/lib/types';

/**
 * Catalog curation (15.1 AC2–AC4): enable/disable categories and items,
 * per-hotel SLA overrides, up/down reordering, custom items. Platform
 * translations stay read-only — hotels curate, the platform translates.
 */
export default function RequestCatalogPage() {
  const t = useTranslations('requests.catalog');
  const tG = useTranslations('guidance.requests');
  const resolveError = useApiError();
  const { locale } = useFormatters();
  const { hasPermission, readOnly } = useTenant();
  const canManage = hasPermission('request_catalog.manage');

  const [catalog, setCatalog] = useState<CatalogCategoryManage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [disabling, setDisabling] = useState<CatalogItemManage | null>(null);
  const [slaDrafts, setSlaDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<
    { categoryId: string; item: CatalogItemManage | null } | null
  >(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api<RequestCatalogResponse>('/tenant/request-catalog');
      setCatalog(result.categories);
      setSlaDrafts({});
    } catch (err) {
      setError(resolveError(err));
    }
  }, [resolveError]);
  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  const localName = useCallback(
    (names: { ar?: string; en?: string }) =>
      (locale === 'ar' ? names.ar : names.en) ?? names.en ?? '',
    [locale],
  );

  async function mutate(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setRowError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setRowError(resolveError(err));
    } finally {
      setBusyId(null);
    }
  }

  function patchItem(item: CatalogItemManage, body: Record<string, unknown>) {
    return mutate(item.id, () =>
      api(`/tenant/request-catalog/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    );
  }

  function move(
    category: CatalogCategoryManage,
    index: number,
    direction: -1 | 1,
  ) {
    const ids = category.items.map((i) => i.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void mutate(category.id, () =>
      api(`/tenant/request-catalog/categories/${category.id}/reorder`, {
        method: 'POST',
        body: JSON.stringify({ itemIds: ids }),
      }),
    );
  }

  if (!canManage) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={t('noAccess.title')}
        hint={t('noAccess.hint')}
      />
    );
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-gold">
        {t('eyebrow')}
      </p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
        {t('title')}
      </h1>
      <PageIntro>{t('intro')}</PageIntro>

      <HintCard hintKey="requests.catalogFirstRun" title={t('hint.title')}>
        {t('hint.body')}
      </HintCard>

      {rowError ? (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {rowError}
        </div>
      ) : null}

      {error ? (
        <div className="mt-6">
          <ErrorState message={error} onRetry={() => void load()} />
        </div>
      ) : catalog === null ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {catalog.map((category) => {
            const CategoryIcon = requestIcon(category.icon);
            return (
              <section
                key={category.id}
                className="rounded-xl border border-line bg-white"
              >
                <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CategoryIcon size={16} aria-hidden className="text-ink-soft" />
                    <h2 className="font-medium text-ink">
                      {localName(category.names)}
                    </h2>
                    {!category.enabled ? (
                      <Badge tone="neutral">{t('disabled')}</Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setEditing({ categoryId: category.id, item: null })
                      }
                      disabled={readOnly}
                      title={readOnly ? t('readOnlyHint') : undefined}
                    >
                      <Plus size={14} aria-hidden /> {t('addCustom')}
                    </Button>
                    <Button
                      variant="ghost"
                      loading={busyId === category.id}
                      disabled={readOnly}
                      title={readOnly ? t('readOnlyHint') : undefined}
                      onClick={() =>
                        mutate(category.id, () =>
                          api(
                            `/tenant/request-catalog/categories/${category.id}`,
                            {
                              method: 'PATCH',
                              body: JSON.stringify({
                                enabled: !category.enabled,
                              }),
                            },
                          ),
                        )
                      }
                    >
                      {category.enabled ? t('disable') : t('enable')}
                    </Button>
                  </div>
                </header>
                <ul>
                  {category.items.map((item, index) => {
                    const ItemIcon = requestIcon(item.icon);
                    const slaDraft = slaDrafts[item.id] ?? String(item.slaMinutes);
                    return (
                      <li
                        key={item.id}
                        className={`flex flex-wrap items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0 ${
                          item.enabled ? '' : 'opacity-60'
                        }`}
                      >
                        <ItemIcon size={16} aria-hidden className="shrink-0 text-ink-soft" />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 font-medium text-ink">
                            {localName(item.names)}
                            {item.isCustom ? (
                              <>
                                <Badge tone="gold">{t('customBadge')}</Badge>
                                <InfoTip label={t('customBadge')}>
                                  {tG('customItem')}
                                </InfoTip>
                              </>
                            ) : null}
                            {item.optionType ? (
                              <span className="text-xs text-ink-soft">
                                {item.optionType === 'quantity'
                                  ? t('optionQuantity', {
                                      min: item.optionMin ?? 1,
                                      max: item.optionMax ?? 1,
                                    })
                                  : t('optionTime')}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                          {t('slaLabel')}
                          <input
                            type="number"
                            min={1}
                            max={1440}
                            value={slaDraft}
                            disabled={readOnly}
                            onChange={(e) =>
                              setSlaDrafts((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            onBlur={() => {
                              const minutes = parseInt(slaDraft, 10);
                              if (
                                Number.isFinite(minutes) &&
                                minutes >= 1 &&
                                minutes !== item.slaMinutes
                              ) {
                                void patchItem(item, { slaMinutes: minutes });
                              }
                            }}
                            aria-label={t('slaAria', {
                              item: localName(item.names),
                            })}
                            className="w-20 rounded-lg border border-line px-2 py-1 text-sm tabular-nums"
                          />
                          {t('slaMinutes')}
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            aria-label={t('moveUp')}
                            disabled={index === 0 || readOnly}
                            onClick={() => move(category, index, -1)}
                            className="rounded p-1.5 text-ink-soft hover:bg-paper disabled:opacity-30"
                          >
                            <ArrowUp size={14} aria-hidden />
                          </button>
                          <button
                            aria-label={t('moveDown')}
                            disabled={
                              index === category.items.length - 1 || readOnly
                            }
                            onClick={() => move(category, index, 1)}
                            className="rounded p-1.5 text-ink-soft hover:bg-paper disabled:opacity-30"
                          >
                            <ArrowDown size={14} aria-hidden />
                          </button>
                          {item.isCustom ? (
                            <button
                              aria-label={t('editItem', {
                                item: localName(item.names),
                              })}
                              disabled={readOnly}
                              onClick={() =>
                                setEditing({ categoryId: category.id, item })
                              }
                              className="rounded p-1.5 text-ink-soft hover:bg-paper disabled:opacity-30"
                            >
                              <Pencil size={14} aria-hidden />
                            </button>
                          ) : null}
                        </div>
                        <Button
                          variant="ghost"
                          loading={busyId === item.id}
                          disabled={readOnly}
                          title={readOnly ? t('readOnlyHint') : undefined}
                          onClick={() =>
                            item.enabled
                              ? setDisabling(item)
                              : void patchItem(item, { enabled: true })
                          }
                        >
                          {item.enabled ? t('disable') : t('enable')}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* Reversible action → non-destructive confirm (15.1 AC5 context). */}
      <ConfirmModal
        open={disabling !== null}
        onClose={() => setDisabling(null)}
        title={t('disableConfirm.title')}
        confirmLabel={t('disable')}
        onConfirm={async () => {
          if (!disabling) return;
          await patchItem(disabling, { enabled: false });
          setDisabling(null);
        }}
      >
        <p>{t('disableConfirm.body')}</p>
      </ConfirmModal>

      {editing ? (
        <CustomItemModal
          categoryId={editing.categoryId}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
