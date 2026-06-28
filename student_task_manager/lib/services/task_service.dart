import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/task.dart';

class TaskService {
  TaskService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  String get _userId {
    final id = _client.auth.currentUser?.id;
    if (id == null) {
      throw const AuthException('Please sign in before managing tasks.');
    }
    return id;
  }

  /// Sends a new task list whenever the signed-in user's rows change.
  Stream<List<StudentTask>> watchTasks() {
    return _client
        .from('tasks')
        .stream(primaryKey: ['id'])
        .eq('user_id', _userId)
        .order('due_date')
        .map((rows) => rows.map(StudentTask.fromMap).toList());
  }

  Future<void> addTask(StudentTask task) async {
    await _client.from('tasks').insert({
      ...task.toMap(),
      'user_id': _userId,
    });
  }

  Future<void> updateTask(StudentTask task) async {
    if (task.id == null) {
      throw ArgumentError('A task ID is required before updating.');
    }
    await _client
        .from('tasks')
        .update(task.toMap())
        .eq('id', task.id!)
        .eq('user_id', _userId);
  }

  Future<void> deleteTask(String taskId) async {
    await _client
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', _userId);
  }

  Future<void> updateStatus(StudentTask task, TaskStatus status) {
    return updateTask(task.copyWith(status: status));
  }
}
