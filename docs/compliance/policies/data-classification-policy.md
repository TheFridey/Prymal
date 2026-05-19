# Data Classification Policy

## Purpose

Define how Prymal classifies and handles information so that sensitive material receives stronger protection.

## Scope

Source code, documentation, operational records, secrets, customer data, logs, and supplier configuration data.

## Owner

Founder / Security lead

## Review Frequency

Annually.

## Requirements

- Information must be classified as Public, Internal, Confidential, or Restricted.
- Restricted data must never be committed to Git or shared in plaintext.
- Confidential and Restricted data should be shared only on a need-to-know basis.
- Evidence and screenshots must be reviewed for secrets before storage.
- Logs and exported evidence should avoid customer data unless strictly required and protected.

## Evidence Expected

- data classification table
- evidence review notes
- redaction-aware evidence bundles

## Exceptions Process

Any exception involving Restricted data must be explicitly approved and documented with storage, retention, and deletion controls.
