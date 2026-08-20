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
  | 'analytics';

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

/** GET/PATCH /tenant/stays/settings (13.4 AC2). */
export interface StaySettings {
  checkoutTime: string;
}
