"""CLI interface for HubSpot integration.

Usage:
    hubspot-cli <command> [options]
    python -m hubspot_cli <command> [options]

Commands:
    init                Configure HubSpot API credentials
    search-companies    Search companies
    search-deals        Search deals
    search-tickets      Search tickets
    search-contacts     Search contacts
    get-company         Get company by ID
    get-deal            Get deal by ID
    get-ticket          Get ticket by ID
    get-contact         Get contact by ID
"""

import argparse
import getpass
import json
import os
import sys

from . import __version__
from .client import CONFIG_DIR, CONFIG_ENV, load_config
from . import (
    search_companies,
    search_deals,
    search_tickets,
    search_contacts,
    get_company,
    get_deal,
    get_ticket,
    get_contact,
)


def cmd_init(args: argparse.Namespace) -> None:
    """Configure HubSpot API credentials."""
    print("HubSpot CLI Setup")
    print("=" * 40)
    print()
    print("You need a HubSpot Private App access token.")
    print("Create one at: Settings > Integrations > Private Apps")
    print()

    # Check for existing token
    existing = os.getenv("HUBSPOT_ACCESS_TOKEN")
    if existing:
        masked = existing[:8] + "..." + existing[-4:] if len(existing) > 12 else "***"
        print(f"Current token: {masked}")
        confirm = input("Replace existing token? [y/N]: ").strip().lower()
        if confirm != "y":
            print("Keeping existing token.")
            return

    token = getpass.getpass("Enter your HubSpot Private App access token: ").strip()
    if not token:
        print("No token provided. Aborting.", file=sys.stderr)
        return

    # Validate the token
    print("Validating token...", end=" ", flush=True)
    try:
        from .client import HubSpotClient
        client = HubSpotClient(token=token)
        result = client.get("/account-info/v3/api-usage/daily/private-apps")
        client.close()
        print("OK")
    except Exception:
        # Fallback: try a simpler endpoint
        try:
            from .client import HubSpotClient
            client = HubSpotClient(token=token)
            client.get("/crm/v3/properties/contacts")
            client.close()
            print("OK")
        except Exception as e:
            print("FAILED")
            print(f"Error: {e}", file=sys.stderr)
            save_anyway = input("Save token anyway? [y/N]: ").strip().lower()
            if save_anyway != "y":
                print("Aborting.")
                return

    # Write to global config
    os.makedirs(CONFIG_DIR, exist_ok=True)
    lines: list[str] = []
    if os.path.exists(CONFIG_ENV):
        with open(CONFIG_ENV) as f:
            lines = f.readlines()
    # Strip existing HUBSPOT_* lines
    lines = [l for l in lines if not l.startswith("HUBSPOT_")]
    lines.append(f"HUBSPOT_ACCESS_TOKEN={token}\n")
    with open(CONFIG_ENV, "w") as f:
        f.writelines(lines)

    print()
    print("Configuration saved to ~/.config/hubspot-cli/.env")
    print("Override any value by setting it in a local .env file.")
    print("Run `hubspot-cli search-contacts` to get started.")


def cmd_search_companies(args: argparse.Namespace) -> None:
    """Search companies."""
    result = search_companies(
        query=args.query,
        limit=args.limit,
        after=args.after,
    )
    print(json.dumps(result, indent=2, default=str))


def cmd_search_deals(args: argparse.Namespace) -> None:
    """Search deals."""
    result = search_deals(
        query=args.query,
        limit=args.limit,
        after=args.after,
    )
    print(json.dumps(result, indent=2, default=str))


def cmd_search_tickets(args: argparse.Namespace) -> None:
    """Search tickets."""
    result = search_tickets(
        query=args.query,
        limit=args.limit,
        after=args.after,
    )
    print(json.dumps(result, indent=2, default=str))


def cmd_search_contacts(args: argparse.Namespace) -> None:
    """Search contacts."""
    result = search_contacts(
        query=args.query,
        limit=args.limit,
        after=args.after,
    )
    print(json.dumps(result, indent=2, default=str))


def cmd_get_company(args: argparse.Namespace) -> None:
    """Get company by ID."""
    result = get_company(args.id)
    print(json.dumps(result, indent=2, default=str))


def cmd_get_deal(args: argparse.Namespace) -> None:
    """Get deal by ID."""
    result = get_deal(args.id)
    print(json.dumps(result, indent=2, default=str))


def cmd_get_ticket(args: argparse.Namespace) -> None:
    """Get ticket by ID."""
    result = get_ticket(args.id)
    print(json.dumps(result, indent=2, default=str))


def cmd_get_contact(args: argparse.Namespace) -> None:
    """Get contact by ID."""
    result = get_contact(args.id)
    print(json.dumps(result, indent=2, default=str))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="HubSpot integration CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--version", action="version", version=f"hubspot-cli {__version__}")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # init
    p_init = subparsers.add_parser("init", help="Configure HubSpot API credentials")
    p_init.set_defaults(func=cmd_init)

    # search-companies
    p_companies = subparsers.add_parser("search-companies", help="Search companies")
    p_companies.add_argument("--query", "-q", help="Search query")
    p_companies.add_argument("--limit", "-l", type=int, default=100, help="Max results (max 200)")
    p_companies.add_argument("--after", help="Pagination cursor")
    p_companies.set_defaults(func=cmd_search_companies)

    # search-deals
    p_deals = subparsers.add_parser("search-deals", help="Search deals")
    p_deals.add_argument("--query", "-q", help="Search query")
    p_deals.add_argument("--limit", "-l", type=int, default=100, help="Max results (max 200)")
    p_deals.add_argument("--after", help="Pagination cursor")
    p_deals.set_defaults(func=cmd_search_deals)

    # search-tickets
    p_tickets = subparsers.add_parser("search-tickets", help="Search tickets")
    p_tickets.add_argument("--query", "-q", help="Search query")
    p_tickets.add_argument("--limit", "-l", type=int, default=100, help="Max results (max 200)")
    p_tickets.add_argument("--after", help="Pagination cursor")
    p_tickets.set_defaults(func=cmd_search_tickets)

    # search-contacts
    p_contacts = subparsers.add_parser("search-contacts", help="Search contacts")
    p_contacts.add_argument("--query", "-q", help="Search query")
    p_contacts.add_argument("--limit", "-l", type=int, default=100, help="Max results (max 200)")
    p_contacts.add_argument("--after", help="Pagination cursor")
    p_contacts.set_defaults(func=cmd_search_contacts)

    # get-company
    p_get_company = subparsers.add_parser("get-company", help="Get company by ID")
    p_get_company.add_argument("--id", required=True, help="Company ID")
    p_get_company.set_defaults(func=cmd_get_company)

    # get-deal
    p_get_deal = subparsers.add_parser("get-deal", help="Get deal by ID")
    p_get_deal.add_argument("--id", required=True, help="Deal ID")
    p_get_deal.set_defaults(func=cmd_get_deal)

    # get-ticket
    p_get_ticket = subparsers.add_parser("get-ticket", help="Get ticket by ID")
    p_get_ticket.add_argument("--id", required=True, help="Ticket ID")
    p_get_ticket.set_defaults(func=cmd_get_ticket)

    # get-contact
    p_get_contact = subparsers.add_parser("get-contact", help="Get contact by ID")
    p_get_contact.add_argument("--id", required=True, help="Contact ID")
    p_get_contact.set_defaults(func=cmd_get_contact)

    args = parser.parse_args()

    try:
        args.func(args)
        return 0
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
