---
name: database-design-sql
description: Design and explain relational databases with PostgreSQL, MySQL, or SQLite. Use for entities and attributes, primary and foreign keys, one-to-one, one-to-many and many-to-many relationships, normalization through 3NF, ER diagrams, constraints, indexes, migrations, seed data, joins, and CRUD SQL.
---

# Database Design and SQL

Turn project requirements into a small, secure relational schema and practical SQL.

## Design Workflow

1. Identify entities, required attributes, ownership, and data lifecycle.
2. Choose primary keys and model relationships with foreign keys.
3. Resolve many-to-many relationships with junction tables.
4. Normalize to 3NF where useful; explain any deliberate denormalization.
5. Add `NOT NULL`, `UNIQUE`, `CHECK`, default, and referential actions based on business rules.
6. Add indexes for actual filters, joins, sorting, and uniqueness—not every column.
7. Write rerunnable migrations or a clearly ordered schema script.
8. Test CRUD, joins, constraints, deletion behavior, and user isolation.

## SQL Output

When relevant, provide and explain:

- `CREATE TABLE` statements
- Sample `INSERT` data
- `SELECT` queries and joins
- `UPDATE` and `DELETE` operations
- Indexes, triggers, views, or policies only when justified

Use the SQL dialect already selected by the project. Never present MySQL and PostgreSQL syntax as interchangeable.

## Explanation Guidelines

- Describe each table and relationship in easy words.
- Include an ER diagram or Mermaid ER model for multi-table designs.
- State cardinality and optionality explicitly.
- Explain cascade, restrict, or set-null deletion choices.
- Keep sample data fictional and free of secrets.
- Call out common mistakes such as duplicated data, missing constraints, orphan rows, unsafe string-built queries, and absent ownership filters.
