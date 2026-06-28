import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/task.dart';

class TaskCard extends StatelessWidget {
  const TaskCard({
    required this.task,
    required this.onEdit,
    required this.onDelete,
    required this.onCompletedChanged,
    super.key,
  });

  final StudentTask task;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final ValueChanged<bool> onCompletedChanged;

  Color _priorityColor() {
    return switch (task.priority) {
      TaskPriority.low => Colors.blue,
      TaskPriority.medium => Colors.orange,
      TaskPriority.high => Colors.red,
    };
  }

  @override
  Widget build(BuildContext context) {
    final isCompleted = task.status == TaskStatus.completed;
    final today = DateTime.now();
    final todayOnly = DateTime(today.year, today.month, today.day);
    final dueOnly = DateTime(task.dueDate.year, task.dueDate.month, task.dueDate.day);
    final isOverdue = !isCompleted && dueOnly.isBefore(todayOnly);

    return Card(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: isOverdue ? Colors.red.shade200 : Colors.teal.shade100),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 10, 8, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              label: isCompleted ? 'Mark ${task.title} as pending' : 'Mark ${task.title} as completed',
              child: Checkbox(value: isCompleted, onChanged: (value) => onCompletedChanged(value ?? false)),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            decoration: isCompleted ? TextDecoration.lineThrough : null,
                          ),
                    ),
                    if (task.description.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(task.description, maxLines: 2, overflow: TextOverflow.ellipsis),
                    ],
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _TaskChip(icon: Icons.flag_outlined, text: task.priority.label, color: _priorityColor()),
                        _TaskChip(icon: Icons.timelapse, text: task.status.label, color: Colors.teal),
                        _TaskChip(
                          icon: isOverdue ? Icons.warning_amber_rounded : Icons.calendar_today_outlined,
                          text: isOverdue ? 'Overdue · ${DateFormat.yMMMd().format(task.dueDate)}' : DateFormat.yMMMd().format(task.dueDate),
                          color: isOverdue ? Colors.red : Colors.blueGrey,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            PopupMenuButton<String>(
              tooltip: 'Task actions',
              onSelected: (value) => value == 'edit' ? onEdit() : onDelete(),
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'edit', child: ListTile(leading: Icon(Icons.edit_outlined), title: Text('Edit'))),
                PopupMenuItem(value: 'delete', child: ListTile(leading: Icon(Icons.delete_outline), title: Text('Delete'))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TaskChip extends StatelessWidget {
  const _TaskChip({required this.icon, required this.text, required this.color});

  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [Icon(icon, size: 15, color: color), const SizedBox(width: 5), Text(text, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600))],
      ),
    );
  }
}
