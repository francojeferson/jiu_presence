import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jiu_presence/screens/login_screen.dart';
import 'package:jiu_presence/services/supabase_service.dart';
import 'package:mocktail/mocktail.dart';

// Mock SupabaseService
class MockSupabaseService extends Mock implements SupabaseService {}

void main() {
  group('LoginScreen UI Tests', () {
    late MockSupabaseService mockSupabaseService;

    setUp(() {
      mockSupabaseService = MockSupabaseService();
    });

    testWidgets('displays email validation error when empty', (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(
        home: LoginScreen(supabaseService: mockSupabaseService),
      ));

      // Tap login button without entering anything
      await tester.tap(find.text('Entrar'));
      await tester.pump();

      // Should show email validation error
      expect(find.textContaining('Email é obrigatório'), findsOneWidget);
    });

    testWidgets('displays email validation error when invalid format', (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(
        home: LoginScreen(supabaseService: mockSupabaseService),
      ));

      // Enter invalid email
      await tester.enterText(find.byType(TextField).at(0), 'invalid-email');
      await tester.enterText(find.byType(TextField).at(1), 'validpass123');

      // Tap login button
      await tester.tap(find.text('Entrar'));
      await tester.pump();

      // Should show email validation error
      expect(find.textContaining('Email inválido'), findsOneWidget);
    });

    testWidgets('displays password validation error when too short', (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(
        home: LoginScreen(supabaseService: mockSupabaseService),
      ));

      // Enter valid email but short password
      await tester.enterText(find.byType(TextField).at(0), 'test@example.com');
      await tester.enterText(find.byType(TextField).at(1), '123');

      // Tap login button
      await tester.tap(find.text('Entrar'));
      await tester.pump();

      // Should show password validation error
      expect(find.textContaining('Senha deve ter pelo menos 6 caracteres'), findsOneWidget);
    });

    testWidgets('shows loading indicator when login button pressed', (WidgetTester tester) async {
      // Setup mock to delay response
      when(() => mockSupabaseService.signIn(any(), any())).thenAnswer(
        (_) async => Future.delayed(const Duration(milliseconds: 100), () => {}),
      );

      await tester.pumpWidget(MaterialApp(
        home: LoginScreen(supabaseService: mockSupabaseService),
      ));

      // Enter valid credentials
      await tester.enterText(find.byType(TextField).at(0), 'test@example.com');
      await tester.enterText(find.byType(TextField).at(1), 'validpass123');

      // Tap login button
      await tester.tap(find.text('Entrar'));
      // Pump and wait for the frame to show loading indicator
      await tester.pump();

      // Should show circular progress indicator (before async operation completes)
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // Advance time to let the async complete
      await tester.pump(const Duration(milliseconds: 100));
    });
  });
}