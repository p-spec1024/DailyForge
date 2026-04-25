import 'package:flutter_test/flutter_test.dart';
import 'package:dailyforge/main.dart';

void main() {
  testWidgets('App renders', (WidgetTester tester) async {
    await tester.pumpWidget(const DailyForgeApp());
    await tester.pumpAndSettle();
  });
}
