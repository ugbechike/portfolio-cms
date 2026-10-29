# Importing the public portfolio JSON

The importer accepts a canonical envelope, not an assumed V1 format:

```json
{
  "records": [
    {
      "id": "a stable UUID from the source",
      "updatedAt": "2026-01-01T00:00:00Z",
      "content": {
        "kind": "projects",
        "title": "source title",
        "slug": "source-slug",
        "summary": "source summary"
      }
    }
  ]
}
```

This illustrative envelope is not seed content and uses a placeholder ID. A complete schema-valid synthetic test fixture lives at `scripts/fixtures/example.json`; it is explicitly labeled as fixture data and is never auto-imported. `scripts/fixtures/empty.json` contains no invented portfolio content and is safe for smoke validation.

`content.kind` is `projects`, `experiences`, `notes`, or `profile`. See `packages/contracts/src/index.ts` for exact fields. Profile's slug is always `profile`. Experience requires organization, role and startDate. Dates are ISO calendar dates; optional end dates are null. Case studies use discriminated section objects with a `type` field.

1. Obtain actual V1 files. Do not guess missing content.
2. Write a source-specific adapter to the canonical envelope once that source format is available. Preserve supplied IDs/slugs. For files without IDs, generate and persist a mapping once; do not generate new IDs on every import.
3. Upload images using the authenticated API and replace image references with returned media UUIDs. Missing references fail database constraints.
4. Validate without a database:

   ```sh
   pnpm run import path/to/canonical.json --dry-run
   ```

   With no DATABASE_URL this performs schema validation only and clearly reports that limitation.

5. Set DATABASE_URL and ADMIN_USER_ID in the root `.env` or shell. Repeat dry-run to compare against existing content. Review create/update/unchanged results.
6. Run without `--dry-run` to write drafts. Imports never publish, and updates to published records preserve their public snapshot.
7. If an existing record is newer than the source and the content differs, import refuses it. Only after review, add `--overwrite` to explicitly permit replacement. Equal payloads remain unchanged regardless of JSON object key ordering.

All files are validated before writes. Duplicate input IDs/slugs are rejected. Each record is atomic, version-checked, audited, and retryable. A later database conflict can leave earlier records committed; fix the input and rerun safely. A file-wide all-or-nothing transaction is not claimed. Unique slug conflicts are not resolved by `--overwrite`; correct the source mapping.

Revision restore replaces the editable draft only. Recover deleted content by reviewing the retained revision, exporting its payload with its original content UUID into this envelope, and importing it as a new draft. No deleted content is republished automatically.
