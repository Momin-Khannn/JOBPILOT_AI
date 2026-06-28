import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:student_task_manager/widgets/status_summary_card.dart';

void main() {
  testWidgets('summary card displays its label and count', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: StatusSummaryCard(
            label: 'Completed',
            count: 4,
            icon: Icons.check_circle_outline,
            color: Colors.teal,
          ),
        ),
      ),
    );

    expect(find.text('Completed'), findsOneWidget);
    expect(find.text('4'), findsOneWidget);
    expect(find.byIcon(Icons.check_circle_outline), findsOneWidget);
  });
}
