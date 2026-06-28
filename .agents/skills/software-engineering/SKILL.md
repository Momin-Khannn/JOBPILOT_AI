---
name: software-engineering
description: Plan and document student and professional software projects using requirements engineering, SDLC, SRS, Agile or Waterfall choices, UML-style diagrams, architecture explanations, test planning, debugging, and project reports. Use for functional and non-functional requirements, use cases, class/activity/sequence diagrams, ER models, acceptance criteria, and test cases.
---

# Software Engineering

Produce professional but easy-to-understand project documentation that matches the implemented system.

## Documentation Workflow

1. Establish the problem, scope, users, assumptions, constraints, and exclusions.
2. Write numbered functional requirements with observable acceptance results.
3. Write measurable non-functional requirements for usability, security, performance, reliability, maintainability, portability, accessibility, and privacy as relevant.
4. Describe actors, preconditions, main flows, alternate flows, and postconditions for important use cases.
5. Create diagrams that reflect real components and relationships.
6. Derive positive, negative, boundary, security, and failure test cases from requirements.
7. Cross-check names and behavior against the source code before finalizing documentation.

## SRS Structure

Include purpose, scope, intended audience, definitions, product perspective, user classes, operating environment, assumptions, constraints, system features, interface requirements, data requirements, security, and future work. Keep version 1 requirements separate from optional future ideas.

## Diagram Guidance

- Use Mermaid when editable text diagrams are acceptable.
- Explain each diagram in plain language after showing it.
- Use a use case diagram for actor goals.
- Use a class diagram for code responsibilities and dependencies.
- Use an activity or sequence diagram for multi-step behavior.
- Use an ER diagram for persistent entities and cardinalities.
- Do not invent classes, tables, or actions that are absent from the project.

## Test Cases

For each case, include an ID, scenario, preconditions, steps or input, expected result, and test type when useful. Cover authentication, CRUD, validation, authorization, empty states, network/database failure, and responsive behavior when they exist.

## Method Selection

Recommend Agile/Scrum for iterative projects, Waterfall for fixed academic deliverables, RAD for fast prototypes, or a small hybrid when appropriate. Explain the reason briefly instead of adding theory unrelated to the task.
