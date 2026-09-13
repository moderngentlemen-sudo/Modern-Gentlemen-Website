# Cloud development and GitHub Actions verification

The selected workflow is to develop changes in the cloud checkout, upload them
to a development branch, and use the existing GitHub Actions checks before
merging or deploying. This replaces the earlier plan to complete every check
before uploading any new changes to GitHub.

## Initial baseline

The setup branch is `codex/cloud-actions-baseline`, based on main at
`7ea2a002a054f5b7b79b500b1bcc0d2ad75a31ef`. This initial pull request adds only
this guide and exercises the existing application as a baseline. It includes
no application changes or new prototype integrations.

The application remains in `design_handoff_modern_gentlemen/starter`. Its
existing Node version, lockfile, test configuration, and CI workflow are
unchanged. Follow `AGENTS.md` for the repository's standing development rules.

Before preparing this setup, the existing local gates passed under Node
22.23.2: formatting, lint, TypeScript, environment declarations, and all
2,703 unit/component tests in 150 files, with no skipped unit tests.

## Development and verification

1. Make scoped changes on a development branch and preserve the existing
   public design and builder compatibility.
2. Run the required formatting, lint, typecheck, and unit gates locally.
   Inspect the diff for intended changes and exclude credentials, generated
   dependencies, build output, and unrelated formatting.
3. Push the development branch and open or update its pull request. The
   existing `.github/workflows/ci.yml` runs on pull requests.
4. Review the hosted results for the final candidate commit. Fix failures
   and rerun the relevant checks before proposing release.
5. Present the verified pull request and any remaining limitations.
   Merge and deployment are separate authorized steps.

The existing CI workflow provides disposable test services, seeded content,
and a test administrator. It runs static and unit checks, migration replay,
integration tests, a production build, authenticated browser journeys,
visual regression, accessibility checks, and performance budgets.

Record executed, failed, retried, and skipped counts. Missing credentials,
an empty suite, or a skipped fixture is not a passing test. Four existing
admin screenshot cases lack committed reference images and deliberately
skip; reviewed baselines are needed to close that coverage gap.

## Review boundaries

Hosted results are recorded on the pull request and linked Actions run.
The initial hosted results remain pending until that run completes.

GitHub Actions provides test reports and captured review images, rather than
a persistent interactive website preview. A shareable preview is separate
work. Browser automation also does not replace device-specific verification
of iPhone/Safari video playback and third-party video behavior.

No hosted database branch or paid preview service is provisioned by this
setup. The existing CI workflow and its fixture safeguards remain intact.
