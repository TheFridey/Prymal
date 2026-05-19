# Backup Restore Test

## Objective

Prove that production backups can be restored within an acceptable time and with the expected data set.

## When To Run

Quarterly and before major schema-risk changes where practical.

## Commands / Evidence To Collect

```bash
pg_dump -Fc "$DATABASE_URL" > pretest.dump
pg_restore --clean --if-exists --dbname "$RESTORE_DATABASE_URL" pretest.dump
```

- record start and finish times
- record restore target and validation checks
- update the backup restore register

## Pass / Fail Criteria

- Pass: restore completes successfully and validation checks pass
- Fail: restore errors, incomplete data, or no timing evidence

## Output Evidence File Naming

`YYYY-MM-backup-restore-test.evidence.local.md`
