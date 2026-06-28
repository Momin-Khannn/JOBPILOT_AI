# Functional and Non-Functional Requirements

## Functional requirements

| ID | Requirement | Acceptance result |
|---|---|---|
| FR-01 | A visitor can create an account using full name, email, and password. | A valid account is added to Supabase Auth and `public.users`. |
| FR-02 | A registered user can sign in and sign out. | Correct credentials open the dashboard; sign out returns to login. |
| FR-03 | A user can create a task. | The task appears with title, description, due date, priority, and status. |
| FR-04 | A user can view their tasks. | The dashboard streams only rows owned by the signed-in user. |
| FR-05 | A user can update a task. | Edited values are saved and shown on the dashboard. |
| FR-06 | A user can delete a task. | A confirmation is shown and the accepted deletion removes the row. |
| FR-07 | A user can mark a task complete or pending. | The task status changes and summary counts update. |
| FR-08 | A user can filter tasks by status. | The list displays all, pending, in-progress, or completed tasks. |
| FR-09 | The dashboard shows status totals. | Pending, in-progress, and completed counts match stored tasks. |
| FR-10 | Invalid forms display useful feedback. | Empty/invalid fields are not submitted and show a message. |

## Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR-01 | Usability | A first-time student can add a task without instructions. |
| NFR-02 | Security | Row Level Security limits every profile and task query to `auth.uid()`. |
| NFR-03 | Performance | A normal dashboard request should feel responsive for up to 500 tasks per user. |
| NFR-04 | Reliability | Database failures show an error without crashing the app. |
| NFR-05 | Maintainability | Models, services, screens, and reusable widgets live in separate folders. |
| NFR-06 | Portability | The Flutter code supports Android, iOS, web, and desktop runners. |
| NFR-07 | Accessibility | Controls use labels/tooltips, readable contrast, and touch-friendly sizes. |
| NFR-08 | Data integrity | Database checks allow only known priorities and statuses. |
| NFR-09 | Privacy | One user cannot read, update, or delete another user's tasks. |
| NFR-10 | Testability | Plain model logic and reusable widgets have automated tests. |
