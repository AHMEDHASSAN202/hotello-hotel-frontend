export type PreferredLanguage = 'en' | 'ar';

export type SubscriptionStatus =
  | 'active'
  | 'trial'
  | 'past_due'
  | 'canceled'
  | 'expired';

/** Module keys used by `enabledModules`. */
export type ModuleKey =
  | 'transportation'
  | 'housekeeping'
  | 'fnb'
  | 'guest_app_branding'
  | 'analytics'
  | 'requests'
  | 'hotel_info'
  | 'announcements';

/* ------------------------------------------------- Public tenant context */

export interface TenantContextPublic {
  slug: string;
  nameEn: string;
  nameAr: string;
  /** Path relative to the API base; render as `${API}/${logoUrl}` when non-null. */
  logoUrl: string | null;
  status: 'active' | 'suspended';
  defaultLanguage: PreferredLanguage;
}

/* --------------------------------------------------------------- Auth */

/** The role reference embedded on a user (Epic 09 — role is the source of truth). */
export interface TenantRoleRef {
  id: string;
  nameEn: string;
  nameAr: string;
  isSystem: boolean;
}

export interface TenantUser {
  id: string;
  name: string;
  /** Null for username-only staff accounts (Epic 09); owners always have one. */
  email: string | null;
  username?: string | null;
  role: TenantRoleRef | null;
  /** Flattened from the role — clients gate on this array. */
  permissions: string[];
  preferredLanguage: PreferredLanguage;
  lastLoginAt?: string | null;
  /** Story 9.7 AC4 — the shell forces the change-password screen when true. */
  mustChangePassword?: boolean;
  /** Epic 12 (12.4 AC2) — hint keys this user dismissed; HintCards check it. */
  dismissedHints?: string[];
}

export interface TenantLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: TenantUser;
  hotel: { slug: string };
}

export interface TenantRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface MessageResponse {
  message: string;
}

export interface SetupPreviewResponse {
  name: string;
  email: string;
  hotelNameEn: string;
  hotelNameAr: string;
}

export interface SetupResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: TenantUser;
  hotel: { slug: string };
}

/* ----------------------------------------------------------- /tenant/me */

export interface TenantMeHotel {
  slug: string;
  nameEn: string;
  nameAr: string;
  logoUrl: string | null;
  defaultLanguage: PreferredLanguage;
  status: 'active' | 'suspended';
  /** IANA timezone — request timelines render in hotel time (Epic 15). */
  timezone: string;
  /** ISO currency code — the kitchen board formats totals with it (Epic 16). */
  currency: string;
}

export interface SubscriptionState {
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  readOnly: boolean;
  enabledModules: ModuleKey[];
  planNameEn: string | null;
  planNameAr: string | null;
}

/**
 * Epic 12 (12.4 AC3) — getting-started progress derived server-side from
 * existing data. Rooms/QR steps join this shape with Epic 11.
 */
export interface TenantSetupStatus {
  staffAdded: boolean;
  roleCreated: boolean;
  /** Epic 11 (Task 12) — at least one room exists. */
  roomsAdded: boolean;
  /** Epic 11 (Task 12) — the room-cards/QR poster PDF has been generated at least once. */
  qrGenerated: boolean;
  complete: boolean;
}

export interface TenantMeResponse {
  user: TenantUser & { lastLoginAt: string | null };
  hotel: TenantMeHotel;
  subscription: SubscriptionState;
  setup: TenantSetupStatus;
}

/* ------------------------------------------------------------- Staff (Epic 09) */

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** A tenant role for the invite/edit dropdowns (GET /tenant/roles). */
export interface TenantRole extends TenantRoleRef {
  descriptionEn: string | null;
  descriptionAr: string | null;
  permissions: string[];
}

export type StaffStatus = 'pending' | 'active' | 'disabled';

export interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  status: StaffStatus;
  lastLoginAt: string | null;
  inviteSentAt: string | null;
  createdAt: string;
  role: TenantRoleRef | null;
}

