import 'package:flutter_test/flutter_test.dart';
import 'package:student_task_manager/models/task.dart';

void main() {
  group('StudentTask', () {
    test('creates a task from a Supabase row', () {
      final task = StudentTask.fromMap({
        'id': 'task-1',
        'user_id': 'user-1',
        'title': 'Study probability',
        'description': 'Review chapters 1 and 2',
        'due_date': '2026-06-25',
        'priority': 'high',
        'status': 'in_progress',
        'created_at': '2026-06-19T10:00:00Z',
        'updated_at': '2026-06-19T10:00:00Z',
      });

      expect(task.title, 'Study probability');
      expect(task.priority, TaskPriority.high);
      expect(task.status, TaskStatus.inProgress);
      expect(task.dueDate, DateTime(2026, 6, 25));
    });

    test('converts a task to database values', () {
      final task = StudentTask(
        title: '  Build dashboard  ',
        description: '  Add three charts  ',
        dueDate: DateTime(2026, 7, 2),
        priority: TaskPriority.medium,
        status: TaskStatus.pending,
      );

      expect(task.toMap(), {
        'title': 'Build dashboard',
        'description': 'Add three charts',
        'due_date': '2026-07-02',
        'priority': 'medium',
        'status': 'pending',
      });
    });

    test('uses safe defaults for unknown enum values', () {
      final task = StudentTask.fromMap({
        'title': 'Task',
        'description': '',
        'due_date': '2026-06-25',
        'priority': 'unknown',
        'status': 'unknown',
      });

      expect(task.priority, TaskPriority.medium);
      expect(task.status, TaskStatus.pending);
    });
  });
}
