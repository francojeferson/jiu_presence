import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  SupabaseClient get client {
    try {
      return Supabase.instance.client;
    } catch (_) {
      // Retorna um cliente mock ou lança erro amigável para o demo
      throw Exception("Supabase não inicializado. Configure as chaves no main.dart.");
    }
  }

  Future<void> init(String url, String anonKey) async {
    await Supabase.initialize(
      url: url,
      anonKey: anonKey,
    );
  }

  // Auth
  Future<void> signIn(String email, String password) async {
    await client.auth.signInWithPassword(email: email, password: password);
  }

  Future<void> signOut() async {
    await client.auth.signOut();
  }

  // Alunos
  Future<List<dynamic>> getAlunos(String academiaId) async {
    final response = await client
        .from('aluno')
        .select()
        .eq('academia_id', academiaId);
    return response as List<dynamic>;
  }

  Future<void> registerAluno(Map<String, dynamic> alunoData) async {
    await client.from('aluno').insert(alunoData);
  }

  // Presenca
  Future<void> registerPresenca(String alunoId, String metodo) async {
    await client.from('presenca').insert({
      'aluno_id': alunoId,
      'metodo_registro': metodo,
    });
  }
}
