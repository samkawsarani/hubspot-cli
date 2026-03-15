# hubspot-cli — Agent Guide

## Package Manager

This project uses **uv** for Python package management.

```bash
uv sync                # Install dependencies
uv sync --all-extras   # Install with dev dependencies
uv run pytest tests/   # Run tests
```

## Project Structure

```
src/
  __init__.py      # Public API — all exported functions
  __main__.py      # CLI entry point (argparse)
  client.py        # REST API client (httpx, singleton pattern)
  hubspot.py       # All business logic / operations
tests/
  test_hubspot.py  # Integration tests (require credentials)
```

## Conventions

### Client Pattern

- Class-based REST client built on `httpx.Client` with 30s timeout
- Lazy singleton via `get_client()` — never pass client as parameter
- Automatic retry on 429 (rate limit) with backoff
- Context manager support

### Module Pattern

- Export functions via `__all__` in `__init__.py`
- Return `dict[str, Any]` or `list[dict[str, Any]]`
- Type hints on all functions
- Functions: `get_<resource>()`, `list_<resources>()`, `search_<resources>()`

### Adding New Operations

1. Add the function to `hubspot.py`
2. Add it to `__all__` in `hubspot.py`
3. Re-export it in `__init__.py`
4. Optionally add a CLI subcommand in `__main__.py`

### Versioning & Changelog

Every change must include:

1. **Bump the version** in `pyproject.toml` following [Semantic Versioning](https://semver.org/):
   - **patch** (1.0.0 → 1.0.1): bug fixes, minor tweaks
   - **minor** (1.0.0 → 1.1.0): new features, new CLI commands, new operations
   - **major** (1.0.0 → 2.0.0): breaking changes to CLI interface or public API
2. **Update `CHANGELOG.md`**: add an entry under a new version heading at the top with a short summary of what changed

### Testing

- Tests are integration tests requiring valid credentials
- Run: `uv run pytest tests/`
- Tests are skipped automatically if `HUBSPOT_ACCESS_TOKEN` is not set
