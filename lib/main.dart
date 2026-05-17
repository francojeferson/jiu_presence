import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'screens/login_screen.dart';
import 'services/supabase_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: 'https://your-project-id.supabase.co',
    anonKey: 'your-anon-key',
  );
  runApp(const JiuPresenceApp());
}

class JiuPresenceApp extends StatelessWidget {
  const JiuPresenceApp({super.key});

  @override
  Widget build(BuildContext context) {
    final supabaseService = SupabaseService();
    return MaterialApp(
      title: 'Jiu Presence',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: LoginScreen(supabaseService: supabaseService),
    );
  }
}

