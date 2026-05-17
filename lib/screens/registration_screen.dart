import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:cpf_cnpj_validator/cpf_validator.dart';
import 'face_capture_screen.dart';
import '../services/supabase_service.dart';

class RegistrationScreen extends StatefulWidget {
  const RegistrationScreen({super.key});

  @override
  State<RegistrationScreen> createState() => RegistrationScreenState();
}

class RegistrationScreenState extends State<RegistrationScreen> {
  final _nameController = TextEditingController();
  final _ageController = TextEditingController();
  final _weightController = TextEditingController();
  final _heightController = TextEditingController();
  final _beltController = TextEditingController();
  
  XFile? _capturedImage;
  List<double>? _biometricEmbedding;

  bool _lgpdAccepted = false;
  bool _isMinor = false;
  final _guardianNameController = TextEditingController();
  final _guardianCpfController = TextEditingController();

  bool _isRegistering = false;

  String? _validateName(String name) {
    if (name.isEmpty) {
      return 'Nome é obrigatório';
    }
    if (name.length < 3) {
      return 'Nome deve ter pelo menos 3 caracteres';
    }
    return null;
  }

  String? _validateAge(String age) {
    if (age.isEmpty) {
      return 'Idade é obrigatória';
    }
    final ageInt = int.tryParse(age);
    if (ageInt == null) {
      return 'Idade deve ser um número';
    }
    if (ageInt < 1 || ageInt > 120) {
      return 'Idade deve estar entre 1 e 120';
    }
    return null;
  }

  String? _validateWeight(String weight) {
    if (weight.isEmpty) {
      return 'Peso é obrigatório';
    }
    final weightDouble = double.tryParse(weight);
    if (weightDouble == null) {
      return 'Peso deve ser um número';
    }
    if (weightDouble <= 0 || weightDouble > 500) {
      return 'Peso deve estar entre 0.1 e 500 kg';
    }
    return null;
  }

  String? _validateHeight(String height) {
    if (height.isEmpty) {
      return 'Altura é obrigatória';
    }
    final heightDouble = double.tryParse(height);
    if (heightDouble == null) {
      return 'Altura deve ser um número';
    }
    if (heightDouble <= 0 || heightDouble > 3.0) {
      return 'Altura deve estar entre 0.1 e 3.0 metros';
    }
    return null;
  }

  String? _validateBelt(String belt) {
    if (belt.isEmpty) {
      return 'Cor da faixa é obrigatória';
    }
    return null;
  }

  String? _validateGuardianFields() {
    if (!_isMinor) return null;

    final guardianName = _guardianNameController.text;
    final guardianCpf = _guardianCpfController.text;

    if (guardianName.isEmpty) {
      return 'Nome do responsável é obrigatório';
    }
    if (guardianName.length < 3) {
      return 'Nome do responsável deve ter pelo menos 3 caracteres';
    }

    if (guardianCpf.isEmpty) {
      return 'CPF do responsável é obrigatório';
    }
    if (!CPFValidator.isValid(guardianCpf)) {
      return 'CPF do responsável inválido';
    }

    return null;
  }

  void _register() async {
    // Validate LGPD acceptance first
    if (!_lgpdAccepted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Você deve aceitar os termos LGPD para continuar.')),
      );
      return;
    }

    // Validate all fields
    final nameError = _validateName(_nameController.text);
    final ageError = _validateAge(_ageController.text);
    final weightError = _validateWeight(_weightController.text);
    final heightError = _validateHeight(_heightController.text);
    final beltError = _validateBelt(_beltController.text);
    final guardianError = _validateGuardianFields();

