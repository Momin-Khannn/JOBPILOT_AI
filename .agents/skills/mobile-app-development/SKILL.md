---
name: mobile-app-development
description: Build and improve beginner-friendly mobile applications with Flutter and Dart or, when requested, React Native or native Android. Use for mobile project setup, folder structure, screens, navigation, forms, responsive UI, validation, state, device integration, testing, and run/build instructions.
---

# Mobile App Development

Create understandable, runnable mobile applications while keeping the architecture proportional to the project.

## Workflow

1. Inspect the existing repository, SDK availability, and target platforms.
2. Restate the requested screens, data, navigation, and backend dependencies.
3. Prefer Flutter with Dart unless the user selects another stack.
4. Show the proposed folder structure before creating a new project.
5. Separate models, services, screens, reusable widgets, configuration, and tests.
6. Implement one complete user flow at a time, including loading, empty, success, and error states.
7. Add form validation, safe async handling, and accessible control labels.
8. Format, analyze, test, and build when the required SDK is available. State any unavailable checks clearly.

## Implementation Guidelines

- Use simple Material components and standard navigation before adding libraries.
- Keep code beginner-friendly and add comments where intent is not obvious.
- Avoid advanced state management until shared state genuinely requires it.
- Use flexible constraints or `LayoutBuilder`; avoid fixed screen widths.
- Keep secrets outside source control and inject configuration at build or run time.
- For student CRUD projects, include authentication, dashboard, list/detail or form screens, and clear create/edit/delete feedback when required.
- Reuse an add/edit form when both operations have the same fields.
- Explain every hand-written file in plain language.

## Delivery Checklist

- Provide exact install, dependency, run, test, and build commands.
- Include platform prerequisites and environment configuration.
- Confirm navigation, validation, CRUD behavior, responsiveness, and error handling.
- Keep generated platform boilerplate separate from application business logic.
