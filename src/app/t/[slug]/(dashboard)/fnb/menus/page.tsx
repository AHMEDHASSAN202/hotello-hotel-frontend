'use client';

import { Pencil, Plus, ShieldAlert, UtensilsCrossed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ItemModal } from '@/components/fnb/item-modal';
import { MenuModal } from '@/components/fnb/menu-modal';
import { SectionModal } from '@/components/fnb/section-modal';
import { PageIntro } from '@/components/guidance';
import { useTenant } from '@/components/tenant-provider';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui';
import { useFormatters } from '@/i18n/use-format';
import { api, assetUrl } from '@/lib/api';
import { useApiError } from '@/lib/errors';
import type {
  FnbItemManage,
  FnbMenuManage,
  FnbMenusResponse,
  FnbSectionManage,
} from '@/lib/types';

/**
 * 16.2 — the menus builder: menus → sections → items with photos, smart
 * pricing and availability. Everything soft-deactivates; nothing here ever
 * touches placed orders (snapshot rule).
 */
export default function FnbMenusPage() {
  const t = useTranslations('fnb.menus');
  const tStayTypes = useTranslations('stays.stayTypes');
  const tFnb = useTranslations('fnb');
  const resolveError = useApiError();
  const { locale, formatCurrency } = useFormatters();
  const { me, hasPermission, readOnly } = useTenant();
  const canManage = hasPermission('fnb_menus.manage');
  const currency = me?.hotel.currency ?? 'EGP';

  const [tree, setTree] = useState<FnbMenusResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuModal, setMenuModal] = useState<{
    open: boolean;
    menu: FnbMenuManage | null;
  }>({ open: false, menu: null });
  const [sectionModal, setSectionModal] = useState<{
    open: boolean;
    menuId: string;
    section: FnbSectionManage | null;
  }>({ open: false, menuId: '', section: null });
  const [itemModal, setItemModal] = useState<{
    open: boolean;
    menu: FnbMenuManage | null;
    sectionId: string;
    item: FnbItemManage | null;
  }>({ open: false, menu: null, sectionId: '', item: null });

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setTree(await api<FnbMenusResponse>('/tenant/fnb-menus'));
    } catch (err) {
      setLoadError(resolveError(err));
    }
  }, [resolveError]);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  const nameFor = (names: { ar?: string; en?: string }) =>
    (locale === 'ar' ? names.ar : names.en) ?? names.en ?? '';

  if (!canManage) {
    return (
      <EmptyState
        icon={<ShieldAlert size={28} />}
        title={tFnb('board.noAccess.title')}
        hint={tFnb('board.noAccess.hint')}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold">
            {tFnb('eyebrow')}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">
            {t('title')}
          </h1>
          <PageIntro>{t('intro')}</PageIntro>
        </div>
        <Button
          onClick={() => setMenuModal({ open: true, menu: null })}
          disabled={readOnly}
        >
          <Plus size={14} aria-hidden /> {t('addMenu')}
        </Button>
      </div>

      {loadError ? (
        <div className="mt-6">
          <ErrorState message={loadError} onRetry={() => void load()} />
        </div>
      ) : tree === null ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : tree.menus.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<UtensilsCrossed size={28} />}
            title={t('empty.title')}
            hint={t('empty.hint')}
            action={
              <Button
                onClick={() => setMenuModal({ open: true, menu: null })}
                disabled={readOnly}
              >
                {t('addMenu')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {tree.menus.map((menu) => (
            <section
              key={menu.id}
              className="rounded-xl border border-line bg-white p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {nameFor(menu.names)}
                  </h2>
                  {!menu.isActive ? (
                    <Badge tone="neutral">{t('menuCard.inactive')}</Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setSectionModal({ open: true, menuId: menu.id, section: null })
                    }
                    disabled={readOnly}
                    className="text-sm font-medium text-ink underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {t('menuCard.addSection')}
                  </button>
                  <button
                    onClick={() => setMenuModal({ open: true, menu })}
                    disabled={readOnly}
                    aria-label={`${t('menuCard.edit')}: ${nameFor(menu.names)}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm text-ink hover:border-ink disabled:opacity-50"
                  >
                    <Pencil size={13} aria-hidden /> {t('menuCard.edit')}
                  </button>
                </div>
              </div>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-soft">
                <span>
                  {menu.windows.length === 0
                    ? t('menuCard.alwaysOpen')
                    : menu.windows
                        .map((w) =>
                          t('menuCard.window', { start: w.start, end: w.end }),
                        )
                        .join(' · ')}
                </span>
                <span>
                  · {t('menuCard.prepSla', { minutes: menu.prepSlaMinutes })}
                </span>
                <span>
                  ·{' '}
                  {menu.defaultIncludedFor.length > 0
                    ? t('menuCard.defaultIncluded', {
                        types: menu.defaultIncludedFor
                          .map((type) => tStayTypes(type))
                          .join('، '),
                      })
                    : t('menuCard.defaultPaid')}
                </span>
              </p>

              {menu.sections.map((section) => (
                <div key={section.id} className="mt-4">
                  <div className="flex items-center justify-between gap-2 border-b border-line/60 pb-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      {nameFor(section.names)}
                      {!section.isActive ? (
                        <Badge tone="neutral">{t('sectionRow.inactive')}</Badge>
                      ) : null}
                    </p>
                    <span className="flex items-center gap-3 text-sm">
                      <button
                        onClick={() =>
                          setItemModal({
                            open: true,
                            menu,
                            sectionId: section.id,
                            item: null,
                          })
                        }
                        disabled={readOnly}
                        className="font-medium text-ink underline-offset-2 hover:underline disabled:opacity-50"
                      >
                        {t('sectionRow.addItem')}
                      </button>
                      <button
                        onClick={() =>
                          setSectionModal({ open: true, menuId: menu.id, section })
                        }
                        disabled={readOnly}
                        className="text-ink-soft underline-offset-2 hover:underline disabled:opacity-50"
                      >
                        {t('sectionRow.edit')}
                      </button>
                    </span>
                  </div>
                  {section.items.length === 0 ? (
                    <p className="py-2 text-sm text-ink-soft">
                      {t('sectionRow.empty')}
                    </p>
                  ) : (
                    <ul className="divide-y divide-line/50">
                      {section.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-3 py-2"
                        >
                          {item.photoThumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={assetUrl(item.photoThumbUrl) ?? undefined}
                              alt=""
                              className="h-10 w-14 rounded-md border border-line object-cover"
                            />
                          ) : (
                            <span className="flex h-10 w-14 items-center justify-center rounded-md border border-dashed border-line text-[10px] text-ink-soft">
                              {t('itemRow.noPhoto')}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-medium text-ink">
                                {nameFor(item.names)}
                              </span>
                              {item.variant ? (
                                <span className="text-xs text-ink-soft">
                                  {t('itemRow.variants', {
                                    count: item.variant.options.length,
                                  })}
                                </span>
                              ) : null}
                              {!item.isActive ? (
                                <Badge tone="neutral">
                                  {t('itemRow.inactive')}
                                </Badge>
                              ) : null}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-ink">
                            {(item.includedFor ?? menu.defaultIncludedFor)
                              .length > 0 && item.includedFor?.length !== 0 ? (
                              <span className="font-medium text-success">
                                {t('itemRow.included')}
                              </span>
                            ) : (
                              formatCurrency(item.price, currency)
                            )}
                          </span>
                          <button
                            onClick={() =>
                              setItemModal({
                                open: true,
                                menu,
                                sectionId: section.id,
                                item,
                              })
                            }
                            disabled={readOnly}
                            aria-label={`${t('sectionRow.edit')}: ${nameFor(item.names)}`}
                            className="shrink-0 rounded-lg border border-line p-1.5 text-ink hover:border-ink disabled:opacity-50"
                          >
                            <Pencil size={13} aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <MenuModal
        open={menuModal.open}
        menu={menuModal.menu}
        onClose={() => setMenuModal({ open: false, menu: null })}
        onSaved={() => void load()}
      />
      <SectionModal
        open={sectionModal.open}
        menuId={sectionModal.menuId}
        section={sectionModal.section}
        onClose={() =>
          setSectionModal({ open: false, menuId: '', section: null })
        }
        onSaved={() => void load()}
      />
      {itemModal.menu ? (
        <ItemModal
          open={itemModal.open}
          menu={itemModal.menu}
          sectionId={itemModal.sectionId}
          item={itemModal.item}
          onClose={() =>
            setItemModal({ open: false, menu: null, sectionId: '', item: null })
          }
          onSaved={() => void load()}
        />
      ) : null}
    </div>
  );
}
