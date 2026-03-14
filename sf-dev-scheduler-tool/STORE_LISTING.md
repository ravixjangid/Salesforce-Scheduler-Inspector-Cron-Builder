# Chrome Web Store Draft

## Extension Name

Salesforce Scheduler Inspector & Cron Builder

## Short Description

Monitor Salesforce scheduled jobs, review run health, and build Quartz cron expressions.

## Detailed Description

Salesforce Scheduler Inspector & Cron Builder helps Salesforce developers and admins review Scheduled Apex activity and build Quartz cron expressions from one lightweight extension.

Features:

- inspect active Scheduled Apex jobs
- see runs today, failures, and upcoming runs
- switch between multiple open Salesforce orgs
- review scheduler detail, including cron, next run, previous run, run count, and related Apex class
- use browser time or Salesforce org time when reviewing daily activity
- get alerts for failed, missed, or stopped schedules
- build Quartz cron expressions with presets and plain-language summaries
- explain existing cron expressions, including common Salesforce Quartz patterns

## Permission Justification

- `activeTab`: identify the current Salesforce org context
- `scripting`: open the embedded extension panel from the page launcher
- `storage`: save preferences, cache scheduler snapshots, and store launcher position
- `cookies`: read Salesforce session cookies for supported Salesforce domains so the extension can query Salesforce APIs for the org already open in Chrome
- `alarms`: refresh cached scheduler data every 5 minutes
- `notifications`: show alerts for failed, missed, or stopped schedules

## Host Access Justification

The extension needs access to supported Salesforce domains to query scheduler data for the org the user is already logged into.

The launcher is available on normal `http` and `https` pages so users can open the generic Cron Builder outside Salesforce. On non-Salesforce pages, the extension does not query Salesforce data or read page content for business logic.

## Recommended Screenshots

1. Scheduler Monitor overview with summary cards and active schedulers
2. Job detail drawer showing cron, next run, and Apex class
3. Cron Builder with presets and generated next runs
4. Explain Cron example with plain-language summary

## Support Notes

- Add a support email before publishing
- Add a public privacy policy URL before publishing
- Review the current all-sites launcher behavior and confirm it matches the final store disclosure
