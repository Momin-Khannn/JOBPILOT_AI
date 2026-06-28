---
name: backend-api-development
description: Design, build, debug, and document beginner-friendly backend services and REST APIs using Node.js with Express by default or Python FastAPI when requested. Use for CRUD endpoints, routes, controllers, authentication, validation, error handling, environment variables, API tests, and Postman examples.
---

# Backend API Development

Build a small, coherent API with predictable requests, responses, validation, and errors.

## Workflow

1. Inspect the existing stack, data model, authentication, and deployment constraints.
2. Confirm whether a custom API is necessary; use a managed backend's API when it already satisfies the scope.
3. Prefer Node.js with Express unless the user asks for FastAPI or the repository already uses another stack.
4. Define resources and endpoints before writing code.
5. Separate configuration, routes, controllers, services, models, middleware, and tests only when the project size benefits.
6. Implement validation and centralized error handling.
7. Test success, invalid input, unauthorized access, missing records, and server failures.
8. Document setup and example requests.

## REST Conventions

- Use `GET` to read, `POST` to create, `PATCH` or `PUT` to update, and `DELETE` to remove.
- Use resource-oriented paths such as `/api/tasks` and `/api/tasks/:id`.
- Return JSON with appropriate status codes: `200`, `201`, `204`, `400`, `401`, `403`, `404`, and `500`.
- Never trust ownership or user IDs supplied by the client; derive identity from verified authentication.
- Keep secrets in environment variables and include a safe `.env.example`.
- Avoid leaking stack traces, tokens, password hashes, or internal database errors.

## Documentation and Testing

- Show each endpoint's method, path, authentication, body, response, and error cases.
- Include short JSON request and response examples.
- Provide Postman or `curl` steps using placeholder credentials only.
- Add automated route/service tests when the project supports them.
- Give exact development and production commands.
