"""HubSpot CRM operations — properties, search, contacts, companies, deals, tickets, products, orders, line items, carts, invoices, quotes, subscriptions."""

from functools import lru_cache
from typing import Any

from .client import get_client


# ---------------------------------------------------------------------------
# Properties
# ---------------------------------------------------------------------------


def list_properties(object_type: str) -> list[dict[str, Any]]:
    """
    Get all property definitions for an object type.

    Args:
        object_type: The CRM object type (e.g., 'contacts', 'companies', 'deals').

    Returns:
        List of property definition objects with keys like:
        - name: Property internal name
        - label: Property display label
        - type: Property type (string, number, date, etc.)
        - fieldType: UI field type (text, select, checkbox, etc.)
        - groupName: Property group name
        - description: Property description
    """
    client = get_client()
    response = client.get(f"/crm/v3/properties/{object_type}")
    return response.get("results", [])


@lru_cache(maxsize=32)
def get_all_property_names(object_type: str) -> list[str]:
    """
    Get all property names for an object type.

    This is cached to avoid repeated API calls when doing multiple searches.
    Use clear_property_cache() if you need to refresh.

    Args:
        object_type: The CRM object type (e.g., 'contacts', 'companies', 'deals').

    Returns:
        List of property names (internal names) that can be used in search requests.
    """
    properties = list_properties(object_type)
    return [prop["name"] for prop in properties]


def clear_property_cache():
    """Clear the cached property names. Call this if properties have changed."""
    get_all_property_names.cache_clear()


# ---------------------------------------------------------------------------
# Generic search / get
# ---------------------------------------------------------------------------


