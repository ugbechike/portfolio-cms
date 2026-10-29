# Future portfolio MCP integration

No custom MCP server or fake MCP routes are implemented here. The Supabase management MCP server installed in Codex is a development tool; it is not the future portfolio content interface.

## Current boundary

CMS → HTTPS API → authorized content services → PostgreSQL / private Storage.

The API verifies a Supabase access token with `auth.getUser(token)` and requires its immutable user ID to equal ADMIN_USER_ID. CORS does not grant access. Service-role keys and the private database connection stay on the API server. An MCP process must call this API; it must not connect directly to PostgreSQL or use the Supabase service-role key.

## Future agent identity and scopes

Do not hand an agent the administrator's refresh token or reuse the administrator identity for unattended writes. Before enabling agents, implement a separate machine identity/token exchange at the API boundary, with short-lived tokens, an explicit audience, revocation and narrowly scoped permissions. Verify signatures, issuer, audience, expiry, and persisted grants server-side.

Potential scopes: `content:read`, `draft:create`, `draft:update`, `revisions:read`, and `publication:request`. Grants should include allowed content kinds and, when necessary, content UUIDs. Deny every operation absent a grant; verify authorization again in the service layer, including revision restore and media attachment. Never accept a role or scope supplied only in tool arguments or user-editable metadata. The current admin-only API deliberately does not accept these future agent tokens yet.

## Agent writes and publication approval

Agent edits should use the same shared schemas, version checks, transactions and revision mechanism. They modify only drafts. Do not give agents `publish`, `unpublish`, archive or delete access merely because they can update a draft.

Add publication requests as durable records containing the exact content UUID, revision/version, requester, snapshot digest and reason. The administrator reviews a preview and approves that exact version. If the draft changes, invalidate the approval and require another review. Publication must atomically check authorization and approval/version, then write the snapshot. Never interpret an agent's text saying “approved” as approval.

## Audit evolution

Current revisions record actorId, action, content snapshot, version and timestamp, including deletion tombstones. Extend this with actor type, delegated grant ID, request/correlation ID, tool name, approval ID and optional human-readable rationale. Avoid storing tokens, secrets or arbitrary prompts in audit records. Separate immutable audit retention from content revision retention, and log denied requests with minimal identifying information.

## Threat model

Treat portfolio text, imported files and model output as untrusted data. A case study cannot authorize access to another entry. Validate every input and referenced media ID. Use version checks to avoid overwriting concurrent human edits. Apply rate/size limits, enforce per-identity scopes before loading records, and return only the fields permitted for the caller. Keep tokens out of tool responses and logs. Test expired/revoked tokens, missing scopes, cross-content IDs, forged approval requests and stale version approvals before enabling the integration.
