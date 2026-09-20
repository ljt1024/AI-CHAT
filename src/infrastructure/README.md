# Infrastructure

Place external integrations here: HTTP clients, SSE transport, file storage adapters, and persistence implementations.

Feature code should depend on small interfaces from this layer instead of calling `fetch` or browser storage directly.
