# Signature Studio v1.5.2 candidate — Gmail installation safeguards

Production direct Gmail is currently disabled. This candidate does not enable
it or change Google configuration. Live recipient acceptance and rollout remain
pending. Public image preflight is required for all Gmail-oriented copy/install
paths, including the design recovery editor; the oldest legacy recovery editor
refuses those actions and directs users to import an editable backup into the
unified editor.

The shared pipeline inventories only rendered Full/Reply images, preserves source
assets, obtains explicit publication permission, creates immutable PNG objects
from final-byte hashes, and verifies their public bytes without authentication.
Signed/private or unverified image URLs cannot be copied. Hosting failures block
installation with recovery guidance; ordinary preview is not proof of readiness.

Copy happens only after a fresh render and validation of the prepared snapshot.
If async preparation loses clipboard activation, **Copy prepared signature**
provides a fresh gesture. Clipboard denial never reports success. Prepared output
expires after two minutes or a document/account/project change. Direct installation
rechecks its snapshot after OAuth and confirmation before updating Gmail.

Ready, copied, installed, and recipient-tested are distinct states. Keep a record
of real new-message/reply tests and Outlook/Apple Mail rendering. Simulated browser
tests cannot establish those outcomes. For a verified image that Gmail still
rejects, inspect the received image URL and use Gmail's supported Insert image /
Upload fallback. [EMAIL_ASSET_RUNBOOK.md](EMAIL_ASSET_RUNBOOK.md) documents the
hosting recovery sequence and public-object retention/rollback policy.

Signature Studio includes a direct Gmail installer using Google Identity Services and the Gmail API.

## Required Google Cloud configuration

1. Create or select a Google Cloud project for Signature Studio.
2. Enable the **Gmail API**.
3. Configure the OAuth consent screen with the public Signature Studio domain, Privacy Policy, and Terms URLs.
4. Create an OAuth 2.0 **Web application** client.
5. Add this Authorized JavaScript origin:
   - https://signature-studio-production-606b.up.railway.app
6. Request only this Gmail scope:
   - https://www.googleapis.com/auth/gmail.settings.basic
7. Add the OAuth client ID to Railway as:
   - PUBLIC_GOOGLE_CLIENT_ID=<client id>
8. Set:
   - ENABLE_DIRECT_GMAIL=true

The application then:
- requests Gmail settings authorization while the user is present;
- calls users.settings.sendAs.list to identify the primary Gmail send-as address;
- PATCHes that primary send-as resource with the generated HTML signature;
- does not request message-read, compose, send, or mailbox-modification scopes.

## Verification

gmail.settings.basic is a restricted Gmail OAuth scope. A public app should complete Google's OAuth verification requirements before being presented broadly to users.

## Gmail behavior

Gmail sanitizes supplied signature HTML. Signature Studio therefore:
- uses inline email-safe styles;
- detects excessive width;
- provides target-width auto-fit;
- hosts user-uploaded embedded images before direct installation;
- recommends sending a test email after installation.

## Fallback

Guided Install remains available without Google authorization. It copies the rich signature and opens Gmail Settings → General for manual paste.


## Multiple signatures and Full/Reply defaults

Signature Studio can generate both the Full and Reply variants from one master project. Gmail's web interface supports multiple named signatures and separate defaults for new messages and replies/forwards.

The public Gmail API does not expose that named-signature collection or those two default selectors. The `users.settings.sendAs` resource exposes one `signature` field per send-as alias; its `isDefault` field controls the default From address, not which named signature is used for a new message or reply.

For that reason, Signature Studio's **Full + Reply Gmail Setup**:
1. renders both variants without mutating the project;
2. provides separate rich-copy buttons for Full and Reply;
3. opens Gmail Settings → General;
4. instructs the user to create the two named signatures;
5. instructs the user to select Full for new emails and Reply for replies/forwards.

This avoids unsupported/private Gmail endpoints and keeps installation explicit.
