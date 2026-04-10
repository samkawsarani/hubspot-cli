import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { APIError, HubSpotClient, getClient, _setClient } from "../src/client";
import {
  clearPropertyCache,
  searchObjects,
  searchContacts,
  searchCompanies,
  searchDeals,
  searchTickets,
} from "../src/hubspot";

// ---------------------------------------------------------------------------
// APIError
// ---------------------------------------------------------------------------

describe("APIError", () => {
  it("has the correct name and statusCode", () => {
    const err = new APIError(404, "Not found");
    expect(err.name).toBe("APIError");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Not found");
    expect(err instanceof Error).toBe(true);
    expect(err instanceof APIError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HubSpotClient — unit tests with mocked fetch
// ---------------------------------------------------------------------------

describe("HubSpotClient", () => {
  it("throws if no token is provided and env var is not set", () => {
    const original = process.env.HUBSPOT_ACCESS_TOKEN;
    delete process.env.HUBSPOT_ACCESS_TOKEN;
    expect(() => new HubSpotClient()).toThrow("HUBSPOT_ACCESS_TOKEN not set");
    if (original !== undefined) process.env.HUBSPOT_ACCESS_TOKEN = original;
  });

  it("constructs successfully with an explicit token", () => {
    const client = new HubSpotClient("test-token");
    expect(client).toBeInstanceOf(HubSpotClient);
  });
});

// ---------------------------------------------------------------------------
// getClient singleton
// ---------------------------------------------------------------------------

describe("getClient", () => {
  beforeEach(() => {
    _setClient(null);
    process.env.HUBSPOT_ACCESS_TOKEN = "test-token";
  });

  afterEach(() => {
    _setClient(null);
    delete process.env.HUBSPOT_ACCESS_TOKEN;
  });

  it("returns a HubSpotClient instance", () => {
    const client = getClient();
    expect(client).toBeInstanceOf(HubSpotClient);
  });

  it("returns the same instance on repeated calls", () => {
    const a = getClient();
    const b = getClient();
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Property cache
// ---------------------------------------------------------------------------

describe("clearPropertyCache", () => {
  it("clears without throwing", () => {
    expect(() => clearPropertyCache()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// searchObjects — validates request shape via mocked fetch
// ---------------------------------------------------------------------------

describe("searchObjects", () => {
  const mockClient = {
    post: mock(async (_path: string, body: unknown) => ({
      results: [],
      total: 0,
      body,
    })),
    get: mock(async () => ({ results: [] })),
  } as unknown as HubSpotClient;

  beforeEach(() => {
    _setClient(mockClient);
    clearPropertyCache();
    (mockClient.post as ReturnType<typeof mock>).mockClear();
    (mockClient.get as ReturnType<typeof mock>).mockClear();
  });

  afterEach(() => {
    _setClient(null);
  });

  it("posts to the correct endpoint", async () => {
    await searchObjects("contacts", { includeAllProperties: false });
    expect((mockClient.post as ReturnType<typeof mock>).mock.calls[0][0]).toBe(
      "/crm/v3/objects/contacts/search",
    );
  });

  it("includes query when provided", async () => {
    await searchObjects("contacts", { query: "sam", includeAllProperties: false });
    const body = (mockClient.post as ReturnType<typeof mock>).mock.calls[0][1] as Record<string, unknown>;
    expect(body["query"]).toBe("sam");
  });

  it("caps limit at 200", async () => {
    await searchObjects("contacts", { limit: 999, includeAllProperties: false });
    const body = (mockClient.post as ReturnType<typeof mock>).mock.calls[0][1] as Record<string, unknown>;
    expect(body["limit"]).toBe(200);
  });

  it("includes after cursor when provided", async () => {
    await searchObjects("contacts", { after: "abc123", includeAllProperties: false });
    const body = (mockClient.post as ReturnType<typeof mock>).mock.calls[0][1] as Record<string, unknown>;
    expect(body["after"]).toBe("abc123");
  });

  it("includes filterGroups when filters are provided", async () => {
    const filters = [{ propertyName: "email", operator: "EQ" as const, value: "test@example.com" }];
    await searchObjects("contacts", { filters, includeAllProperties: false });
    const body = (mockClient.post as ReturnType<typeof mock>).mock.calls[0][1] as Record<string, unknown>;
    const groups = body["filterGroups"] as Array<{ filters: unknown[] }>;
    expect(groups).toHaveLength(1);
    expect(groups[0].filters).toHaveLength(1);
  });

  it("adds association filters to filterGroups", async () => {
    await searchObjects("deals", {
      associationFilters: { contact: "12345" },
      includeAllProperties: false,
    });
    const body = (mockClient.post as ReturnType<typeof mock>).mock.calls[0][1] as Record<string, unknown>;
    const groups = body["filterGroups"] as Array<{ filters: Array<{ propertyName: string }> }>;
    expect(groups[0].filters[0].propertyName).toBe("associations.contact");
  });
});

// ---------------------------------------------------------------------------
// Per-object search helpers — verify they delegate to searchObjects correctly
// ---------------------------------------------------------------------------

describe("search helpers", () => {
  const mockClient = {
    post: mock(async () => ({ results: [], total: 0 })),
    get: mock(async () => ({ results: [] })),
  } as unknown as HubSpotClient;

  beforeEach(() => {
    _setClient(mockClient);
    clearPropertyCache();
    (mockClient.post as ReturnType<typeof mock>).mockClear();
    (mockClient.get as ReturnType<typeof mock>).mockClear();
  });

  afterEach(() => {
    _setClient(null);
  });

  it("searchContacts calls contacts endpoint", async () => {
    await searchContacts({ includeAllProperties: false });
    expect((mockClient.post as ReturnType<typeof mock>).mock.calls[0][0]).toContain("contacts");
  });

  it("searchCompanies calls companies endpoint", async () => {
    await searchCompanies({ includeAllProperties: false });
    expect((mockClient.post as ReturnType<typeof mock>).mock.calls[0][0]).toContain("companies");
  });

  it("searchDeals calls deals endpoint", async () => {
    await searchDeals({ includeAllProperties: false });
    expect((mockClient.post as ReturnType<typeof mock>).mock.calls[0][0]).toContain("deals");
  });

  it("searchTickets calls tickets endpoint", async () => {
    await searchTickets({ includeAllProperties: false });
    expect((mockClient.post as ReturnType<typeof mock>).mock.calls[0][0]).toContain("tickets");
  });

  it("searchContacts maps associatedCompany to filterGroups", async () => {
    await searchContacts({ associatedCompany: "99", includeAllProperties: false });
    const body = (mockClient.post as ReturnType<typeof mock>).mock.calls[0][1] as Record<string, unknown>;
    const groups = body["filterGroups"] as Array<{ filters: Array<{ propertyName: string; value: string }> }>;
    expect(groups[0].filters[0].propertyName).toBe("associations.company");
    expect(groups[0].filters[0].value).toBe("99");
  });
});
