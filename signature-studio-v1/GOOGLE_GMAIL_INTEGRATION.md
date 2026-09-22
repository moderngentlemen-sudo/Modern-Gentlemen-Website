# Signature Studio v1 — Direct Gmail Installation

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