/** One-time credentials returned by direct-create (9.7) and manager reset (9.8). */
export interface StaffCredentials {
  username: string | null;
  tempPassword: string;
  loginUrl: string;
}

export interface CreateStaffDirectResponse {
  staff: StaffMember;
  credentials: StaffCredentials;
}

export interface ResetPasswordResponse {
  credentials: StaffCredentials;
}

/* ------------------------------------------------------------ Roles (Epic 10) */

/** A role in the management list (GET /tenant/roles), with its staff count. */
export interface TenantRoleSummary extends TenantRoleRef {
  descriptionEn: string | null;
  descriptionAr: string | null;
  permissions: string[];
  staffCount: number;
  createdAt: string;
}

/** A single role's detail (GET /tenant/roles/:id). */
export type TenantRoleDetail = TenantRoleSummary;

/** One permission in the localized catalog (GET /tenant/roles/permissions/catalog). */
export interface TenantPermissionDef {
  key: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

/** A catalog group; `module` (when present) means it is plan-gated. */
export interface TenantPermissionGroup {
  group: string;
  labelEn: string;
  labelAr: string;
  module?: string;
  permissions: TenantPermissionDef[];
}

export type TenantPermissionCatalog = TenantPermissionGroup[];

/* ---- Rooms (Epic 11) ---- */

export type RoomStatus = 'active' | 'out_of_service' | 'inactive';

/** A room type (GET /tenant/room-types); `roomsCount` drives the "in use" delete guard. */
export interface RoomType {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  isActive: boolean;
  roomsCount: number;
}

/** A row in the rooms list (GET /tenant/rooms). */
export interface Room {
  id: string;
  roomNumber: string;
  floor: number | null;
  status: RoomStatus;
  roomType: { id: string; nameEn: string; nameAr: string };
  /**
   * Epic 13 (13.2 AC3) — the room's active stay. `undefined` when the actor
   * lacks `stays.read` (field absent), `null` when vacant.
   */
  currentStay?: RoomOccupancy | null;
}

/** The occupancy chip on the rooms list/detail (Epic 13). */
export interface RoomOccupancy {
  id: string;
  guestName: string;
  checkOutDate: string;
}

/** GET /tenant/rooms/:id — adds the guest-facing URL for this room's QR. */
export interface RoomDetail extends Room {
  guestUrl: string;
}

/** GET /tenant/rooms — `usage` reflects the plan's room-count limit (active + out_of_service only). */
export interface RoomsListResponse extends Paginated<Room> {
  usage: { used: number; max: number | null };
}

/** One bulk-create/import row problem, keyed to the field that failed. */
export interface RowIssue {
  row: number;
  field: 'roomNumber' | 'floor' | 'roomTypeId' | 'status';
  code: string;
}

/** One previewed row from a bulk range or Excel import, before confirm. */
export interface PreviewRow {
  row: number;
  roomNumber: string;
  floor: number | null;
  roomTypeId: string | null;
  status: RoomStatus;
  duplicate: boolean;
  issues: RowIssue[];
}

/** POST /tenant/rooms/bulk/preview and the Excel import preview — `remaining` is plan seats left, null when unlimited. */
export interface BulkPreview {
  rows: PreviewRow[];
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
  remaining: number | null;
  /** Import previews only — rows skipped because the room number keeps the
   * template's leading `#` example marker. */
  skippedExampleRows?: number;
}

/** POST /tenant/rooms/bulk response — fields are read defensively (fallbacks
 * computed client-side from the request) since the exact shape is "created,
 * skipped-ish" per the contract. */
export interface BulkCreateResponse {
  created?: number;
  skipped?: number;
}

/* ---- Stays (Epic 13) ---- */

/** The 7 guest languages — mirrors the backend GUEST_LANGUAGES constant. */
export const GUEST_LANGUAGES = [
  'ar',
  'en',
  'ru',
  'fr',
  'it',
  'es',
  'de',
] as const;
export type GuestLanguage = (typeof GUEST_LANGUAGES)[number];

export type StayStatus = 'active' | 'checked_out';
export type CheckoutType = 'manual' | 'automatic';

/** A stay row (GET /tenant/stays, GET /tenant/stays/:id) — never the code. */
/** Board basis (Epic 16, 16.1) — drives F&B pricing in the Guest App. */
export type StayType =
  | 'all_inclusive'
  | 'half_board'
  | 'bed_breakfast'
  | 'room_only';

export const STAY_TYPES: StayType[] = [
  'all_inclusive',
  'half_board',
  'bed_breakfast',
  'room_only',
];

export interface Stay {
  id: string;
  roomId: string;
  roomNumber: string;
  floor: number | null;
  guestName: string;
  email: string | null;
  phone: string | null;
  language: GuestLanguage;
  guestsCount: number | null;
  note: string | null;
  stayType: StayType;
  checkInDate: string;
  checkOutDate: string;
  /** Active stays only (hotel-local); null once checked out. */
  nightsRemaining: number | null;
  status: StayStatus;
  checkoutType: CheckoutType | null;
  checkedOutAt: string | null;
  createdAt: string;
}

/** GET /tenant/stays?view=active — the whole board, room natural order. */
export interface ActiveStaysResponse {
  data: Stay[];
  total: number;
}

/** GET /tenant/stays?view=history — paginated, newest checkout first. */
export type StaysHistoryResponse = Paginated<Stay>;

/** POST /tenant/stays and POST /tenant/stays/:id/regenerate-code — the code
 * is returned exactly once; it is never retrievable again (hash-only). */
export interface StayWithCode {
  stay: Stay;
  code: string;
}

/** GET /tenant/stays/available-rooms — active rooms with no active stay. */
export interface AvailableRoom {
  id: string;
  roomNumber: string;
  floor: number | null;
}

/** GET/PATCH /tenant/stays/settings (13.4 AC2, 16.1 AC2). */
export interface StaySettings {
  checkoutTime: string;
  defaultStayType: StayType;
}

/* ---------------------------------------------- Requests (Epic 15) */

export type RequestStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

export type RequestCancelReason =
  | 'guest'
  | 'guest_request'
  | 'not_available'
  | 'duplicate'
  | 'other';

/** Staff-pickable reasons (the `guest` reason is guest-cancel only). */
export const STAFF_CANCEL_REASONS = [
  'guest_request',
  'not_available',
  'duplicate',
  'other',
] as const;
export type StaffCancelReason = (typeof STAFF_CANCEL_REASONS)[number];

export type RequestOptionType = 'quantity' | 'time';

/** One board card (GET /tenant/requests). */
export interface TenantRequestView {
  id: string;
  itemNameEn: string;
  itemNameAr: string;
  icon: string;
  categoryId: string;
  roomNumber: string;
  floor: number | null;
  guestName: string;
  optionType: RequestOptionType | null;
  optionValue: string | null;
  note: string | null;
  /** Guest language tag shown next to the raw note («RU»). */
  noteLanguage: GuestLanguage | null;
  status: RequestStatus;
  slaTargetMinutes: number;
  dueAt: string;
  assignedTo: { id: string; name: string } | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledReason: RequestCancelReason | null;
  updatedAt: string;
}

/** GET /tenant/requests/:id — the drawer timeline (15.5 AC3). */
export interface TenantRequestDetail extends TenantRequestView {
  guestLanguage: GuestLanguage;
  cancelNote: string | null;
  startedBy: { id: string; name: string } | null;
  completedBy: { id: string; name: string } | null;
  cancelledBy: { id: string; name: string } | null;
}

/** Board header stats-lite (15.6 AC3). */
export interface RequestBoardCounts {
  open: number;
  doneToday: number;
  overdueNow: number;
}

/** GET /tenant/requests (open board / `updatedSince` deltas). */
export interface RequestBoardResponse {
  data: TenantRequestView[];
  counts: RequestBoardCounts;
  serverTime: string;
}

/** GET /tenant/requests?tab=history — paginated final states. */
export type RequestHistoryResponse = Paginated<TenantRequestView>;

/** GET /tenant/requests/assignees — options-endpoint shape (15.5 AC2). */
export interface RequestAssignee {
  id: string;
  name: string;
  roleNameEn: string;
  roleNameAr: string;
}

/** Translations JSONB shape mirrored from the catalog rows. */
export type RequestTranslationMap = Partial<Record<GuestLanguage, string>>;

/** GET /tenant/request-catalog items (management + filter names). */
export interface CatalogItemManage {
  id: string;
  key: string | null;
  names: RequestTranslationMap;
  descriptions: RequestTranslationMap | null;
  icon: string;
  optionType: RequestOptionType | null;
  optionMin: number | null;
  optionMax: number | null;
  defaultSlaMinutes: number;
  /** Effective SLA (hotel override or platform default). */
  slaMinutes: number;
  sortOrder: number;
  enabled: boolean;
  isCustom: boolean;
}

export interface CatalogCategoryManage {
  id: string;
  key: string;
  names: RequestTranslationMap;
  icon: string;
  enabled: boolean;
  items: CatalogItemManage[];
}

export interface RequestCatalogResponse {
  categories: CatalogCategoryManage[];
}

/* ---------------------------------------------- F&B (Epic 16) */

export type FnbOrderStatus =
  | 'new'
  | 'preparing'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export const OPEN_FNB_ORDER_STATUSES: FnbOrderStatus[] = [
  'new',
  'preparing',
  'on_the_way',
];

export type FnbCancelReason =
  | 'guest'
  | 'out_of_stock'
  | 'kitchen_closed'
  | 'guest_request'
  | 'other';

export const STAFF_FNB_CANCEL_REASONS: FnbCancelReason[] = [
  'out_of_stock',
  'kitchen_closed',
  'guest_request',
  'other',
];

export type FnbPaymentMethod = 'cash' | 'room_charge';

export interface FnbWindow {
  start: string;
  end: string;
}

export interface FnbVariantOption {
  key: string;
  names: RequestTranslationMap;
  price: number;
}

export interface FnbVariant {
  label: RequestTranslationMap;
  options: FnbVariantOption[];
}

/** GET /tenant/fnb-menus — full management tree (incl. inactive rows). */
export interface FnbItemManage {
  id: string;
  sectionId: string;
  names: RequestTranslationMap;
  descriptions: RequestTranslationMap | null;
  photoThumbUrl: string | null;
  photoDetailUrl: string | null;
  price: number;
  /** null = inherit menu default; [] = always paid; else included for these. */
  includedFor: StayType[] | null;
  variant: FnbVariant | null;
  allowNotes: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface FnbSectionManage {
  id: string;
  menuId: string;
  names: RequestTranslationMap;
  isActive: boolean;
  sortOrder: number;
  items: FnbItemManage[];
}

export interface FnbMenuManage {
  id: string;
  names: RequestTranslationMap;
  descriptions: RequestTranslationMap | null;
  windows: FnbWindow[];
  defaultIncludedFor: StayType[];
  prepSlaMinutes: number;
  isActive: boolean;
  sortOrder: number;
  sections: FnbSectionManage[];
}

export interface FnbMenusResponse {
  menus: FnbMenuManage[];
}

/** GET /tenant/fnb-locations (16.3). */
export interface FnbLocation {
  id: string;
  key: string;
  names: RequestTranslationMap;
  hasSpots: boolean;
  spotLabel: RequestTranslationMap | null;
  isActive: boolean;
  sortOrder: number;
}

export interface FnbLocationsResponse {
  locations: FnbLocation[];
}

/** GET/PATCH /tenant/fnb/settings (16.4). */
export interface FnbSettings {
  cashEnabled: true;
  roomChargeEnabled: boolean;
}

/** Kitchen board rows (16.7). */
export interface TenantFnbOrderLine {
  id: string;
  itemNameEn: string;
  itemNameAr: string;
  /** Guest-language name — what the guest actually ordered. */
  itemName: string;
  variantOptionNameEn: string | null;
  variantOptionNameAr: string | null;
  quantity: number;
  unitPrice: number;
  included: boolean;
  lineTotal: number;
  note: string | null;
}

export interface TenantFnbOrder {
  id: string;
  roomNumber: string;
  guestName: string;
  guestLanguage: GuestLanguage;
  stayId: string;
  destinationType: 'room' | 'location';
  locationId: string | null;
  locationNameEn: string | null;
  locationNameAr: string | null;
  spot: string | null;
  paymentMethod: FnbPaymentMethod | null;
  totalAmount: number;
  currency: string;
  status: FnbOrderStatus;
  slaTargetMinutes: number;
  dueAt: string;
  menuIds: string[];
  assignedTo: { id: string; name: string } | null;
  createdAt: string;
  startedAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelledReason: FnbCancelReason | null;
  cancelNote: string | null;
  settledAt: string | null;
  updatedAt: string;
  lines: TenantFnbOrderLine[];
}

/** Board header stats-lite (16.7 AC3). */
export interface FnbBoardCounts {
  open: number;
  deliveredToday: number;
  overdueNow: number;
  /** Delivered paid totals today — the owner number. */
  revenueToday: number;
}

export interface FnbBoardResponse {
  data: TenantFnbOrder[];
  counts: FnbBoardCounts;
  serverTime: string;
}

export type FnbHistoryResponse = Paginated<TenantFnbOrder>;

/** GET /tenant/fnb-orders/assignees — options-endpoint shape. */
export type FnbAssignee = RequestAssignee;

/** GET /tenant/fnb-orders/stay/:stayId — the stay drawer's orders (16.8). */
export interface StayFnbOrdersResponse {
  data: TenantFnbOrder[];
  unsettledTotal: number;
}

export interface SettleFnbOrdersResponse {
  settled: number;
  unsettledTotal: number;
}

/* ------------------------------------------------- Hotel Info (Epic 17) */

export type HotelInfoSection =
  | 'essentials'
  | 'facilities'
  | 'services'
  | 'house_rules'
  | 'about';

export interface HotelInfoPhotoView {
  id: string;
  /** API-relative paths (`files/{key}`) — prefix with assetUrl(). */
  thumbUrl: string;
  detailUrl: string;
}

/** Per-section typed payload (essentials wifi/phones, facility hours…). */
export interface HotelInfoStructured {
  wifiName?: string;
  wifiPassword?: string;
  receptionPhone?: string;
  whatsapp?: string;
  emergencyPhone?: string;
  windows?: FnbWindow[];
  locationNote?: RequestTranslationMap;
  howTo?: RequestTranslationMap;
  priceNote?: RequestTranslationMap;
}

export interface InfoEntryManage {
  id: string;
  section: HotelInfoSection;
  names: RequestTranslationMap;
  descriptions: RequestTranslationMap | null;
  structured: HotelInfoStructured;
  photos: HotelInfoPhotoView[];
  sortOrder: number;
  isActive: boolean;
}

/** GET /tenant/hotel-info — the whole management page in one call. */
export interface HotelInfoOverview {
  /** Epic 13 setting projection — read-only here. */
  checkoutTime: string;
  essentials: InfoEntryManage | null;
  facilities: InfoEntryManage[];
  services: InfoEntryManage[];
  houseRules: InfoEntryManage[];
  about: InfoEntryManage | null;
}

/* --- Epic 18 — Guest App Branding --- */

export interface BrandingManageView {
  brandAccentColor: string | null;
  /** API-relative `files/{key}` paths — prefix with assetUrl(). */
  coverThumbUrl: string | null;
  coverDetailUrl: string | null;
  welcomeMessage: RequestTranslationMap | null;
}
