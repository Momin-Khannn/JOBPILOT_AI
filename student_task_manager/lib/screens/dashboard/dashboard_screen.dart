import 'package:flutter/material.dart';

import '../../core/constants/app_constants.dart';
import '../../core/utils/error_message.dart';
import '../../models/task.dart';
import '../../services/auth_service.dart';
import '../../services/task_service.dart';
import '../../widgets/empty_task_state.dart';
import '../../widgets/status_summary_card.dart';
import '../../widgets/task_card.dart';
import '../tasks/task_form_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _authService = AuthService();
  final _taskService = TaskService();
  late Stream<List<StudentTask>> _taskStream;
  TaskStatus? _selectedFilter;

  @override
  void initState() {
    super.initState();
    _taskStream = _taskService.watchTasks();
  }

  Future<void> _openTaskForm([StudentTask? task]) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => TaskFormScreen(task: task)),
    );
  }

  void _retryTaskStream() {
    setState(() => _taskStream = _taskService.watchTasks());
  }

  Future<void> _deleteTask(StudentTask task) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete task?'),
        content: Text('“${task.title}” will be permanently removed.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed != true || task.id == null) return;

    try {
      await _taskService.deleteTask(task.id!);
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(friendlyErrorMessage(error))));
    }
  }

  Future<void> _changeCompletion(StudentTask task, bool completed) async {
    try {
      await _taskService.updateStatus(task, completed ? TaskStatus.completed : TaskStatus.pending);
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(friendlyErrorMessage(error))));
    }
  }

  Future<void> _signOut() async {
    try {
      await _authService.signOut();
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(friendlyErrorMessage(error))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final email = _authService.currentUser?.email ?? 'Student';

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [Icon(Icons.checklist_rounded), SizedBox(width: 8), Text(AppConstants.appName)],
        ),
        actions: [
          IconButton(tooltip: 'Sign out', onPressed: _signOut, icon: const Icon(Icons.logout)),
          const SizedBox(width: 8),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openTaskForm,
        icon: const Icon(Icons.add),
        label: const Text('Add task'),
      ),
      body: StreamBuilder<List<StudentTask>>(
        stream: _taskStream,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _DashboardError(message: friendlyErrorMessage(snapshot.error!), onRetry: _retryTaskStream);
          }

          final allTasks = snapshot.data ?? [];
          final visibleTasks = _selectedFilter == null
              ? allTasks
              : allTasks.where((task) => task.status == _selectedFilter).toList();
          final pending = allTasks.where((task) => task.status == TaskStatus.pending).length;
          final inProgress = allTasks.where((task) => task.status == TaskStatus.inProgress).length;
          final completed = allTasks.where((task) => task.status == TaskStatus.completed).length;

          return CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                sliver: SliverToBoxAdapter(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1000),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Hello, ${email.split('@').first}', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        const Text('Here is a clear view of your study workload.'),
                        const SizedBox(height: 20),
                        _SummarySection(pending: pending, inProgress: inProgress, completed: completed),
                        const SizedBox(height: 18),
                        Row(
                          children: [
                            Expanded(child: Text('Your tasks', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold))),
                            DropdownButton<TaskStatus?>(
                              value: _selectedFilter,
                              hint: const Text('All statuses'),
                              onChanged: (value) => setState(() => _selectedFilter = value),
                              items: [
                                const DropdownMenuItem<TaskStatus?>(value: null, child: Text('All statuses')),
                                ...TaskStatus.values.map((status) => DropdownMenuItem<TaskStatus?>(value: status, child: Text(status.label))),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              if (visibleTasks.isEmpty)
                SliverFillRemaining(hasScrollBody: false, child: EmptyTaskState(onAddTask: _openTaskForm))
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                  sliver: SliverList.builder(
                    itemCount: visibleTasks.length,
                    itemBuilder: (context, index) {
                      final task = visibleTasks[index];
                      return Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 1000),
                          child: TaskCard(
                            task: task,
                            onEdit: () => _openTaskForm(task),
                            onDelete: () => _deleteTask(task),
                            onCompletedChanged: (value) => _changeCompletion(task, value),
                          ),
                        ),
                      );
                    },
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _SummarySection extends StatelessWidget {
  const _SummarySection({required this.pending, required this.inProgress, required this.completed});

  final int pending;
  final int inProgress;
  final int completed;

  @override
  Widget build(BuildContext context) {
    final cards = [
      StatusSummaryCard(label: 'Pending', count: pending, icon: Icons.schedule, color: Colors.orange),
      StatusSummaryCard(label: 'In progress', count: inProgress, icon: Icons.play_circle_outline, color: Colors.blue),
      StatusSummaryCard(label: 'Completed', count: completed, icon: Icons.check_circle_outline, color: Colors.teal),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 700) {
          return Row(
            children: [
              for (var index = 0; index < cards.length; index++) ...[
                Expanded(child: cards[index]),
                if (index != cards.length - 1) const SizedBox(width: 12),
              ],
            ],
          );
        }
        return Column(children: cards.map((card) => Padding(padding: const EdgeInsets.only(bottom: 8), child: card)).toList());
      },
    );
  }
}

class _DashboardError extends StatelessWidget {
  const _DashboardError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined, size: 56),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Try again')),
          ],
        ),
      ),
    );
  }
}
