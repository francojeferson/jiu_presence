import 'package:flutter_test/flutter_test.dart';
import 'package:cpf_cnpj_validator/cpf_validator.dart';

void main() {
  group('CPF Validation', () {
    test('CPF validation works correctly', () {
      // Valid CPFs
      expect(CPFValidator.isValid('529.982.247-25'), isTrue);
      expect(CPFValidator.isValid('52998224725'), isTrue);

      // Invalid CPFs
      expect(CPFValidator.isValid('111.111.111-11'), isFalse);
      expect(CPFValidator.isValid('000.000.000-00'), isFalse);
      expect(CPFValidator.isValid('123.456.789-00'), isFalse);
      expect(CPFValidator.isValid(''), isFalse);
      expect(CPFValidator.isValid(null), isFalse);
    });
  });

  group('Email Validation', () {
    // Simple email validation regex - same as used in LoginScreen
    final RegExp _emailRegex = RegExp(
      r'^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$',
    );

    String? _validateEmail(String email) {
      if (email.isEmpty) {
        return 'Email é obrigatório';
      }
      if (!_emailRegex.hasMatch(email)) {
        return 'Email inválido';
      }
      return null;
    }

    test('validateEmail returns error for empty email', () {
      expect(_validateEmail(''), equals('Email é obrigatório'));
    });

    test('validateEmail returns error for invalid email', () {
      expect(_validateEmail('invalid'), equals('Email inválido'));
      expect(_validateEmail('test@'), equals('Email inválido'));
      expect(_validateEmail('@test.com'), equals('Email inválido'));
    });

    test('validateEmail returns null for valid email', () {
      expect(_validateEmail('test@example.com'), isNull);
      expect(_validateEmail('user.name@domain.co.br'), isNull);
    });
  });

  group('Password Validation', () {
    String? _validatePassword(String password) {
      if (password.isEmpty) {
        return 'Senha é obrigatória';
      }
      if (password.length < 6) {
        return 'Senha deve ter pelo menos 6 caracteres';
      }
      return null;
    }

    test('validatePassword returns error for empty password', () {
      expect(_validatePassword(''), equals('Senha é obrigatória'));
    });

    test('validatePassword returns error for too short password', () {
      expect(_validatePassword('123'), equals('Senha deve ter pelo menos 6 caracteres'));
      expect(_validatePassword('12345'), equals('Senha deve ter pelo menos 6 caracteres'));
    });

    test('validatePassword returns null for valid password', () {
      expect(_validatePassword('123456'), isNull);
      expect(_validatePassword('senha123'), isNull);
    });
  });
}