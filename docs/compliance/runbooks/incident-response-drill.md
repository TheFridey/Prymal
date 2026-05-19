# Incident Response Drill

## Objective

Test the incident handling process before a real production incident occurs.

## When To Run

At least annually, and after a major process change.

## Commands / Evidence To Collect

- run a tabletop scenario such as leaked API key, failed backup restore, or webhook compromise
- capture timeline, roles, containment decisions, and follow-up actions
- optionally confirm secret rotation steps and service restart commands

## Pass / Fail Criteria

- Pass: roles were clear, decisions documented, corrective actions assigned
- Fail: no owner, no timeline, or no documented recovery path

## Output Evidence File Naming

`YYYY-MM-incident-response-drill.evidence.local.md`
