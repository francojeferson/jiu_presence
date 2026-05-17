import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:jiu_presence/screens/login_screen.dart';
import 'package:jiu_presence/services/supabase_service.dart';

// Mock SupabaseService that delays response
class MockSupabaseService extends Mock implements SupabaseService {
  @override
  Future<void> signIn(String email, String password) async {
    // Delay the response to allow testing of loading state
    await Future.delayed(const Duration(milliseconds: 100));
    // Don't call super.signIn as it's abstract in the mock
  }
}

void main() {
  group('LoginScreen Loading Tests', () {
    late MockSupabaseService mockSupabaseService;

    setUp(() {
      mockSupabaseService = MockSupabaseService();
    });

    testWidgets('shows loading indicator when login is in progress', (WidgetTester tester) async {
      // Override the SupabaseService creation in the widget
      // We'll do this by providing a mock through dependency injection concept
      // Since the LoginScreen creates its own SupabaseService, we need to patch it
      // For this test, we'll verify the loading state is set

      await tester.pumpWidget(MaterialApp(
        home: LoginScreen(supabaseService: mockSupabaseService),
      ));

      // Enter valid credentials
      await tester.enterText(find.byType(TextField).at(0), 'test@example.com');
      await tester.enterText(find.byType(TextField).at(1), 'validpass123');

      // Tap login button
      await tester.tap(find.text('Entrar'));

      // Pump and settle to trigger state change but not complete the async operation
      await tester.pump();

      // The button should be disabled and show loading indicator
      final buttonFinder = find.descendant(
        of: find.byType(ElevatedButton),
        matching: find.byType(SizedBox),
      );

      expect(buttonFinder, findsOneWidget);

      // Check that it contains a CircularProgressIndicator
      expect(find.descendant(
        of: buttonFinder,
        matching: find.byType(CircularProgressIndicator),
      ), findsOneWidget);

      // Advance time to let the async complete
      await tester.pump(const Duration(milliseconds: 100));
    });
  });
}