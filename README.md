# hubspot-cli

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-orange.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Star this repo](https://img.shields.io/github/stars/samkawsarani/hubspot-cli?style=social)](https://github.com/samkawsarani/hubspot-cli)

Read-only HubSpot CRM API client with CLI. Built for use by LLM agents and humans.

## Installation

### From source (local development)

```bash
git clone https://github.com/samkawsarani/hubspot-cli.git
cd hubspot-cli
uv sync            # or: pip install -e ".[dev]"
```

### As a pip dependency (in another project)

```bash
# Install from a git repo
pip install "hubspot-cli @ git+https://github.com/samkawsarani/hubspot-cli.git"

# Or add to your pyproject.toml dependencies
# "hubspot-cli @ git+https://github.com/samkawsarani/hubspot-cli.git"
```

### For agents (MCP tools / Claude Code / etc.)

```bash
# Install globally so the CLI is available
pip install "hubspot-cli @ git+https://github.com/samkawsarani/hubspot-cli.git"

# Or install in an isolated environment with uv
uv tool install "hubspot-cli @ git+https://github.com/samkawsarani/hubspot-cli.git"
```

## Usage

### As a Python library

```python
from hubspot_cli import search_contacts, get_contact, search_deals, get_deal

# Search for contacts
results = search_contacts(query="john@example.com")

# Get a specific contact by ID
contact = get_contact(contact_id="12345")

# Search with filters
results = search_contacts(
    filters=[{
        "propertyName": "email",
        "operator": "CONTAINS_TOKEN",
        "value": "*@hubspot.com"
    }]
)

# Search deals associated with a contact
deals = search_deals(associated_contact="12345")
```

### As a CLI

```bash
# Search commands
hubspot-cli search-companies --query "Acme"
hubspot-cli search-contacts --query "john@example.com"
hubspot-cli search-deals --query "Enterprise"
hubspot-cli search-tickets --query "bug"

# Get by ID
hubspot-cli get-company --id 12345
hubspot-cli get-contact --id 12345
hubspot-cli get-deal --id 12345
hubspot-cli get-ticket --id 12345
```

### As a Python module

```bash
python -m hubspot_cli search-companies --query "Acme"
```

## Available Functions

| Category | Functions |
|----------|-----------|
| Properties | `list_properties`, `get_all_property_names`, `clear_property_cache` |
| Contacts | `search_contacts`, `get_contact` |
| Companies | `search_companies`, `get_company` |
| Deals | `search_deals`, `get_deal` |
| Tickets | `search_tickets`, `get_ticket` |
| Products | `search_products`, `get_product` |
| Orders | `search_orders`, `get_order` |
| Line Items | `search_line_items`, `get_line_item` |
| Carts | `search_carts`, `get_cart` |
| Invoices | `search_invoices`, `get_invoice` |
| Quotes | `search_quotes`, `get_quote` |
| Subscriptions | `search_subscriptions`, `get_subscription` |

## Configuration

Set your HubSpot Private App access token as an environment variable:

```bash
export HUBSPOT_ACCESS_TOKEN="pat-na1-xxxxxxxx"
```

Or create a `.env` file:

```
HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxx
```

## Testing

```bash
uv run pytest tests/ -v
```

Tests are integration tests requiring a valid `HUBSPOT_ACCESS_TOKEN`. They are skipped automatically if the token is not set.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License
This work is licensed under CC BY-NC-SA 4.0.

Copyright © 2026 Sam Kawsarani. You may view, use, modify, and share this repo with attribution for non-commercial purposes. Commercial sale is not permitted, but you may use it internally for work and business.

Full license: [https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode)
