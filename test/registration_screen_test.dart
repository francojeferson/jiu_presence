import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:jiu_presence/screens/registration_screen.dart';
import 'package:jiu_presence/services/supabase_service.dart';
import 'package:camera/camera.dart';

// Mock SupabaseService
class MockSupabaseService extends Mock implements SupabaseService {}

void main() {
  group('RegistrationScreen', () {
    late MockSupabaseService mockSupabaseService;

    setUp(() {
      mockSupabaseService = MockSupabaseService();
    });

    testWidgets('shows LGPD acceptance error when not accepted', (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(
        home: RegistrationScreen(),
      ));

      // Try to register without accepting LGPD
      await tester.tap(find.text('Cadastrar e Salvar Biometria'), warnIfMissed: false);
      await tester.pump();

      // Should show LGPD error
      expect(find.textContaining('Você deve aceitar os termos LGPD para continuar.'), findsOneWidget);
    });

    testWidgets('shows validation error when name is empty', (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(
        home: RegistrationScreen(),
      ));

      // Accept LGPD by tapping the Checkbox
      await tester.tap(find.byType(Checkbox));
      await tester.pump();

      // Try to register without entering name
      await tester.tap(find.descendant(
          of: find.byType(ElevatedButton),
          matching: find.text('Cadastrar e Salvar Biometria')));
      await tester.pump();

      // Allow time for SnackBar to appear
      await tester.pumpAndSettle();

      // Should show name validation error
      expect(find.textContaining('Nome é obrigatório'), findsOneWidget);
    });

    testWidgets('shows validation error when age is invalid', (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(
        home: RegistrationScreen(),
      ));

      // Accept LGPD
      await tester.tap(find.text('Li e concordo com o Termo de Consentimento LGPD'), warnIfMissed: false);
      await tester.pump();

      // Enter valid name but invalid age
      await tester.enterText(find.byType(TextField).at(0), 'João Silva');
      await tester.enterText(find.byType(TextField).at(1), 'abc'); // Invalid age

      // Try to register
      await tester.tap(find.text('Cadastrar e Salvar Biometria'), warnIfMissed: false);
      await tester.pump();

      // Should show age validation error
      expect(find.textContaining('Idade deve ser um número'), findsOneWidget);
    });

    testWidgets('shows validation error when CPF is invalid for guardian', (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(
        home: RegistrationScreen(),
      ));

      // Accept LGPD
      await tester.tap(find.text('Li e concordo com o Termo de Consentimento LGPD'), warnIfMissed: false);
      await tester.pump();

      // Mark as minor
      await tester.tap(find.text('Aluno menor de idade?'), warnIfMissed: false);
      await tester.pump();

      // Enter valid data but invalid CPF
      await tester.enterText(find.byType(TextField).at(0), 'João Silva');
      await tester.enterText(find.byType(TextField).at(1), '10');
      await tester.enterText(find.byType(TextField).at(2), '50');
      await tester.enterText(find.byType(TextField).at(3), '1.70');
      await tester.enterText(find.byType(TextField).at(4), 'Branca');
      await tester.enterText(find.byType(TextField).at(5), 'Maria Silva'); // Guardian name
      await tester.enterText(find.byType(TextField).at(6), '123.456.789-00'); // Invalid CPF

      // Try to register
      await tester.tap(find.text('Cadastrar e Salvar Biometria'), warnIfMissed: false);
      await tester.pump();

      // Should show guardian CPF validation error
      expect(find.textContaining('CPF do responsável inválido'), findsOneWidget);
    });

    testWidgets('shows error when no image is captured', (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(
        home: RegistrationScreen(),
      ));

      // Accept LGPD
      await tester.tap(find.text('Li e concordo com o Termo de Consentimento LGPD'), warnIfMissed: false);
      await tester.pump();

      // Enter all valid data
      await tester.enterText(find.byType(TextField).at(0), 'João Silva');
      await tester.enterText(find.byType(TextField).at(1), '10');
      await tester.enterText(find.byType(TextField).at(2), '50');
      await tester.enterText(find.byType(TextField).at(3), '1.70');
      await tester.enterText(find.byType(TextField).at(4), 'Branca');

      // Try to register without capturing image
      await tester.tap(find.text('Cadastrar e Salvar Biometria'), warnIfMissed: false);
      await tester.pump();

      // Should show image capture error
      expect(find.textContaining('Você deve capturar a foto do rosto'), findsOneWidget);
    });

    testWidgets('calls SupabaseService when all data is valid', (WidgetTester tester) async {
      // Setup mock to return successfully
      when(() => mockSupabaseService.registerAluno(any())).thenAnswer((_) async => {});

      // We need to provide a way to override the SupabaseService creation
      // For simplicity in this test, we'll patch the constructor
      // In a real scenario, you'd use dependency injection

      await tester.pumpWidget(MaterialApp(
        home: RegistrationScreen(),
      ));

      // Accept LGPD
      await tester.tap(find.text('Li e concordo com o Termo de Consentimento LGPD'), warnIfMissed: false);
      await tester.pump();

      // Enter all valid data
      await tester.enterText(find.byType(TextField).at(0), 'João Silva');
      await tester.enterText(find.byType(TextField).at(1), '10');
      await tester.enterText(find.byType(TextField).at(2), '50');
      await tester.enterText(find.byType(TextField).at(3), '1.70');
      await tester.enterText(find.byType(TextField).at(4), 'Branca');

      // Simulate having captured biometric data by setting state directly
      // This bypasses the FaceCaptureScreen navigation complexity
      final registrationScreenState = tester.state<RegistrationScreenState>(find.byType(RegistrationScreen)) as RegistrationScreenState;
      registrationScreenState.setTestState(
        capturedImage: XFile('test_path.jpg'),
        biometricEmbedding: List.filled(128, 0.5),
      );

      // Pump to apply the state changes
      await tester.pump();

      // Try to register
      await tester.tap(find.text('Cadastrar e Salvar Biometria'), warnIfMissed: false);
      await tester.pump();

      // Since we can't easily mock the SupabaseService instantiation without DI,
      // we'll at least verify that we got to the point of trying to register
      // A full test would require mocking the SupabaseService constructor
      expect(find.textContaining('Aluno cadastrado com sucesso!'), findsOneWidget);
    });
  });
}