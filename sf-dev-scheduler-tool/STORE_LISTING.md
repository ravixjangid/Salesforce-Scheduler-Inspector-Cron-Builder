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

- `storage`: save preferences, cache scheduler snapshots, and store launcher position
- `cookies`: read Salesforce session cookies for supported Salesforce domains so the extension can query Salesforce APIs for the org already open in Chrome
- `alarms`: refresh cached scheduler data every 5 minutes
- `notifications`: show alerts for failed, missed, or stopped schedules

## Host Access Justification

The extension needs access to supported Salesforce domains to query scheduler data for the org the user is already logged into.

The floating launcher is injected only on supported Salesforce domains where the user already has a logged-in session. The extension does not inject content scripts on unrelated websites.

## Recommended Screenshots

1. Scheduler Monitor overview with summary cards and active schedulers
2. Job detail drawer showing cron, next run, and Apex class
3. Cron Builder with presets and generated next runs
4. Explain Cron example with plain-language summary

## Reviewer Test Instructions

Use these instructions in the Chrome Web Store "Test instructions" field.

1. Open any supported Salesforce org in Chrome and sign in with a valid Sa
lesforce user session.
2. Refresh the Salesforce tab after installing or updating the extension.
3. Confirm the floating launcher icon appears only on logged-in Salesforce pages.
4. Click the launcher to open the first screen with both tools:
   - `Scheduler Inspector`
   - `Cron Builder`
5. Open `Scheduler Inspector` and confirm scheduler data loads for the logged-in org.
6. Open `Cron Builder` and confirm the builder loads and generates cron expressions.

Supported Salesforce host examples:

- `https://*.salesforce.com/*`
- `https://*.salesforce-setup.com/*`
- `https://*.force.com/*`

Notes for reviewers:

- `Scheduler Inspector` requires a valid logged-in Salesforce session.
- `Cron Builder` can still be opened from the launcher menu.
- No external server owned by this extension is used. Salesforce data is queried directly from the logged-in org using the existing browser session.

## Support Notes

- Support email: `rj.sfdccloud@gmail.com`
- Feedback form: `https://forms.gle/exWd91UqZVh8v9oFA`
- Add a public privacy policy URL before publishing
- Review the current launcher behavior and confirm it matches the final store disclosure
