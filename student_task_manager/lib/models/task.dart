enum TaskPriority { low, medium, high }

enum TaskStatus { pending, inProgress, completed }

extension TaskPriorityText on TaskPriority {
  String get databaseValue => name;

  String get label => name[0].toUpperCase() + name.substring(1);

  static TaskPriority fromDatabase(String value) {
    return TaskPriority.values.firstWhere(
      (priority) => priority.databaseValue == value,
      orElse: () => TaskPriority.medium,
    );
  }
}

extension TaskStatusText on TaskStatus {
  String get databaseValue {
    return switch (this) {
      TaskStatus.pending => 'pending',
      TaskStatus.inProgress => 'in_progress',
      TaskStatus.completed => 'completed',
    };
  }

  String get label {
    return switch (this) {
      TaskStatus.pending => 'Pending',
      TaskStatus.inProgress => 'In progress',
      TaskStatus.completed => 'Completed',
    };
  }

  static TaskStatus fromDatabase(String value) {
    return TaskStatus.values.firstWhere(
      (status) => status.databaseValue == value,
      orElse: () => TaskStatus.pending,
    );
  }
}

/// A single study task used by both the screens and Supabase service.
class StudentTask {
  const StudentTask({
    this.id,
    this.userId,
    required this.title,
    required this.description,
    required this.dueDate,
    required this.priority,
    required this.status,
    this.createdAt,
    this.updatedAt,
  });

  final String? id;
  final String? userId;
  final String title;
  final String description;
  final DateTime dueDate;
  final TaskPriority priority;
  final TaskStatus status;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory StudentTask.fromMap(Map<String, dynamic> map) {
    return StudentTask(
      id: map['id'] as String?,
      userId: map['user_id'] as String?,
      title: map['title'] as String? ?? '',
      description: map['description'] as String? ?? '',
      dueDate: DateTime.parse(map['due_date'] as String),
      priority: TaskPriorityText.fromDatabase(map['priority'] as String? ?? ''),
      status: TaskStatusText.fromDatabase(map['status'] as String? ?? ''),
      createdAt: DateTime.tryParse(map['created_at'] as String? ?? ''),
      updatedAt: DateTime.tryParse(map['updated_at'] as String? ?? ''),
    );
  }

  /// Data that is safe to send when creating or updating a task.
  Map<String, dynamic> toMap() {
    return {
      'title': title.trim(),
      'description': description.trim(),
      'due_date': _dateOnly(dueDate),
      'priority': priority.databaseValue,
      'status': status.databaseValue,
    };
  }

  StudentTask copyWith({
    String? id,
    String? userId,
    String? title,
    String? description,
    DateTime? dueDate,
    TaskPriority? priority,
    TaskStatus? status,
  }) {
    return StudentTask(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      title: title ?? this.title,
      description: description ?? this.description,
      dueDate: dueDate ?? this.dueDate,
      priority: priority ?? this.priority,
      status: status ?? this.status,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }

  static String _dateOnly(DateTime value) {
    final month = value.month.toString().padLeft(2, '0');
    final day = value.day.toString().padLeft(2, '0');
    return '${value.year}-$month-$day';
  }
}
