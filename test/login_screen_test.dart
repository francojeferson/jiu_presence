import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:jiu_presence/screens/login_screen.dart';
import 'package:jiu_presence/services/supabase_service.dart';

// Mock SupabaseService
class MockSupabaseService extends Mock implements SupabaseService {}

void main() {
  group('LoginScreen', () {
    late MockSupabaseService mockSupabaseService;

    setUp(() {
      mockSupabaseService = MockSupabaseService();
    });

    testWidgets('shows validation error when email is empty', (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(
        home: LoginScreen(supabaseService: mockSupabaseService),
      ));

      // Tap login button without entering anything
      await tester.tap(find.text('Entrar'));
      await tester.pump();

      // Should show email validation error
      expect(find.textContaining('Email é obrigatório'), findsOneWidget);
    });

    testWidgets('shows validation error when email is invalid', (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(
        home: LoginScreen(supabaseService: mockSupabaseService),
      ));

      // Enter invalid email
      await tester.enterText(find.byType(TextField).at(0), 'invalid-email');
      await tester.enterText(find.byType(TextField).at(1), 'validpass');

      // Tap login button
      await tester.tap(find.text('Entrar'));
      await tester.pump();

      // Should show email validation error
      expect(find.textContaining('Email inválido'), findsOneWidget);
    });

    testWidgets('shows validation error when password is too short', (WidgetTester tester) async {
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

    testWidgets('calls SupabaseService when credentials are valid', (WidgetTester tester) async {
      // Setup mock to return successfully
      when(() => mockSupabaseService.signIn(any(), any())).thenAnswer((_) async => {});

      // Override the SupabaseService creation to use our mock
      await tester.pumpWidget(MaterialApp(
        home: LoginScreen(supabaseService: mockSupabaseService),
      ));

      // Enter valid credentials
      await tester.enterText(find.byType(TextField).at(0), 'test@example.com');
      await tester.enterText(find.byType(TextField).at(1), 'validpass');

      // Tap login button
      await tester.tap(find.text('Entrar'));
      await tester.pump();

      // Verify SupabaseService was called
      verify(() => mockSupabaseService.signIn('test@example.com', 'validpass')).called(1);
    });

    testWidgets('shows friendly error message for invalid credentials', (WidgetTester tester) async {
      // Setup mock to throw an exception that maps to "user-not-found"
      when(() => mockSupabaseService.signIn(any(), any())).thenThrow(
        Exception('[FirebaseAuth/user-not-found] There is no user record corresponding to this identifier.'),
      );

      await tester.pumpWidget(MaterialApp(
        home: LoginScreen(supabaseService: mockSupabaseService),
      ));

      // Enter valid credentials
      await tester.enterText(find.byType(TextField).at(0), 'test@example.com');
      await tester.enterText(find.byType(TextField).at(1), 'validpass');

      // Tap login button
      await tester.tap(find.text('Entrar'));
      await tester.pump();

      // Should show user-friendly error
      expect(find.textContaining('Usuário não encontrado'), findsOneWidget);
    });

    testWidgets('shows loading indicator during login attempt', (WidgetTester tester) async {
      // Setup mock to delay response
      when(() => mockSupabaseService.signIn(any(), any())).thenAnswer(
        (_) async => Future.delayed(const Duration(milliseconds: 100), () => {}),
      );

      await tester.pumpWidget(MaterialApp(
        home: LoginScreen(supabaseService: mockSupabaseService),
      ));

      // Enter valid credentials
      await tester.enterText(find.byType(TextField).at(0), 'test@example.com');
      await tester.enterText(find.byType(TextField).at(1), 'validpass');

      // Tap login button
      await tester.tap(find.text('Entrar'));
      await tester.pump(); // Pump once to start the async operation

      // Should show circular progress indicator
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // Advance time to let the async complete
      await tester.pump(const Duration(milliseconds: 100));
    });
  });
}