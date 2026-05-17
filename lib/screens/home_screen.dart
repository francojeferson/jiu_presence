import 'package:flutter/material.dart';
import 'face_capture_screen.dart';
import '../services/supabase_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _supabaseService = SupabaseService();
  bool _isProcessing = false;
  List<dynamic> _alunos = [];

  @override
  void initState() {
    super.initState();
    _loadAlunos();
  }

  Future<void> _loadAlunos() async {
    try {
      // In a real app, you would get the academy ID from user context
      final alunos = await _supabaseService.getAlunos('your-academia-id');
      if (mounted) {
        setState(() {
          _alunos = alunos;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao carregar alunos: $e')),
        );
      }
    }
  }

  Future<void> _registrarPresencaComCamera() async {
    if (_isProcessing) return;

    setState(() => _isProcessing = true);
    try {
      final result = await Navigator.of(context).push<Map<String, dynamic>>(
        MaterialPageRoute(
          builder: (context) => FaceCaptureScreen(
            onCapture: (embedding, image) async {
              // Here you would implement face matching logic
              // For now, we'll just return the embedding for demonstration
              return {
                'embedding': embedding,
                'image': image,
              };
            },
          ),
        ),
      );

      if (result != null && mounted) {
        // In a real implementation, you would:
        // 1. Compare the embedding with stored student embeddings
        // 2. Find the best match
        // 3. Register presence for that student

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Presença registrada com sucesso!')),
        );

        // Reload the list to show updated presence
        await _loadAlunos();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao registrar presença: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard - Turma Atual'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              Navigator.pushReplacementNamed(context, '/'); // Volta pro login
            },
          )
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            ElevatedButton.icon(
              onPressed: _isProcessing ? null : _registrarPresencaComCamera,
              icon: const Icon(Icons.group),
              label: const Text('Registrar Presença da Turma (Câmera)'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 60),
                textStyle: const TextStyle(fontSize: 18),
              ),
            ),
            const SizedBox(height: 24),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text('Alunos Presentes Hoje', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ),
            Expanded(
              child: _alunos.isEmpty
                  ? const Center(child: Text('Nenhum aluno encontrado'))
                  : ListView.builder(
                      itemCount: _alunos.length,
                      itemBuilder: (context, index) {
                        final aluno = _alunos[index];
                        return ListTile(
                          leading: CircleAvatar(
                            child: Text('${aluno['name']?.substring(0, 1) ?? 'A'}'),
                          ),
                          title: Text(aluno['name'] ?? 'Aluno sem nome'),
                          subtitle: Text('Faixa: ${aluno['belt'] ?? 'Não informada'}'),
                          trailing: const Icon(Icons.check_circle, color: Colors.green),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        tooltip: 'Gerar Relatório PDF',
        onPressed: _isProcessing ? null : () {
          // TODO: Implement PDF report generation
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Gerando relatório PDF...')),
          );
        },
        child: const Icon(Icons.picture_as_pdf),
      ),
    );
  }
}
