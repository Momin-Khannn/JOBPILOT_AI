# Diagram Explanations

GitHub renders the Mermaid diagrams below directly in Markdown.

## Use case diagram

```mermaid
flowchart LR
    Student([Student])
    Register((Create account))
    Login((Log in))
    View((View dashboard))
    Add((Add task))
    Edit((Update task))
    Delete((Delete task))
    Complete((Change task status))
    Filter((Filter tasks))
    Logout((Log out))

    Student --> Register
    Student --> Login
    Student --> View
    Student --> Add
    Student --> Edit
    Student --> Delete
    Student --> Complete
    Student --> Filter
    Student --> Logout
    Login -. required before .-> View
```

**Explanation:** The Student is the only actor. Registration and login establish identity. After login, the student can access all private task operations. Deletion includes a confirmation step inside the use case.

## ER diagram

```mermaid
erDiagram
    AUTH_USERS ||--|| USERS : "has profile"
    USERS ||--o{ TASKS : owns

    AUTH_USERS {
        uuid id PK
        string email
        string encrypted_password
    }
    USERS {
        uuid id PK_FK
        string full_name
        string email
        datetime created_at
    }
    TASKS {
        uuid id PK
        uuid user_id FK
        string title
        string description
        date due_date
        string priority
        string status
        datetime created_at
        datetime updated_at
    }
```

**Explanation:** Supabase owns `auth.users`. A trigger creates exactly one matching row in `public.users`. One public user can own many tasks, while each task has one required owner.

## Class diagram

```mermaid
classDiagram
    class StudentTaskApp {
      +bool isConfigured
      +build()
    }
    class AuthGate {
      +build()
    }
    class StudentTask {
      +String id
      +String userId
      +String title
      +String description
      +DateTime dueDate
      +TaskPriority priority
      +TaskStatus status
      +fromMap()
      +toMap()
      +copyWith()
    }
    class AuthService {
      +signIn()
      +signUp()
      +signOut()
    }
    class TaskService {
      +watchTasks()
      +addTask()
      +updateTask()
      +deleteTask()
      +updateStatus()
    }
    class DashboardScreen
    class TaskFormScreen
    class TaskCard

    StudentTaskApp --> AuthGate
    AuthGate --> DashboardScreen
    DashboardScreen --> TaskService
    DashboardScreen --> AuthService
    DashboardScreen --> TaskCard
    DashboardScreen --> TaskFormScreen
    TaskFormScreen --> TaskService
    TaskService --> StudentTask
    TaskCard --> StudentTask
```

**Explanation:** Screens depend on small services; services communicate with Supabase. `StudentTask` is the shared data model. Reusable widgets receive a task and callback functions, so they do not access the database directly.