def search_objects(
    object_type: str,
    query: str | None = None,
    filters: list[dict[str, Any]] | None = None,
    association_filters: dict[str, str] | None = None,
    properties: list[str] | None = None,
    include_all_properties: bool = True,
    sorts: list[dict[str, str]] | None = None,
    limit: int = 100,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Generic CRM object search with association and property support.

    Args:
        object_type: The CRM object type (e.g., 'contacts', 'companies', 'deals').
        query: Text search string across default searchable properties.
        filters: List of filter objects. Each filter has:
            - propertyName: Property to filter on
            - operator: EQ, NEQ, LT, LTE, GT, GTE, BETWEEN, IN, NOT_IN,
                       HAS_PROPERTY, NOT_HAS_PROPERTY, CONTAINS_TOKEN, NOT_CONTAINS_TOKEN
            - value: Filter value (for most operators)
            - values: List of values (for IN, NOT_IN)
            - highValue: Upper bound (for BETWEEN)
        association_filters: Dict mapping object type to ID for association filtering.
            Example: {"contact": "123"} finds objects associated with contact 123.
        properties: Specific properties to return. If None and include_all_properties
            is True, fetches all properties including custom ones.
        include_all_properties: If True and properties is None, fetch all properties.
            If False and properties is None, returns only default properties.
        sorts: List of sort objects with 'propertyName' and 'direction' (ASCENDING/DESCENDING).
        limit: Maximum results to return (max 200).
        after: Pagination cursor from previous response.

    Returns:
        Dict with:
        - results: List of matching objects with id, properties, createdAt, updatedAt
        - total: Total number of matching results
        - paging: Pagination info with next.after cursor if more results exist

    Example:
        # Find contacts with email containing @hubspot.com
        results = search_objects(
            "contacts",
            filters=[{
                "propertyName": "email",
                "operator": "CONTAINS_TOKEN",
                "value": "*@hubspot.com"
            }]
        )

        # Find deals associated with a specific contact
        results = search_objects(
            "deals",
            association_filters={"contact": "12345"}
        )
    """
    client = get_client()

    # Build request body
    body: dict[str, Any] = {
        "limit": min(limit, 200),  # HubSpot max is 200
    }

    # Add text search query
    if query:
        body["query"] = query

    # Build filter groups
    filter_groups: list[dict[str, Any]] = []

    # Add regular filters
    if filters:
        filter_groups.append({"filters": filters})

    # Add association filters (using associations.{type} pseudo-property)
    if association_filters:
        assoc_filters = [
            {
                "propertyName": f"associations.{obj_type}",
                "operator": "EQ",
                "value": obj_id,
            }
            for obj_type, obj_id in association_filters.items()
        ]
        if filter_groups:
            # AND with existing filters
            filter_groups[0]["filters"].extend(assoc_filters)
        else:
            filter_groups.append({"filters": assoc_filters})

    if filter_groups:
        body["filterGroups"] = filter_groups

    # Determine properties to fetch
    if properties:
        body["properties"] = properties
    elif include_all_properties:
        # Fetch all properties including custom ones
        body["properties"] = get_all_property_names(object_type)

    # Add sorting
    if sorts:
        body["sorts"] = sorts

    # Add pagination cursor
    if after:
        body["after"] = after

    # Make the search request
    endpoint = f"/crm/v3/objects/{object_type}/search"
    return client.post(endpoint, body)


def get_object(object_type: str, object_id: str) -> dict[str, Any] | None:
    """
    Get a single CRM object by ID with all properties.

    Args:
        object_type: The CRM object type (e.g., 'contacts', 'companies', 'deals').
        object_id: The object's HubSpot ID.

    Returns:
        Object dict with id, properties, createdAt, updatedAt, or None if not found.
    """
    client = get_client()

    # Get all property names to fetch all properties
    all_props = get_all_property_names(object_type)

    try:
        endpoint = f"/crm/v3/objects/{object_type}/{object_id}"
        params = {"properties": ",".join(all_props)} if all_props else None
        return client.get(endpoint, params=params)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------


def search_contacts(
    query: str | None = None,
    filters: list[dict[str, Any]] | None = None,
    associated_company: str | None = None,
    associated_deal: str | None = None,
    include_all_properties: bool = True,
    properties: list[str] | None = None,
    sorts: list[dict[str, str]] | None = None,
    limit: int = 100,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Search contacts with all properties and association support.

    Args:
        query: Text search across default searchable properties.
        filters: Filter objects with propertyName, operator, and value.
        associated_company: Filter by associated company ID.
        associated_deal: Filter by associated deal ID.
        include_all_properties: Fetch all properties including custom (default True).
        properties: Specific properties to return (overrides include_all_properties).
        sorts: Sort objects with propertyName and direction.
        limit: Maximum results (max 200).
        after: Pagination cursor.

    Returns:
        Search results with total, results list, and paging info.

    Example:
        # Find contacts with email containing @hubspot.com
        contacts = search_contacts(
            filters=[{
                "propertyName": "email",
                "operator": "CONTAINS_TOKEN",
                "value": "*@hubspot.com"
            }]
        )

        # Find contacts associated with a company
        contacts = search_contacts(associated_company="12345")
    """
    association_filters = {}
    if associated_company:
        association_filters["company"] = associated_company
    if associated_deal:
        association_filters["deal"] = associated_deal

    return search_objects(
        object_type="contacts",
        query=query,
        filters=filters,
        association_filters=association_filters or None,
        properties=properties,
        include_all_properties=include_all_properties,
        sorts=sorts,
        limit=limit,
        after=after,
    )


def get_contact(contact_id: str) -> dict[str, Any] | None:
    """
    Get a single contact by ID with all properties.

    Args:
        contact_id: The contact's HubSpot ID.

    Returns:
        Contact object with id, properties, createdAt, updatedAt, or None if not found.
    """
    return get_object("contacts", contact_id)


# ---------------------------------------------------------------------------
# Companies
# ---------------------------------------------------------------------------


def search_companies(
    query: str | None = None,
    filters: list[dict[str, Any]] | None = None,
    associated_contact: str | None = None,
    associated_deal: str | None = None,
    include_all_properties: bool = True,
    properties: list[str] | None = None,
    sorts: list[dict[str, str]] | None = None,
    limit: int = 100,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Search companies with all properties and association support.

    Args:
        query: Text search across default searchable properties.
        filters: Filter objects with propertyName, operator, and value.
        associated_contact: Filter by associated contact ID.
        associated_deal: Filter by associated deal ID.
        include_all_properties: Fetch all properties including custom (default True).
        properties: Specific properties to return (overrides include_all_properties).
        sorts: Sort objects with propertyName and direction.
        limit: Maximum results (max 200).
        after: Pagination cursor.

    Returns:
        Search results with total, results list, and paging info.

    Example:
        # Find companies with revenue > $1M
        companies = search_companies(
            filters=[{
                "propertyName": "annualrevenue",
                "operator": "GT",
                "value": "1000000"
            }]
        )
    """
    association_filters = {}
    if associated_contact:
        association_filters["contact"] = associated_contact
    if associated_deal:
        association_filters["deal"] = associated_deal

    return search_objects(
        object_type="companies",
        query=query,
        filters=filters,
        association_filters=association_filters or None,
        properties=properties,
        include_all_properties=include_all_properties,
        sorts=sorts,
        limit=limit,
        after=after,
    )


def get_company(company_id: str) -> dict[str, Any] | None:
    """
    Get a single company by ID with all properties.

    Args:
        company_id: The company's HubSpot ID.

    Returns:
        Company object with id, properties, createdAt, updatedAt, or None if not found.
    """
    return get_object("companies", company_id)


# ---------------------------------------------------------------------------
# Deals
# ---------------------------------------------------------------------------


def search_deals(
    query: str | None = None,
    filters: list[dict[str, Any]] | None = None,
    associated_contact: str | None = None,
    associated_company: str | None = None,
    include_all_properties: bool = True,
    properties: list[str] | None = None,
    sorts: list[dict[str, str]] | None = None,
    limit: int = 100,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Search deals with all properties and association support.

    Args:
        query: Text search across default searchable properties.
        filters: Filter objects with propertyName, operator, and value.
        associated_contact: Filter by associated contact ID.
        associated_company: Filter by associated company ID.
        include_all_properties: Fetch all properties including custom (default True).
        properties: Specific properties to return (overrides include_all_properties).
        sorts: Sort objects with propertyName and direction.
        limit: Maximum results (max 200).
        after: Pagination cursor.

    Returns:
        Search results with total, results list, and paging info.

    Example:
        # Find deals in a specific stage
        deals = search_deals(
            filters=[{
                "propertyName": "dealstage",
                "operator": "EQ",
                "value": "closedwon"
            }]
        )

        # Find deals associated with a contact
        deals = search_deals(associated_contact="12345")
    """
    association_filters = {}
    if associated_contact:
        association_filters["contact"] = associated_contact
    if associated_company:
        association_filters["company"] = associated_company

    return search_objects(
        object_type="deals",
        query=query,
        filters=filters,
        association_filters=association_filters or None,
        properties=properties,
        include_all_properties=include_all_properties,
        sorts=sorts,
        limit=limit,
        after=after,
    )


def get_deal(deal_id: str) -> dict[str, Any] | None:
    """
    Get a single deal by ID with all properties.

    Args:
        deal_id: The deal's HubSpot ID.

    Returns:
        Deal object with id, properties, createdAt, updatedAt, or None if not found.
    """
    return get_object("deals", deal_id)


# ---------------------------------------------------------------------------
# Tickets
# ---------------------------------------------------------------------------


def search_tickets(
    query: str | None = None,
    filters: list[dict[str, Any]] | None = None,
    associated_contact: str | None = None,
    associated_company: str | None = None,
    associated_deal: str | None = None,
    include_all_properties: bool = True,
    properties: list[str] | None = None,
    sorts: list[dict[str, str]] | None = None,
    limit: int = 100,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Search tickets with all properties and association support.

    Args:
        query: Text search across default searchable properties.
        filters: Filter objects with propertyName, operator, and value.
        associated_contact: Filter by associated contact ID.
        associated_company: Filter by associated company ID.
        associated_deal: Filter by associated deal ID.
        include_all_properties: Fetch all properties including custom (default True).
        properties: Specific properties to return (overrides include_all_properties).
        sorts: Sort objects with propertyName and direction.
        limit: Maximum results (max 200).
        after: Pagination cursor.

    Returns:
        Search results with total, results list, and paging info.

    Example:
        # Search for tickets about login issues
        tickets = search_tickets(query="login issue")

        # Find high priority tickets
        tickets = search_tickets(
            filters=[{
                "propertyName": "hs_ticket_priority",
                "operator": "EQ",
                "value": "HIGH"
            }]
        )
    """
    association_filters = {}
    if associated_contact:
        association_filters["contact"] = associated_contact
    if associated_company:
        association_filters["company"] = associated_company
    if associated_deal:
        association_filters["deal"] = associated_deal

    return search_objects(
        object_type="tickets",
        query=query,
        filters=filters,
        association_filters=association_filters or None,
        properties=properties,
        include_all_properties=include_all_properties,
        sorts=sorts,
        limit=limit,
        after=after,
    )


def get_ticket(ticket_id: str) -> dict[str, Any] | None:
    """
    Get a single ticket by ID with all properties.

    Args:
        ticket_id: The ticket's HubSpot ID.

    Returns:
        Ticket object with id, properties, createdAt, updatedAt, or None if not found.
    """
    return get_object("tickets", ticket_id)


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------


def search_products(
    query: str | None = None,
    filters: list[dict[str, Any]] | None = None,
    include_all_properties: bool = True,
    properties: list[str] | None = None,
    sorts: list[dict[str, str]] | None = None,
    limit: int = 100,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Search products with all properties.

    Args:
        query: Text search across default searchable properties.
        filters: Filter objects with propertyName, operator, and value.
        include_all_properties: Fetch all properties including custom (default True).
        properties: Specific properties to return (overrides include_all_properties).
        sorts: Sort objects with propertyName and direction.
        limit: Maximum results (max 200).
        after: Pagination cursor.

    Returns:
        Search results with total, results list, and paging info.

    Example:
        # Find products by name
        products = search_products(query="Enterprise Plan")

        # Find products with price > $100
        products = search_products(
            filters=[{
                "propertyName": "price",
                "operator": "GT",
                "value": "100"
            }]
        )
    """
    return search_objects(
        object_type="products",
        query=query,
        filters=filters,
        properties=properties,
        include_all_properties=include_all_properties,
        sorts=sorts,
        limit=limit,
        after=after,
    )


def get_product(product_id: str) -> dict[str, Any] | None:
    """
    Get a single product by ID with all properties.

    Args:
        product_id: The product's HubSpot ID.

    Returns:
        Product object with id, properties, createdAt, updatedAt, or None if not found.
    """
    return get_object("products", product_id)


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------


def search_orders(
    query: str | None = None,
    filters: list[dict[str, Any]] | None = None,
    associated_contact: str | None = None,
    associated_company: str | None = None,
    associated_deal: str | None = None,
    include_all_properties: bool = True,
    properties: list[str] | None = None,
    sorts: list[dict[str, str]] | None = None,
    limit: int = 100,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Search orders with all properties and association support.

    Args:
        query: Text search across default searchable properties.
        filters: Filter objects with propertyName, operator, and value.
        associated_contact: Filter by associated contact ID.
        associated_company: Filter by associated company ID.
        associated_deal: Filter by associated deal ID.
        include_all_properties: Fetch all properties including custom (default True).
        properties: Specific properties to return (overrides include_all_properties).
        sorts: Sort objects with propertyName and direction.
        limit: Maximum results (max 200).
        after: Pagination cursor.

    Returns:
        Search results with total, results list, and paging info.
    """
    association_filters = {}
    if associated_contact:
        association_filters["contact"] = associated_contact
    if associated_company:
        association_filters["company"] = associated_company
    if associated_deal:
        association_filters["deal"] = associated_deal

    return search_objects(
        object_type="orders",
        query=query,
        filters=filters,
        association_filters=association_filters or None,
        properties=properties,
        include_all_properties=include_all_properties,
        sorts=sorts,
        limit=limit,
        after=after,
    )


def get_order(order_id: str) -> dict[str, Any] | None:
    """
    Get a single order by ID with all properties.

    Args:
        order_id: The order's HubSpot ID.

    Returns:
        Order object with id, properties, createdAt, updatedAt, or None if not found.
    """
    return get_object("orders", order_id)


# ---------------------------------------------------------------------------
# Line Items
# ---------------------------------------------------------------------------


def search_line_items(
    query: str | None = None,
    filters: list[dict[str, Any]] | None = None,
    associated_deal: str | None = None,
    associated_quote: str | None = None,
    include_all_properties: bool = True,
    properties: list[str] | None = None,
    sorts: list[dict[str, str]] | None = None,
    limit: int = 100,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Search line items with all properties and association support.

    Args:
        query: Text search across default searchable properties.
        filters: Filter objects with propertyName, operator, and value.
        associated_deal: Filter by associated deal ID.
        associated_quote: Filter by associated quote ID.
        include_all_properties: Fetch all properties including custom (default True).
        properties: Specific properties to return (overrides include_all_properties).
        sorts: Sort objects with propertyName and direction.
        limit: Maximum results (max 200).
        after: Pagination cursor.

    Returns:
        Search results with total, results list, and paging info.

    Example:
        # Find line items for a deal
        line_items = search_line_items(associated_deal="12345")
    """
    association_filters = {}
    if associated_deal:
        association_filters["deal"] = associated_deal
    if associated_quote:
        association_filters["quote"] = associated_quote

    return search_objects(
        object_type="line_items",
        query=query,
        filters=filters,
        association_filters=association_filters or None,
        properties=properties,
        include_all_properties=include_all_properties,
        sorts=sorts,
        limit=limit,
        after=after,
    )


def get_line_item(line_item_id: str) -> dict[str, Any] | None:
    """
    Get a single line item by ID with all properties.

    Args:
        line_item_id: The line item's HubSpot ID.

    Returns:
        Line item object with id, properties, createdAt, updatedAt, or None if not found.
    """
    return get_object("line_items", line_item_id)


# ---------------------------------------------------------------------------
# Carts
# ---------------------------------------------------------------------------


def search_carts(
    query: str | None = None,
    filters: list[dict[str, Any]] | None = None,
    associated_contact: str | None = None,
    include_all_properties: bool = True,
    properties: list[str] | None = None,
    sorts: list[dict[str, str]] | None = None,
    limit: int = 100,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Search carts with all properties and association support.

    Args:
        query: Text search across default searchable properties.
        filters: Filter objects with propertyName, operator, and value.
        associated_contact: Filter by associated contact ID.
        include_all_properties: Fetch all properties including custom (default True).
        properties: Specific properties to return (overrides include_all_properties).
        sorts: Sort objects with propertyName and direction.
        limit: Maximum results (max 200).
        after: Pagination cursor.

    Returns:
        Search results with total, results list, and paging info.
    """
    association_filters = {}
    if associated_contact:
        association_filters["contact"] = associated_contact

    return search_objects(
        object_type="carts",
        query=query,
        filters=filters,
        association_filters=association_filters or None,
        properties=properties,
        include_all_properties=include_all_properties,
        sorts=sorts,
        limit=limit,
        after=after,
    )


def get_cart(cart_id: str) -> dict[str, Any] | None:
    """
    Get a single cart by ID with all properties.

    Args:
        cart_id: The cart's HubSpot ID.

    Returns:
        Cart object with id, properties, createdAt, updatedAt, or None if not found.
    """
    return get_object("carts", cart_id)


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------


def search_invoices(
    query: str | None = None,
    filters: list[dict[str, Any]] | None = None,
    associated_contact: str | None = None,
    associated_company: str | None = None,
    associated_deal: str | None = None,
    include_all_properties: bool = True,
    properties: list[str] | None = None,
    sorts: list[dict[str, str]] | None = None,
    limit: int = 100,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Search invoices with all properties and association support.

    Args:
        query: Text search across default searchable properties.
        filters: Filter objects with propertyName, operator, and value.
        associated_contact: Filter by associated contact ID.
        associated_company: Filter by associated company ID.
        associated_deal: Filter by associated deal ID.
        include_all_properties: Fetch all properties including custom (default True).
        properties: Specific properties to return (overrides include_all_properties).
        sorts: Sort objects with propertyName and direction.
        limit: Maximum results (max 200).
        after: Pagination cursor.

    Returns:
        Search results with total, results list, and paging info.

    Example:
        # Find unpaid invoices
        invoices = search_invoices(
            filters=[{
                "propertyName": "hs_invoice_status",
                "operator": "EQ",
                "value": "open"
            }]
        )
    """
    association_filters = {}
    if associated_contact:
        association_filters["contact"] = associated_contact
    if associated_company:
        association_filters["company"] = associated_company
    if associated_deal:
        association_filters["deal"] = associated_deal

    return search_objects(
        object_type="invoices",
        query=query,
        filters=filters,
        association_filters=association_filters or None,
        properties=properties,
        include_all_properties=include_all_properties,
        sorts=sorts,
        limit=limit,
        after=after,
    )


def get_invoice(invoice_id: str) -> dict[str, Any] | None:
    """
    Get a single invoice by ID with all properties.

    Args:
        invoice_id: The invoice's HubSpot ID.

    Returns:
        Invoice object with id, properties, createdAt, updatedAt, or None if not found.
    """
    return get_object("invoices", invoice_id)


# ---------------------------------------------------------------------------
# Quotes
# ---------------------------------------------------------------------------


def search_quotes(
    query: str | None = None,
    filters: list[dict[str, Any]] | None = None,
    associated_contact: str | None = None,
    associated_company: str | None = None,
    associated_deal: str | None = None,
    include_all_properties: bool = True,
    properties: list[str] | None = None,
    sorts: list[dict[str, str]] | None = None,
    limit: int = 100,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Search quotes with all properties and association support.

    Args:
        query: Text search across default searchable properties.
        filters: Filter objects with propertyName, operator, and value.
        associated_contact: Filter by associated contact ID.
        associated_company: Filter by associated company ID.
        associated_deal: Filter by associated deal ID.
        include_all_properties: Fetch all properties including custom (default True).
        properties: Specific properties to return (overrides include_all_properties).
        sorts: Sort objects with propertyName and direction.
        limit: Maximum results (max 200).
        after: Pagination cursor.

    Returns:
        Search results with total, results list, and paging info.

    Example:
        # Find quotes pending approval
        quotes = search_quotes(
            filters=[{
                "propertyName": "hs_status",
                "operator": "EQ",
                "value": "PENDING_APPROVAL"
            }]
        )
    """
    association_filters = {}
    if associated_contact:
        association_filters["contact"] = associated_contact
    if associated_company:
        association_filters["company"] = associated_company
    if associated_deal:
        association_filters["deal"] = associated_deal

    return search_objects(
        object_type="quotes",
        query=query,
        filters=filters,
        association_filters=association_filters or None,
        properties=properties,
        include_all_properties=include_all_properties,
        sorts=sorts,
        limit=limit,
        after=after,
    )


def get_quote(quote_id: str) -> dict[str, Any] | None:
    """
    Get a single quote by ID with all properties.

    Args:
        quote_id: The quote's HubSpot ID.

    Returns:
        Quote object with id, properties, createdAt, updatedAt, or None if not found.
    """
    return get_object("quotes", quote_id)


# ---------------------------------------------------------------------------
# Subscriptions
# ---------------------------------------------------------------------------


def search_subscriptions(
    query: str | None = None,
    filters: list[dict[str, Any]] | None = None,
    associated_contact: str | None = None,
    associated_company: str | None = None,
    include_all_properties: bool = True,
    properties: list[str] | None = None,
    sorts: list[dict[str, str]] | None = None,
    limit: int = 100,
    after: str | None = None,
) -> dict[str, Any]:
    """
    Search subscriptions with all properties and association support.

    Args:
        query: Text search across default searchable properties.
        filters: Filter objects with propertyName, operator, and value.
        associated_contact: Filter by associated contact ID.
        associated_company: Filter by associated company ID.
        include_all_properties: Fetch all properties including custom (default True).
        properties: Specific properties to return (overrides include_all_properties).
        sorts: Sort objects with propertyName and direction.
        limit: Maximum results (max 200).
        after: Pagination cursor.

    Returns:
        Search results with total, results list, and paging info.

    Example:
        # Find active subscriptions
        subscriptions = search_subscriptions(
            filters=[{
                "propertyName": "hs_status",
                "operator": "EQ",
                "value": "active"
            }]
        )
    """
    association_filters = {}
    if associated_contact:
        association_filters["contact"] = associated_contact
    if associated_company:
        association_filters["company"] = associated_company

    return search_objects(
        object_type="subscriptions",
        query=query,
        filters=filters,
        association_filters=association_filters or None,
        properties=properties,
        include_all_properties=include_all_properties,
        sorts=sorts,
        limit=limit,
        after=after,
    )


def get_subscription(subscription_id: str) -> dict[str, Any] | None:
    """
    Get a single subscription by ID with all properties.

    Args:
        subscription_id: The subscription's HubSpot ID.

    Returns:
        Subscription object with id, properties, createdAt, updatedAt, or None if not found.
    """
    return get_object("subscriptions", subscription_id)
