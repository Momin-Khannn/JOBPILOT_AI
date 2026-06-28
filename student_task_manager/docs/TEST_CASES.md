# Test Cases

## Manual acceptance tests

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| TC-01 | Valid signup | Enter name, unused email, password, confirmation; submit. | Account is created and a success message appears. |
| TC-02 | Invalid signup email | Enter an email without `@`; submit. | Form shows a valid-email message and sends nothing. |
| TC-03 | Password mismatch | Enter different password values; submit. | Form reports that passwords do not match. |
| TC-04 | Valid login | Enter registered credentials; submit. | Dashboard opens. |
| TC-05 | Invalid login | Enter a wrong password. | A readable authentication error appears. |
| TC-06 | Sign out | Press the sign-out icon. | Login screen appears and private data is hidden. |
| TC-07 | Create task | Add all task fields and save. | New task appears in due-date order. |
| TC-08 | Empty title | Leave title empty and save. | Validation blocks the request. |
| TC-09 | Edit task | Open task menu, edit fields, save. | Card shows updated values. |
| TC-10 | Cancel deletion | Select delete, then cancel. | Task remains. |
| TC-11 | Confirm deletion | Select delete and confirm. | Task disappears. |
| TC-12 | Complete task | Check the task checkbox. | Status becomes completed and summary count changes. |
| TC-13 | Return task to pending | Uncheck a completed task. | Status becomes pending. |
| TC-14 | Filter pending | Select Pending from filter. | Only pending cards are shown. |
| TC-15 | Overdue task | Create a past-due incomplete task. | Card displays a visible overdue label. |
| TC-16 | User isolation | Create users A/B; add task as A; log in as B. | B cannot see or change A's task. |
| TC-17 | Network failure | Disconnect internet and try to save. | App shows an error and does not crash. |
| TC-18 | Missing configuration | Run without `--dart-define` values. | Setup-required screen explains what is missing. |
| TC-19 | Small phone layout | Run at about 375 px width. | Summary cards stack and no horizontal scrolling appears. |
| TC-20 | Wide layout | Run on tablet/web width. | Summary cards share one row and content remains centered. |

## Automated tests

- `task_test.dart` checks row conversion, outgoing database values, trimming, date formatting, and enum fallbacks.
- `status_summary_card_test.dart` checks that reusable dashboard data is rendered.

Run them with:

```bash
flutter test
```

## Suggested test evidence for a university report

Capture screenshots of TC-01, TC-04, TC-07, TC-09, TC-11, TC-12, TC-16, and the `flutter test` output. Do not include real passwords or secret keys in screenshots.
