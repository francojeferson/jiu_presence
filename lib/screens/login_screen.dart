import 'package:flutter/material.dart';
import 'registration_screen.dart';
import 'home_screen.dart';
import '../services/supabase_service.dart';

class LoginScreen extends StatefulWidget {
  final SupabaseService? supabaseService;

  const LoginScreen({super.key, this.supabaseService});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  late final _supabaseService;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _supabaseService = widget.supabaseService ?? SupabaseService();
  }

  // Simple email validation regex
  static final RegExp _emailRegex = RegExp(
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

  String? _validatePassword(String password) {
    if (password.isEmpty) {
      return 'Senha é obrigatória';
    }
    if (password.length < 6) {
      return 'Senha deve ter pelo menos 6 caracteres';
    }
    return null;
  }

  void _login() async {
    // Client-side validation
    final emailError = _validateEmail(_emailController.text);
    final passwordError = _validatePassword(_passwordController.text);

    if (emailError != null || passwordError != null) {
      String errorMessage = '';
      if (emailError != null) errorMessage += emailError;
      if (passwordError != null) {
        if (errorMessage.isNotEmpty) errorMessage += '\n';
        errorMessage += passwordError;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(errorMessage)),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      await _supabaseService.signIn(
        _emailController.text,
        _passwordController.text,
      );
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const HomeScreen()),
      );
    } catch (e) {
      // Map Supabase errors to user-friendly messages
      String userFriendlyMessage;
      final errorString = e.toString();

      if (errorString.contains('invalid-email')) {
        userFriendlyMessage = 'Email inválido';
      } else if (errorString.contains('user-not-found')) {
        userFriendlyMessage = 'Usuário não encontrado';
      } else if (errorString.contains('wrong-password')) {
        userFriendlyMessage = 'Senha incorreta';
      } else if (errorString.contains('network')) {
        userFriendlyMessage = 'Erro de conexão. Verifique sua internet';
      } else if (errorString.contains('too-many-requests')) {
        userFriendlyMessage = 'Muitas tentativas. Tente novamente em alguns minutos';
      } else {
        // Generic message for unexpected errors (don't expose internal details)
        userFriendlyMessage = 'Erro ao fazer login. Tente novamente';
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(userFriendlyMessage)),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('JiuPresence - Login')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: _emailController,
              decoration: const InputDecoration(
                labelText: 'Email',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.email),
              ),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _passwordController,
              decoration: const InputDecoration(
                labelText: 'Senha',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.lock),
              ),
              obscureText: true,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _login,
                child: _isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Entrar'),
              ),
            ),
            TextButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const RegistrationScreen()),
                );
              },
              child: const Text('Cadastrar novo aluno'),
            ),
          ],
        ),
      ),
    );
  }
}
