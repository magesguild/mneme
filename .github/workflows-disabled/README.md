# Disabled inherited workflows

These workflows were inherited from the upstream project and are disabled
while Mneme establishes its own repository, release, security, and automation
boundaries.

They are preserved for reference only. GitHub Actions does not load workflows
from this directory. No inherited workflow may be moved back into
`.github/workflows/` without an explicit Mneme review covering:

- repository and branch assumptions;
- secrets, tokens, permissions, and external services;
- release and package ownership;
- OpenCode-specific commands or action references; and
- whether the workflow belongs in Mneme at all.

The first replacement workflows should be small, Mneme-owned, and added only
after their failure and rollback behavior is understood.
