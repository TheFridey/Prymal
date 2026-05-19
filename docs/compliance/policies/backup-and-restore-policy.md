# Backup And Restore Policy

## Purpose

Ensure Prymal can restore service and critical data after failure, operator error, or security incident.

## Scope

Production PostgreSQL, critical configuration, and any operational records needed to recover service safely.

## Owner

Operations / Engineering

## Review Frequency

Quarterly.

## Requirements

- Production data backups must run at least daily.
- A copy must be stored off-server and encrypted where practical.
- Backups must be tested through restore drills on a defined schedule.
- Pre-release or pre-migration backups must be taken before risky database changes.
- Backup failures and restore failures must be recorded and escalated.

## Evidence Expected

- backup and restore register
- backup job logs
- restore drill output
- change records for pre-migration backups

## Exceptions Process

Any missed backup or missed restore test must be logged in the corrective action register with a recovery date and owner.
