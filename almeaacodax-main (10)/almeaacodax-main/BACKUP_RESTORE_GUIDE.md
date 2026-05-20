# Backup And Restore Guide

## Current Baseline

The repository already contains learning-content backup and restore scripts. Production still needs managed database backups and offsite retention.

## Production Backup Plan

- Enable MongoDB Atlas automated backups.
- Keep daily backups and weekly/monthly retention points.
- Store offsite encrypted exports in S3, Cloudflare R2, or Google Cloud Storage.
- Take a manual backup before every major content or code release.

## Restore Drill

1. Create a backup snapshot.
2. Restore into a staging database.
3. Run smoke checks against staging.
4. Confirm learning paths, quizzes, users, packages, and reports load correctly.
5. Document the restore date, duration, and any missing data.

## Rule

A backup is not considered reliable until a restore test has succeeded.
