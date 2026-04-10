import { APIError, getClient } from "./client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Filter {
  propertyName: string;
  operator:
    | "EQ"
    | "NEQ"
    | "LT"
    | "LTE"
    | "GT"
    | "GTE"
    | "BETWEEN"
    | "IN"
    | "NOT_IN"
    | "HAS_PROPERTY"
    | "NOT_HAS_PROPERTY"
    | "CONTAINS_TOKEN"
    | "NOT_CONTAINS_TOKEN";
  value?: string;
  values?: string[];
  highValue?: string;
}

export interface Sort {
  propertyName: string;
  direction: "ASCENDING" | "DESCENDING";
}

export interface SearchOptions {
  query?: string;
  filters?: Filter[];
  associationFilters?: Record<string, string>;
  properties?: string[];
  includeAllProperties?: boolean;
  sorts?: Sort[];
  limit?: number;
  after?: string;
}

export interface SearchResult {
  results: Record<string, unknown>[];
  total: number;
  paging?: {
    next?: { after: string };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAssocFilters(
  pairs: [string | undefined, string][],
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [val, key] of pairs) {
    if (val) out[key] = val;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ---------------------------------------------------------------------------
// Properties cache
// ---------------------------------------------------------------------------

const _propertyCache = new Map<string, string[]>();

export async function listProperties(
  objectType: string,
): Promise<Record<string, unknown>[]> {
  const client = getClient();
  const response = (await client.get(`/crm/v3/properties/${objectType}`)) as {
    results: Record<string, unknown>[];
  };
  return response.results ?? [];
}

export async function getAllPropertyNames(
  objectType: string,
): Promise<string[]> {
  if (_propertyCache.has(objectType)) {
    return _propertyCache.get(objectType)!;
  }
  const properties = await listProperties(objectType);
  const names = properties.map((p) => p["name"] as string);
  _propertyCache.set(objectType, names);
  return names;
}

export function clearPropertyCache(): void {
  _propertyCache.clear();
}

// ---------------------------------------------------------------------------
// Generic search / get
// ---------------------------------------------------------------------------

export async function searchObjects(
  objectType: string,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const {
    query,
    filters,
    associationFilters,
    properties,
    includeAllProperties = true,
    sorts,
    limit = 100,
    after,
  } = options;

  const client = getClient();

  const body: Record<string, unknown> = {
    limit: Math.min(limit, 200),
  };

  if (query) body["query"] = query;

  const filterGroups: Array<{ filters: Filter[] }> = [];

  if (filters && filters.length > 0) {
    filterGroups.push({ filters: [...filters] });
  }

  if (associationFilters && Object.keys(associationFilters).length > 0) {
    const assocFilters: Filter[] = Object.entries(associationFilters).map(
      ([objType, objId]) => ({
        propertyName: `associations.${objType}`,
        operator: "EQ" as const,
        value: objId,
      }),
    );
    if (filterGroups.length > 0) {
      filterGroups[0].filters.push(...assocFilters);
    } else {
      filterGroups.push({ filters: assocFilters });
    }
  }

  if (filterGroups.length > 0) body["filterGroups"] = filterGroups;

  if (properties && properties.length > 0) {
    body["properties"] = properties;
  } else if (includeAllProperties) {
    body["properties"] = await getAllPropertyNames(objectType);
  }

  if (sorts && sorts.length > 0) body["sorts"] = sorts;
  if (after) body["after"] = after;

  return client.post(
    `/crm/v3/objects/${objectType}/search`,
    body,
  ) as Promise<SearchResult>;
}

export async function getObject(
  objectType: string,
  objectId: string,
): Promise<Record<string, unknown> | null> {
  const client = getClient();
  try {
    const allProps = await getAllPropertyNames(objectType);
    const params = allProps.length > 0 ? { properties: allProps } : undefined;
    return (await client.get(
      `/crm/v3/objects/${objectType}/${objectId}`,
      params,
    )) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof APIError && err.statusCode === 404) return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export interface ContactSearchOptions extends Omit<SearchOptions, "associationFilters"> {
  associatedCompany?: string;
  associatedDeal?: string;
}

export async function searchContacts(
  options: ContactSearchOptions = {},
): Promise<SearchResult> {
  const { associatedCompany, associatedDeal, ...rest } = options;
  return searchObjects("contacts", {
    ...rest,
    associationFilters: buildAssocFilters([
      [associatedCompany, "company"],
      [associatedDeal, "deal"],
    ]),
  });
}

export async function getContact(
  contactId: string,
): Promise<Record<string, unknown> | null> {
  return getObject("contacts", contactId);
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export interface CompanySearchOptions extends Omit<SearchOptions, "associationFilters"> {
  associatedContact?: string;
  associatedDeal?: string;
}

export async function searchCompanies(
  options: CompanySearchOptions = {},
): Promise<SearchResult> {
  const { associatedContact, associatedDeal, ...rest } = options;
  return searchObjects("companies", {
    ...rest,
    associationFilters: buildAssocFilters([
      [associatedContact, "contact"],
      [associatedDeal, "deal"],
    ]),
  });
}

export async function getCompany(
  companyId: string,
): Promise<Record<string, unknown> | null> {
  return getObject("companies", companyId);
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

export interface DealSearchOptions extends Omit<SearchOptions, "associationFilters"> {
  associatedContact?: string;
  associatedCompany?: string;
}

export async function searchDeals(
  options: DealSearchOptions = {},
): Promise<SearchResult> {
  const { associatedContact, associatedCompany, ...rest } = options;
  return searchObjects("deals", {
    ...rest,
    associationFilters: buildAssocFilters([
      [associatedContact, "contact"],
      [associatedCompany, "company"],
    ]),
  });
}

export async function getDeal(
  dealId: string,
): Promise<Record<string, unknown> | null> {
  return getObject("deals", dealId);
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export interface TicketSearchOptions extends Omit<SearchOptions, "associationFilters"> {
  associatedContact?: string;
  associatedCompany?: string;
  associatedDeal?: string;
}

export async function searchTickets(
  options: TicketSearchOptions = {},
): Promise<SearchResult> {
  const { associatedContact, associatedCompany, associatedDeal, ...rest } = options;
  return searchObjects("tickets", {
    ...rest,
    associationFilters: buildAssocFilters([
      [associatedContact, "contact"],
      [associatedCompany, "company"],
      [associatedDeal, "deal"],
    ]),
  });
}

export async function getTicket(
  ticketId: string,
): Promise<Record<string, unknown> | null> {
  return getObject("tickets", ticketId);
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function searchProducts(
  options: SearchOptions = {},
): Promise<SearchResult> {
  return searchObjects("products", options);
}

export async function getProduct(
  productId: string,
): Promise<Record<string, unknown> | null> {
  return getObject("products", productId);
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface OrderSearchOptions extends Omit<SearchOptions, "associationFilters"> {
  associatedContact?: string;
  associatedCompany?: string;
  associatedDeal?: string;
}

export async function searchOrders(
  options: OrderSearchOptions = {},
): Promise<SearchResult> {
  const { associatedContact, associatedCompany, associatedDeal, ...rest } = options;
  return searchObjects("orders", {
    ...rest,
    associationFilters: buildAssocFilters([
      [associatedContact, "contact"],
      [associatedCompany, "company"],
      [associatedDeal, "deal"],
    ]),
  });
}

export async function getOrder(
  orderId: string,
): Promise<Record<string, unknown> | null> {
  return getObject("orders", orderId);
}

// ---------------------------------------------------------------------------
// Line Items
// ---------------------------------------------------------------------------

export interface LineItemSearchOptions extends Omit<SearchOptions, "associationFilters"> {
  associatedDeal?: string;
  associatedQuote?: string;
}

export async function searchLineItems(
  options: LineItemSearchOptions = {},
): Promise<SearchResult> {
  const { associatedDeal, associatedQuote, ...rest } = options;
  return searchObjects("line_items", {
    ...rest,
    associationFilters: buildAssocFilters([
      [associatedDeal, "deal"],
      [associatedQuote, "quote"],
    ]),
  });
}

export async function getLineItem(
  lineItemId: string,
): Promise<Record<string, unknown> | null> {
  return getObject("line_items", lineItemId);
}

// ---------------------------------------------------------------------------
// Carts
// ---------------------------------------------------------------------------

export interface CartSearchOptions extends Omit<SearchOptions, "associationFilters"> {
  associatedContact?: string;
}

export async function searchCarts(
  options: CartSearchOptions = {},
): Promise<SearchResult> {
  const { associatedContact, ...rest } = options;
  return searchObjects("carts", {
    ...rest,
    associationFilters: buildAssocFilters([[associatedContact, "contact"]]),
  });
}

export async function getCart(
  cartId: string,
): Promise<Record<string, unknown> | null> {
  return getObject("carts", cartId);
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export interface InvoiceSearchOptions extends Omit<SearchOptions, "associationFilters"> {
  associatedContact?: string;
  associatedCompany?: string;
  associatedDeal?: string;
}

export async function searchInvoices(
  options: InvoiceSearchOptions = {},
): Promise<SearchResult> {
  const { associatedContact, associatedCompany, associatedDeal, ...rest } = options;
  return searchObjects("invoices", {
    ...rest,
    associationFilters: buildAssocFilters([
      [associatedContact, "contact"],
      [associatedCompany, "company"],
      [associatedDeal, "deal"],
    ]),
  });
}

export async function getInvoice(
  invoiceId: string,
): Promise<Record<string, unknown> | null> {
  return getObject("invoices", invoiceId);
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export interface QuoteSearchOptions extends Omit<SearchOptions, "associationFilters"> {
  associatedContact?: string;
  associatedCompany?: string;
  associatedDeal?: string;
}

export async function searchQuotes(
  options: QuoteSearchOptions = {},
): Promise<SearchResult> {
  const { associatedContact, associatedCompany, associatedDeal, ...rest } = options;
  return searchObjects("quotes", {
    ...rest,
    associationFilters: buildAssocFilters([
      [associatedContact, "contact"],
      [associatedCompany, "company"],
      [associatedDeal, "deal"],
    ]),
  });
}

export async function getQuote(
  quoteId: string,
): Promise<Record<string, unknown> | null> {
  return getObject("quotes", quoteId);
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export interface SubscriptionSearchOptions extends Omit<SearchOptions, "associationFilters"> {
  associatedContact?: string;
  associatedCompany?: string;
}

export async function searchSubscriptions(
  options: SubscriptionSearchOptions = {},
): Promise<SearchResult> {
  const { associatedContact, associatedCompany, ...rest } = options;
  return searchObjects("subscriptions", {
    ...rest,
    associationFilters: buildAssocFilters([
      [associatedContact, "contact"],
      [associatedCompany, "company"],
    ]),
  });
}

export async function getSubscription(
  subscriptionId: string,
): Promise<Record<string, unknown> | null> {
  return getObject("subscriptions", subscriptionId);
}
