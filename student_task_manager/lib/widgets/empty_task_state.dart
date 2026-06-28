import 'package:flutter/material.dart';

class EmptyTaskState extends StatelessWidget {
  const EmptyTaskState({required this.onAddTask, super.key});

  final VoidCallback onAddTask;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.task_alt, size: 72, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 16),
            Text('No tasks here yet', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text('Add your first assignment, study goal, or project deadline.', textAlign: TextAlign.center),
            const SizedBox(height: 20),
            FilledButton.icon(onPressed: onAddTask, icon: const Icon(Icons.add), label: const Text('Add first task')),
          ],
        ),
      ),
    );
  }
}
