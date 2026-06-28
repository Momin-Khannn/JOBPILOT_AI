import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/constants/app_constants.dart';
import '../../core/utils/error_message.dart';
import '../../models/task.dart';
import '../../services/task_service.dart';

class TaskFormScreen extends StatefulWidget {
  const TaskFormScreen({this.task, super.key});

  final StudentTask? task;

  @override
  State<TaskFormScreen> createState() => _TaskFormScreenState();
}

class _TaskFormScreenState extends State<TaskFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _taskService = TaskService();
  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;
  late DateTime _dueDate;
  late TaskPriority _priority;
  late TaskStatus _status;
  bool _isSaving = false;

  bool get _isEditing => widget.task != null;

  @override
  void initState() {
    super.initState();
    final task = widget.task;
    _titleController = TextEditingController(text: task?.title ?? '');
    _descriptionController = TextEditingController(text: task?.description ?? '');
    _dueDate = task?.dueDate ?? DateTime.now().add(const Duration(days: 1));
    _priority = task?.priority ?? TaskPriority.medium;
    _status = task?.status ?? TaskStatus.pending;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _chooseDate() async {
    final selected = await showDatePicker(
      context: context,
      initialDate: _dueDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
      helpText: 'Select task due date',
    );
    if (selected != null) setState(() => _dueDate = selected);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);

    final task = StudentTask(
      id: widget.task?.id,
      userId: widget.task?.userId,
      title: _titleController.text,
      description: _descriptionController.text,
      dueDate: _dueDate,
      priority: _priority,
      status: _status,
    );

    try {
      if (_isEditing) {
        await _taskService.updateTask(task);
      } else {
        await _taskService.addTask(task);
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyErrorMessage(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEditing ? 'Edit task' : 'Add task')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 680),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _titleController,
                      textInputAction: TextInputAction.next,
                      maxLength: AppConstants.titleMaxLength,
                      decoration: const InputDecoration(labelText: 'Task title', hintText: 'Example: Finish statistics assignment', prefixIcon: Icon(Icons.title)),
                      validator: (value) => (value?.trim().isEmpty ?? true) ? 'Please enter a task title.' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _descriptionController,
                      maxLength: AppConstants.descriptionMaxLength,
                      minLines: 3,
                      maxLines: 5,
                      decoration: const InputDecoration(labelText: 'Description', hintText: 'Add useful notes or steps', alignLabelWithHint: true),
                    ),
                    const SizedBox(height: 12),
                    InkWell(
                      onTap: _chooseDate,
                      borderRadius: BorderRadius.circular(12),
                      child: InputDecorator(
                        decoration: const InputDecoration(labelText: 'Due date', prefixIcon: Icon(Icons.calendar_month_outlined)),
                        child: Text(DateFormat.yMMMMd().format(_dueDate)),
                      ),
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<TaskPriority>(
                      initialValue: _priority,
                      decoration: const InputDecoration(labelText: 'Priority', prefixIcon: Icon(Icons.flag_outlined)),
                      items: TaskPriority.values.map((priority) => DropdownMenuItem(value: priority, child: Text(priority.label))).toList(),
                      onChanged: (value) => setState(() => _priority = value ?? TaskPriority.medium),
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<TaskStatus>(
                      initialValue: _status,
                      decoration: const InputDecoration(labelText: 'Status', prefixIcon: Icon(Icons.timelapse)),
                      items: TaskStatus.values.map((status) => DropdownMenuItem(value: status, child: Text(status.label))).toList(),
                      onChanged: (value) => setState(() => _status = value ?? TaskStatus.pending),
                    ),
                    const SizedBox(height: 24),
                    FilledButton.icon(
                      onPressed: _isSaving ? null : _save,
                      icon: _isSaving
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.save_outlined),
                      label: Text(_isSaving ? 'Saving...' : _isEditing ? 'Update task' : 'Create task'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
