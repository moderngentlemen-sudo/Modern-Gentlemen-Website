# Email image hosting and recovery — v1.5.2 candidate

This is an operational runbook, not evidence of a production rollout or Gmail recipient acceptance.

## Dependency and continuity

The production Railway `signature-studio` service in project `signature-studio-v1` uses
`PUBLIC_SUPABASE_URL=https://fcewdnplakcscrtgxqdr.supabase.co`. This was checked against
the running `/config.js` and the Railway Variables UI on 2026-10-07; credentials
were not displayed. Its application root and production branch are both
`signature-studio-v1`. Direct Gmail installation is disabled in production.

Keep the original Supabase project and `signature-assets` object paths intact.
Previously sent emails cannot be rewritten; their old URLs may recover only when
their original host recovers. Editing/deleting a project does not delete its
published objects. There is no automatic garbage collection in this release.
Retention and any later deletion require a separate policy and explicit review.

The organization currently uses the Free plan. Supabase documents inactivity
pausing for that plan, so current reachability alone is not a durability guarantee.
Before production approval, the owner must choose and authorize an operational
arrangement suitable for long-lived email images. A paid Supabase arrangement or
another durable static host needs separate cost approval. Do not migrate existing
URLs without a compatibility plan; no migration is included here.

## Read-only diagnosis

1. Inspect the production Railway Variables panel. Reveal only the public URL,
   never keys. Compare it to `/config.js` and the project reference above.
2. Read the Supabase project status. A paused/restoring project blocks database,
   authentication and Storage independently of Railway's `/healthz`.
3. Inspect `signature-assets`: public flag, size/MIME constraints, existing object
   counts, and RLS for INSERT/SELECT/UPDATE/DELETE. Every modifying policy must
   restrict the first object-folder component to `auth.uid()`. Public reads must
   not imply anonymous writes. Inspect current policies, not old migration prose.
4. Sample actual existing public image URLs from Storage and from the installed
   Gmail signature. These can differ from the editable project's current sources.
5. Perform a GET with no Cookie, Authorization or apikey header. Require HTTPS,
   no redirects, successful status, supported image MIME, nonempty bounded bytes,
   successful decode and reasonable dimensions. HEAD alone is insufficient.
6. A CORS refusal means browser verification is unavailable; it is not proof that
   a recipient can or cannot load the image. Re-upload the source file if a remote
   origin refuses browser access. Do not add an unrestricted URL proxy.

Useful read-only SQL when authenticated access is available:

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'signature-assets';

select policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects';

select count(*) as existing_objects
from storage.objects where bucket_id = 'signature-assets';
```

## Recovery procedure (approval required)

Use Supabase's supported project Restore mechanism only after explicit owner
approval. If it proposes billing, upgrades, replacement infrastructure or a
destructive restore, stop and obtain approval for that specific action. Do not
reset the project, recreate the bucket, replace the backend, or change policies
to mask an outage. After restoration, independently check project health,
database reads, auth service health, storage configuration and anonymous image
decoding before declaring recovery. Record who initiated restoration; viewing
an in-progress restore does not mean this implementation initiated it.

## Publication policy

The shared pipeline starts from a stable document/account/project/revision
snapshot and the selected Full/Reply render. Only actual rendered dependencies
are processed; missing required artwork is an error, not silently dropped.
Hidden descendants, unused social channels and text-style icons are excluded.
Full + Reply uses a union and reuses identical derivatives.

Editable sources remain in the project. Cropping, zoom, shape, sizing and framing
are baked into PNG derivatives. Safe uploaded SVG is rasterized; active content
or external-resource references are rejected. A final-byte SHA-256 hash determines
`signature-assets/<owner>/<hash>.png`. Uploads are create-only with immutable
cache control. An existing-object collision must verify the exact public bytes.
If a cached canonical owner/hash URL returns an anonymous HTTP 404, the pipeline
may recreate it once with exact-snapshot publication consent and a create-only
write, then verify it again. Network outages, access denial, server errors and
mismatched bytes never authorize a recreation or overwrite.
Old `publishedAssets` entries are retained as untrusted cache hints; new
`emailAssetMetadata` records hash, owner, host, MIME, dimensions, size and check time.

The final policy accepts exact approved static URLs or content-addressed PNGs in
the configured Supabase signature bucket after anonymous verification. No static
origin is implicitly approved. Bundled artwork currently uses the same verified
owner-scoped publication flow; there is no new public hosting service to manage.
Remote source URLs are download inputs, never automatically trusted final URLs.
Signed/private URLs, URL credentials, unsafe schemes and unapproved final origins
are rejected. Verification uses GET, omitted credentials/referrer, no redirects,
a 12-second bound, a 5 MiB byte cap and decoded dimension limits (4096 per side,
16 megapixels). No backend proxy, anonymous upload endpoint or privileged key is
introduced. The normal cloud optimistic-save guard remains in place.

Publication permission describes that anyone with the URL can view these images.
It applies to the exact signature snapshot and variants, not hidden artwork or
unrelated projects. A changed account/project/revision or newer operation cancels
application of stale results. Uploaded immutable objects may remain after a
cancelled operation; the current editable document is not overwritten.

## Installation and failure diagnosis

- Preview: editable artwork rendered locally; no claim about public availability.
- Ready: required public images verified for installation, not Gmail acceptance.
- Copied: rich clipboard write actually succeeded; Gmail installation is pending.
- Installed: Gmail settings updated/saved; recipient acceptance is still pending.
- Verified in email: a real sent new message/reply was inspected in its recipient
  mailbox. Record date, browser/client, variant and image differences separately.

Copy automatically prepares a consented exact snapshot. A failed host, upload,
decode, stale edit or account switch blocks copy. Clipboard denial offers **Copy
prepared signature** for a fresh gesture; prepared results expire after two minutes
or document/account changes. Retry preparation if expired. The oldest recovery
editor refuses its obsolete Gmail actions; import its backup into the unified
editor. The design recovery editor uses the shared guard, including direct Gmail.

For a missing image, first inspect the actual recipient HTML image URL, then test
it anonymously. Distinguish DNS/outage, auth/private/signed URL, CORS, HTTP/MIME,
decode/size, clipboard and Gmail sanitization/cache issues. After valid hosting
and rich-copy have been demonstrated, Gmail's supported Insert image / Upload
method is a fallback. Keep intended links and test the resulting recipient view.
Do not repeatedly upload the same artwork without identifying the failure.

## Release and rollback

The dedicated fix branch must pass syntax, Node and all three browser suites.
Hosted CI uses `.github/workflows/signature-studio-stabilization.yml`. Tests with
mocked hosting/clipboard demonstrate guards but are not live Supabase/Gmail tests.
Use the existing isolated preview only after deployment authorization, without
altering production or enabling extra paid resources. Record the exact deployed
SHA and recheck public retrieval there. Finish default/custom logo, Full/Reply,
Gmail recipient and at least one external-client acceptance test before release.

Production remains on the previously deployed commit until explicit authorization.
Rollback restores the previous application image/commit, never deletes immutable
objects or changes their URL namespace. Preserve source projects and metadata;
older readers can ignore additive metadata. Rollback is not a solution for a
paused host and does not revoke already-public artwork. No schema migration is
needed. Verify runtime logs, `/healthz`, asset GET/decode and rollback readiness
as separate release gates.

References: [Supabase pausing](https://supabase.com/docs/guides/platform/free-project-pausing),
[public Storage](https://supabase.com/docs/guides/storage/serving/downloads),
[create-only uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads),
[Gmail SendAs](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings.sendAs),
[Gmail image troubleshooting](https://support.google.com/mail/answer/11468381).
