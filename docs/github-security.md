# GitHub Security Recommendations

Use these settings before Prymal public beta.

## Branch Protection

Apply branch protection to `master`:

- require pull request before merge
- require at least one reviewer
- require approval dismissal on new commits
- require status checks to pass
- require branch to be up to date before merge
- restrict force pushes
- restrict branch deletion

## CI and Deployment

- require CI checks before merge
- keep production deploy manual-only
- require the protected `production` environment for deploys
- require environment reviewers for production deployment approval
- do not allow production deploy on a normal push

## Secret and Dependency Controls

- enable GitHub secret scanning
- enable push protection for secrets
- enable Dependabot alerts
- enable Dependabot security updates
- review Dependabot PRs weekly
- keep lockfiles committed and consistent with `npm ci`

## Actions and Secrets

- restrict GitHub Actions secrets to the minimum set required
- store production deploy secrets only in the protected `production` environment
- prefer environment secrets over repository-wide secrets for deploy credentials
- disable write-all workflow permissions unless explicitly needed

## Operational Checklist

- [ ] branch protection enabled on `master`
- [ ] PR required before merge
- [ ] required checks enabled
- [ ] secret scanning enabled
- [ ] Dependabot alerts enabled
- [ ] Dependabot security updates enabled
- [ ] production environment created and protected
- [ ] production deploy requires manual approval
- [ ] only trusted maintainers can approve production deploys