    // Check if biometric data was captured
    if (_capturedImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Você deve capturar a foto do rosto')),
      );
      return;
    }

    if (_biometricEmbedding == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Você deve completar a captura facial')),
      );
      return;
    }

    // Show validation errors if any
    final errors = [
      nameError,
      ageError,
      weightError,
      heightError,
      beltError,
      guardianError,
    ].where((e) => e != null).toList();

    if (errors.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(errors.join('\n'))),
      );
      return;
    }

    setState(() => _isRegistering = true);

    try {
      // Prepare student data
      final studentData = {
        'name': _nameController.text.trim(),
        'age': int.parse(_ageController.text),
        'weight': double.parse(_weightController.text),
        'height': double.parse(_heightController.text),
        'belt': _beltController.text.trim(),
        'lgpd_accepted': true,
        'biometric_embedding': _biometricEmbedding,
        'photo_path': _capturedImage?.path,
        'created_at': DateTime.now().toIso8601String(),
      };

      // Add guardian data if minor
      if (_isMinor) {
        studentData.addAll({
          'guardian_name': _guardianNameController.text.trim(),
          'guardian_cpf': _guardianCpfController.text,
        });
      }

      // Register student via Supabase
      await SupabaseService().registerAluno(studentData);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Aluno cadastrado com sucesso!')),
      );

      // Clear form after successful registration
      _nameController.clear();
      _ageController.clear();
      _weightController.clear();
      _heightController.clear();
      _beltController.clear();
      _guardianNameController.clear();
      _guardianCpfController.clear();
      setState(() {
        _capturedImage = null;
        _biometricEmbedding = null;
        _isMinor = false;
        _lgpdAccepted = false;
      });

      // Return to previous screen
      Navigator.pop(context);

    } catch (e) {
      if (!mounted) return;

      // Map Supabase errors to user-friendly messages
      String userFriendlyMessage;
      final errorString = e.toString();

      if (errorString.contains('duplicate key') ||
          errorString.contains('unique constraint') ||
          errorString.contains('already exists')) {
        userFriendlyMessage = 'Já existe um aluno com estes dados';
      } else if (errorString.contains('network')) {
        userFriendlyMessage = 'Erro de conexão. Verifique sua internet';
      } else if (errorString.contains('invalid')) {
        userFriendlyMessage = 'Dados inválidos fornecidos';
      } else {
        userFriendlyMessage = 'Erro ao cadastrar aluno. Tente novamente';
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(userFriendlyMessage)),
      );
    } finally {
      if (mounted) setState(() => _isRegistering = false);
    }
  }

  void _showLGPDBottomSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(16.0),
          height: MediaQuery.of(context).size.height * 0.8,
          child: Column(
            children: [
              const Text('Termo de Consentimento - LGPD', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              Expanded(
                child: SingleChildScrollView(
                  child: Text(
                    '''TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS SENSÍVEIS (Lei nº 13.709/2018)

DECLARO que li e compreendi integralmente a Política de Privacidade e CONSINTO com o tratamento dos meus dados (ou do menor sob minha responsabilidade) para:

- Reconhecimento facial automático de presença.
- Relatórios de frequência e graduação.
- Armazenamento da foto e do embedding biométrico.

Os dados são tratados no Brasil com criptografia forte e mantidos até 1 ano após inatividade.

Direitos: Acesso, correção, exclusão e revogação a qualquer momento.

Assinatura digital ocorre ao aceitar no app.''',
                  ),
                ),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Fechar'),
              )
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cadastro de Aluno')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            GestureDetector(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => FaceCaptureScreen(
                      onCapture: (embedding, image) {
                        setState(() {
                          _biometricEmbedding = embedding;
                          _capturedImage = image;
                        });
                      },
                    ),
                  ),
                );
              },
              child: Container(
                height: 150,
                width: 150,
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: BorderRadius.circular(75),
                  border: Border.all(color: Colors.deepPurple, width: 2),
                  image: _capturedImage != null 
                    ? DecorationImage(
                        image: kIsWeb 
                          ? NetworkImage(_capturedImage!.path) 
                          : FileImage(File(_capturedImage!.path)) as ImageProvider,
                        fit: BoxFit.cover,
                      )
                    : null,
                ),
                child: _capturedImage == null 
                  ? const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.face, size: 50, color: Colors.deepPurple),
                        Text('Capturar Face', style: TextStyle(fontSize: 12)),
                      ],
                    )
                  : null,
              ),
            ),
            const SizedBox(height: 16),
            TextField(controller: _nameController, decoration: const InputDecoration(labelText: 'Nome Completo')),
            Row(
              children: [
                Expanded(child: TextField(controller: _ageController, decoration: const InputDecoration(labelText: 'Idade'), keyboardType: TextInputType.number)),
                const SizedBox(width: 8),
                Expanded(child: TextField(controller: _weightController, decoration: const InputDecoration(labelText: 'Peso'), keyboardType: TextInputType.number)),
                const SizedBox(width: 8),
                Expanded(child: TextField(controller: _heightController, decoration: const InputDecoration(labelText: 'Altura'), keyboardType: TextInputType.number)),
              ],
            ),
            TextField(controller: _beltController, decoration: const InputDecoration(labelText: 'Cor da Faixa')),
            
            SwitchListTile(
              title: const Text('Aluno menor de idade?'),
              value: _isMinor,
              onChanged: (val) => setState(() => _isMinor = val),
            ),
            if (_isMinor) ...[
              TextField(controller: _guardianNameController, decoration: const InputDecoration(labelText: 'Nome do Responsável')),
              TextField(controller: _guardianCpfController, decoration: const InputDecoration(labelText: 'CPF do Responsável')),
            ],

            const Divider(height: 32),
            Row(
              children: [
                Checkbox(
                  value: _lgpdAccepted,
                  onChanged: (val) => setState(() => _lgpdAccepted = val ?? false),
                ),
                Expanded(
                  child: InkWell(
                    onTap: _showLGPDBottomSheet,
                    child: const Text(
                      'Li e concordo com o Termo de Consentimento LGPD',
                      style: TextStyle(color: Colors.blue, decoration: TextDecoration.underline),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isRegistering ? null : _register,
                child: _isRegistering
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Cadastrar e Salvar Biometria'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _ageController.dispose();
    _weightController.dispose();
    _heightController.dispose();
    _beltController.dispose();
    _guardianNameController.dispose();
    _guardianCpfController.dispose();
    super.dispose();
  }

  // For testing purposes
  void setTestState({XFile? capturedImage, List<double>? biometricEmbedding}) {
    _capturedImage = capturedImage;
    _biometricEmbedding = biometricEmbedding;
    if (mounted) setState(() {});
  }
}
