# hubspot-cli

[![npm](https://img.shields.io/npm/v/@samkawsarani/hubspot-cli)](https://www.npmjs.com/package/@samkawsarani/hubspot-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> [!IMPORTANT]
> **Disclaimer**: This is an **unofficial, open-source community project** and is **not affiliated with, endorsed by, or connected to HubSpot, Inc.** HubSpot is a registered trademark of HubSpot, Inc. This CLI is an independent tool that uses the publicly available HubSpot API to provide command-line access to your own CRM data.

> [!NOTE]
> This tool has only been tested on **macOS**. It may work on Windows and Linux, but this has not been verified.

Read-only HubSpot CRM API client with CLI. Built for use by LLM agents and humans.

## Installation

```bash
npm install -g @samkawsarani/hubspot-cli
# or
bun install -g @samkawsarani/hubspot-cli
```

## Quick Start

```bash
# Interactive setup
hubspot init

# Search
hubspot search-contacts --query "john@example.com"
hubspot search-companies --query "Acme"
hubspot search-deals --query "Enterprise"
hubspot search-tickets --query "bug"

# Get by ID
hubspot get-contact --id 12345
hubspot get-company --id 12345
hubspot get-deal --id 12345
hubspot get-ticket --id 12345
```

Search commands support `--query`, `--limit` (max 200), and `--after` (pagination cursor).

## Library Usage

```typescript
import {
  searchContacts,
  searchCompanies,
  searchDeals,
  getContact,
  getCompany,
  getDeal,
} from "@samkawsarani/hubspot-cli";

// Search contacts
const results = await searchContacts({ query: "john@example.com" });

// Search with filters
const filtered = await searchContacts({
  filters: [{ propertyName: "email", operator: "CONTAINS_TOKEN", value: "*@acme.com" }],
});

// Find deals associated with a contact
const deals = await searchDeals({ associatedContact: "12345" });

// Get a specific record by ID
const contact = await getContact("12345");
```

## Available Functions

| Category | Functions |
|---|---|
| Properties | `listProperties`, `getAllPropertyNames`, `clearPropertyCache` |
| Generic | `searchObjects`, `getObject` |
| Contacts | `searchContacts`, `getContact` |
| Companies | `searchCompanies`, `getCompany` |
| Deals | `searchDeals`, `getDeal` |
| Tickets | `searchTickets`, `getTicket` |
| Products | `searchProducts`, `getProduct` |
| Orders | `searchOrders`, `getOrder` |
| Line Items | `searchLineItems`, `getLineItem` |
| Carts | `searchCarts`, `getCart` |
| Invoices | `searchInvoices`, `getInvoice` |
| Quotes | `searchQuotes`, `getQuote` |
| Subscriptions | `searchSubscriptions`, `getSubscription` |

## Configuration

Config is stored at `~/.config/hubspot/.env` — works globally from any directory. A `.env` in the current working directory overrides the global config.

| Variable | Required | Description |
|---|---|---|
| `HUBSPOT_ACCESS_TOKEN` | Yes | HubSpot Private App access token (`pat-...`). Create one at Settings > Integrations > Private Apps |

## License

[MIT](LICENSE) — Copyright (c) 2026 Sam Kawsarani
