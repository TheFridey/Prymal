# New Supplier Security Review

## Objective

Review a new supplier before it is trusted with Prymal data, credentials, production traffic, or operational control.

## When To Run

Before onboarding any new critical supplier or enabling a new production integration.

## Commands / Evidence To Collect

- identify service owner and business purpose
- confirm whether MFA is supported and required
- confirm what data the supplier will process
- confirm who can administer the account
- record exit plan or replacement path where practical

## Pass / Fail Criteria

- Pass: supplier owner assigned, security basics checked, risk understood, supplier register updated
- Fail: no owner, no MFA expectation, or unclear data exposure

## Output Evidence File Naming

`YYYY-MM-new-supplier-security-review.evidence.local.md`
