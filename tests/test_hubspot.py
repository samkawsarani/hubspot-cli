#!/usr/bin/env python3
"""Tests for HubSpot CRM API integration.

Run with pytest:  uv run pytest tests/test_hubspot.py -v

Note: All tests require HUBSPOT_ACCESS_TOKEN in .env. Tests are skipped if not set.
"""

import os
import pytest

from dotenv import load_dotenv

load_dotenv()

from hubspot_cli.hubspot import (
    list_properties,
    get_all_property_names,
    search_contacts,
    get_contact,
    search_companies,
    get_company,
    search_deals,
    get_deal,
    search_tickets,
    search_products,
)

_has_token = bool(os.getenv("HUBSPOT_ACCESS_TOKEN"))
requires_api = pytest.mark.skipif(not _has_token, reason="HUBSPOT_ACCESS_TOKEN not set")


@requires_api
class TestPropertyDefinitions:
    """Test property listing and name retrieval."""

    def test_list_properties_returns_results(self):
        properties = list_properties("contacts")
        assert isinstance(properties, list)
        assert len(properties) > 0

    def test_property_has_name_and_type(self):
        properties = list_properties("contacts")
        first = properties[0]
        assert "name" in first
        assert "type" in first

    def test_get_all_property_names(self):
        names = get_all_property_names("contacts")
        assert isinstance(names, list)
        assert len(names) > 0
        assert all(isinstance(n, str) for n in names)


@requires_api
class TestContactOperations:
    """Test contact search and retrieval."""

    def test_search_contacts_returns_results(self):
        result = search_contacts(limit=5)
        assert "results" in result
        assert "total" in result

    def test_search_contacts_respects_limit(self):
        result = search_contacts(limit=3)
        contacts = result.get("results", [])
        assert len(contacts) <= 3

    def test_contact_has_properties(self):
        result = search_contacts(limit=1)
        contacts = result.get("results", [])
        if contacts:
            assert "id" in contacts[0]
            assert "properties" in contacts[0]

    def test_get_contact_by_id(self):
        result = search_contacts(limit=1)
        contacts = result.get("results", [])
        if not contacts:
            pytest.skip("No contacts found to test get_contact")
        contact_id = contacts[0]["id"]
        contact = get_contact(contact_id)
        assert contact is not None
        assert "properties" in contact

    def test_search_contacts_with_email_filter(self):
        result = search_contacts(
            filters=[{
                "propertyName": "email",
                "operator": "HAS_PROPERTY",
            }],
            limit=3,
        )
        contacts = result.get("results", [])
        for contact in contacts:
            assert contact.get("properties", {}).get("email") is not None


@requires_api
class TestCompanyOperations:
    """Test company search and retrieval."""

    def test_search_companies_returns_results(self):
        result = search_companies(limit=5)
        assert "results" in result
        assert "total" in result

    def test_company_has_properties(self):
        result = search_companies(limit=1)
        companies = result.get("results", [])
        if companies:
            assert "id" in companies[0]
            assert "properties" in companies[0]

    def test_get_company_by_id(self):
        result = search_companies(limit=1)
        companies = result.get("results", [])
        if not companies:
            pytest.skip("No companies found to test get_company")
        company_id = companies[0]["id"]
        company = get_company(company_id)
        assert company is not None
        assert "properties" in company


@requires_api
class TestDealOperations:
    """Test deal search and association filtering."""

    def test_search_deals_returns_results(self):
        result = search_deals(limit=5)
        assert "results" in result
        assert "total" in result

    def test_deal_has_properties(self):
        result = search_deals(limit=1)
        deals = result.get("results", [])
        if deals:
            assert "id" in deals[0]
            assert "properties" in deals[0]

    def test_search_deals_with_associated_contact(self):
        contacts = search_contacts(limit=1).get("results", [])
        if not contacts:
            pytest.skip("No contacts found for association test")
        contact_id = contacts[0]["id"]
        result = search_deals(associated_contact=contact_id, limit=5)
        assert "results" in result


@requires_api
class TestTicketOperations:
    """Test ticket search."""

    def test_search_tickets_returns_results(self):
        result = search_tickets(limit=3)
        assert "results" in result
        assert "total" in result


@requires_api
class TestProductOperations:
    """Test product search."""

    def test_search_products_returns_results(self):
        from hubspot_cli.client import APIError
        try:
            result = search_products(limit=3)
        except APIError as e:
            if e.status_code == 403:
                pytest.skip(f"Insufficient permissions: {e}")
            raise
        assert "results" in result
        assert "total" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
