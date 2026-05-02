// =============================================================================
// painless-crm — Reference Domain Types
// =============================================================================
// This file defines the canonical TypeScript types for domain entities.
// Database row types are auto-generated via `pnpm supabase gen types typescript`
// into `src/types/database.ts` — those are SOURCE OF TRUTH for DB shape.
//
// The types here are application-level: enriched, with computed fields,
// with explicit unions, and with documentation. App code imports from here
// and refines DB rows into these domain types at the query boundary.
// =============================================================================

// =============================================================================
// Identity & tenancy
// =============================================================================

export type CompanyId = string;
export type UserId = string;
export type WorkerId = string;
export type CustomerId = string;
export type JobId = string;
export type AddressId = string;
export type QuoteId = string;
export type InvoiceId = string;

export type Role =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'sales'
  | 'surveyor'
  | 'loader'
  | 'accounts'
  | 'viewer';

export interface AuthenticatedUser {
  id: UserId;
  authId: string;
  companyId: CompanyId;
  email: string;
  fullName: string;
  role: Role;
  active: boolean;
}

// =============================================================================
// Customer
// =============================================================================

export type CustomerType = 'individual' | 'business';

export interface IndividualCustomer {
  id: CustomerId;
  companyId: CompanyId;
  customerType: 'individual';
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  primaryAddress: Address | null;
  acquisitionSource: string | null;
  affiliateId: string | null;
  marketingConsent: boolean;
  marketingConsentAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface BusinessCustomer {
  id: CustomerId;
  companyId: CompanyId;
  customerType: 'business';
  companyName: string;
  vatNumber: string | null;
  paymentTermsDays: number | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  primaryAddress: Address | null;
  contacts: CustomerContact[];
  acquisitionSource: string | null;
  affiliateId: string | null;
  marketingConsent: boolean;
  marketingConsentAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type Customer = IndividualCustomer | BusinessCustomer;

export interface CustomerContact {
  id: string;
  customerId: CustomerId;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  isPrimary: boolean;
  isBilling: boolean;
}

export type RelationshipType =
  | 'spouse_of' | 'partner_of'
  | 'employee_of' | 'employer_of'
  | 'parent_of' | 'child_of'
  | 'referred_by' | 'referred'
  | 'friend_of';

export interface CustomerRelationship {
  id: string;
  fromCustomerId: CustomerId;
  toCustomerId: CustomerId;
  relationshipType: RelationshipType;
  notes: string | null;
}

// Computed domain fields not present on DB row
export interface CustomerHealth {
  customerId: CustomerId;
  ltvPence: number;
  jobCount: number;
  lastJobAt: string | null;
  lastNps: number | null;
  hasActiveStorage: boolean;
  daysSinceActivity: number | null;
  healthScore: number;       // 0-100
  status: 'active' | 'dormant' | 'at_risk' | 'churned';
}

// =============================================================================
// Address
// =============================================================================

export interface Address {
  id: AddressId;
  companyId: CompanyId;
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

// =============================================================================
// Job
// =============================================================================

export type JobStage =
  | 'lead' | 'contacted' | 'quoted' | 'accepted' | 'confirmed'
  | 'in_progress' | 'completed' | 'paid'
  | 'declined' | 'dead' | 'cancelled';

export type AddressRole = 'from' | 'to' | 'via';

export interface JobAddress {
  id: string;
  addressId: AddressId;
  address: Address;
  role: AddressRole;
  sequence: number;
  propertyType: string | null;
  floor: number | null;
  hasLift: boolean | null;
  hasParking: boolean | null;
  accessNotes: string | null;
}

export interface Job {
  id: JobId;
  companyId: CompanyId;
  jobNumber: string;
  customerId: CustomerId;
  customer: Customer;
  primaryContactId: string | null;
  stage: JobStage;
  subStatus: string | null;
  declineReason: string | null;
  acquisitionSource: string | null;
  affiliateId: string | null;
  assignedToId: UserId | null;
  assignedTo: AuthenticatedUser | null;
  surveyorId: UserId | null;
  enquiryAt: string | null;
  moveDate: string | null;
  estimatedHours: number | null;
  estimatedCubicFt: number | null;
  estimatedDistanceMiles: number | null;
  quoteTotalPence: number | null;
  notes: string | null;
  addresses: JobAddress[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface JobStatusHistoryEntry {
  id: string;
  jobId: JobId;
  fromStage: JobStage | null;
  toStage: JobStage;
  changedBy: AuthenticatedUser | null;
  reason: string | null;
  changedAt: string;
}

// =============================================================================
// Pricing
// =============================================================================

export interface PricingConfig {
  versionLabel: string;
  marginMatrix: number[][];           // 5x3
  crewHourlyRatePence: number;
  vanHourlyRatePence: number;
  passThroughConfig: {
    fuelPerMilePence: number;
    insurancePerJobPence: number;
    wasteDisposalFixedPence: number | null;
  };
  complications: Array<{
    code: string;
    label: string;
    points: number;
  }>;
  sizeCategories: Array<{
    code: string;
    label: string;
    cubicFtMin: number;
    cubicFtMax: number;
    crewSize: number;
    estimatedHours: number;
  }>;
  distanceBands: Array<{
    code: string;
    milesMin: number;
    milesMax: number;
  }>;
  dynamicPricingEnabled: boolean;
  capacityBands?: Array<{
    band: 'green' | 'yellow' | 'red';
    maxUtilization: number;
    marginDelta: number;
  }>;
  modulationSources?: string[];
  quoteValidityDays: number;
}

export interface QuoteInput {
  sizeCode: string;
  distanceMiles: number;
  complications: string[];
  source?: string;
  date?: string;
}

export interface QuoteResult {
  sizeLabel: string;
  estimatedHours: number;
  crewSize: number;
  basePence: number;
  passThroughPence: number;
  complicationsAdditionPence: number;
  marginPence: number;
  dynamicModulationPence: number;
  totalPence: number;
  breakdown: {
    crewCost: number;
    vanCost: number;
    fuel: number;
    insurance: number;
    waste: number;
    marginPct: number;
    capacityBand?: 'green' | 'yellow' | 'red';
    marginModulated: boolean;
  };
  notes: string[];
  requiresSurvey: boolean;
}

export interface Quote {
  id: QuoteId;
  jobId: JobId;
  pricingVersionId: string;
  pricingSnapshot: PricingConfig;
  sizeCode: string | null;
  distanceMiles: number | null;
  complications: string[];
  totalPence: number;
  breakdown: any;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
  validUntil: string;
  pdfUrl: string | null;
  sentAt: string | null;
  createdAt: string;
  variants: QuoteVariant[];
}

export interface QuoteVariant {
  id: string;
  quoteId: QuoteId;
  variantLabel: string;
  totalPence: number;
  description: string | null;
  displayOrder: number;
}

// =============================================================================
// Resources
// =============================================================================

export type VehicleType = 'luton' | 'transit' | '7.5t' | '18t' | 'trailer' | 'car';

export interface Vehicle {
  id: string;
  companyId: CompanyId;
  registration: string;
  type: VehicleType;
  capacityCubicFt: number | null;
  monthlyCostPence: number | null;
  active: boolean;
  motDue: string | null;
  taxDue: string | null;
  insuranceDue: string | null;
  nextServiceDue: string | null;
}

export interface Worker {
  id: WorkerId;
  companyId: CompanyId;
  userId: UserId | null;       // null if no PWA login
  fullName: string;
  phone: string | null;
  email: string | null;
  hourlyRatePence: number | null;
  active: boolean;
}

export interface StorageSite {
  id: string;
  companyId: CompanyId;
  name: string;
  addressId: AddressId;
  totalContainers: number | null;
}

export interface StorageContainer {
  id: string;
  storageSiteId: string;
  containerCode: string;
  sizeCubicFt: number | null;
  monthlyRatePence: number;
  status: 'available' | 'reserved' | 'occupied' | 'maintenance';
}

export interface StorageRental {
  id: string;
  companyId: CompanyId;
  customerId: CustomerId;
  storageContainerId: string;
  startDate: string;
  endDate: string | null;
  monthlyRatePence: number;
  status: 'pending' | 'active' | 'terminated';
}

// =============================================================================
// Operations
// =============================================================================

export type TimeEntryType =
  | 'clock_in' | 'load_start' | 'load_end'
  | 'unload_start' | 'unload_end'
  | 'clock_out' | 'break_start' | 'break_end';

export interface TimeEntry {
  id: string;
  jobId: JobId;
  workerId: WorkerId;
  type: TimeEntryType;
  occurredAt: string;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracyM: number | null;
  distanceFromJobAddressM: number | null;
  flagged: boolean;
  notes: string | null;
}

export type PhotoCategory = 'before' | 'during' | 'after' | 'damage' | 'inventory' | 'paperwork';

export interface Photo {
  id: string;
  jobId: JobId;
  uploadedByWorkerId: WorkerId | null;
  uploadedByUserId: UserId | null;
  category: PhotoCategory;
  url: string;
  thumbnailUrl: string | null;
  notes: string | null;
  takenAt: string | null;
  uploadedAt: string;
}

// =============================================================================
// Money
// =============================================================================

export type InvoiceType =
  | 'deposit' | 'custom' | 'final'
  | 'storage_recurring' | 'storage_initial'
  | 'credit_note';

export type InvoiceStatus =
  | 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'void';

export interface Invoice {
  id: InvoiceId;
  companyId: CompanyId;
  jobId: JobId | null;
  customerId: CustomerId;
  storageRentalId: string | null;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  subtotalPence: number;
  vatPence: number;
  totalPence: number;
  amountPaidPence: number;
  amountOutstandingPence: number;
  issuedAt: string | null;
  dueAt: string | null;
  xeroId: string | null;
  emailSentAt: string | null;
  emailOpenedAt: string | null;
  lines: InvoiceLine[];
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPricePence: number;
  vatRate: number;
  lineTotalPence: number;
  sortOrder: number;
}

export type PaymentMethod = 'bank_transfer' | 'card' | 'direct_debit' | 'cash' | 'cheque' | 'other';

export interface Payment {
  id: string;
  customerId: CustomerId;
  amountPence: number;
  method: PaymentMethod;
  occurredAt: string;
  reference: string | null;
  allocations: Array<{ invoiceId: InvoiceId; amountPence: number }>;
  source: 'xero_sync' | 'gocardless_webhook' | 'manual';
}

// =============================================================================
// Communications
// =============================================================================

export type Channel = 'email' | 'sms' | 'whatsapp' | 'phone';
export type Direction = 'outbound' | 'inbound';

export interface Message {
  id: string;
  companyId: CompanyId;
  customerId: CustomerId | null;
  jobId: JobId | null;
  channel: Channel;
  direction: Direction;
  templateId: string | null;
  subject: string | null;
  body: string;
  bodyHtml: string | null;
  provider: string;
  providerMessageId: string | null;
  status: string;
  fromAddress: string | null;
  toAddress: string | null;
  sentByUserId: UserId | null;
  inReplyToMessageId: string | null;
  threadId: string | null;
  sentAt: string;
  deliveredAt: string | null;
  openedAt: string | null;
  repliedAt: string | null;
}

// =============================================================================
// Activity log
// =============================================================================

export type ActivityAction =
  | 'create' | 'update' | 'soft_delete' | 'hard_delete'
  | string;  // custom verbs (e.g., 'gdpr_erasure_requested', 'merged_with')

export interface ActivityLogEntry {
  id: string;
  companyId: CompanyId;
  entityType: string;
  entityId: string;
  action: ActivityAction;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  actorId: UserId | null;
  actorLabel: string | null;
  occurredAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

// =============================================================================
// Result types (for Server Actions)
// =============================================================================

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }
  | { ok: false; conflict: true; serverVersion: number }    // optimistic concurrency
  | { ok: false; duplicates: Customer[] };                   // dedup check

// =============================================================================
// Server Action input schemas — concrete types should be derived via Zod
// (see src/lib/schemas/* for the runtime schemas; types here are illustrative)
// =============================================================================

export interface CreateCustomerInput {
  customerType: CustomerType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  primaryAddress?: Omit<Address, 'id' | 'companyId'>;
  acquisitionSource?: string;
  affiliateId?: string;
  marketingConsent?: boolean;
  forceCreate?: boolean;  // bypass dedup warning
}

export interface UpdateCustomerInput {
  id: CustomerId;
  version: number;          // optimistic concurrency
  patch: Partial<Omit<Customer, 'id' | 'companyId' | 'version' | 'createdAt' | 'updatedAt'>>;
}

export interface TransitionJobStageInput {
  jobId: JobId;
  version: number;
  targetStage: JobStage;
  reason?: string;
  subStatus?: string;
  declineReason?: string;
}
