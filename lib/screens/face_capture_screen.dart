import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import '../ml/face_net_service.dart';

class FaceCaptureScreen extends StatefulWidget {
  final Function(List<double> embedding, XFile image) onCapture;

  const FaceCaptureScreen({super.key, required this.onCapture});

  @override
  State<FaceCaptureScreen> createState() => _FaceCaptureScreenState();
}

class _FaceCaptureScreenState extends State<FaceCaptureScreen> {
  CameraController? _controller;
  late FaceNetService _faceNetService;
  bool _isProcessing = false;
  String _message = "Posicione o rosto no centro";

  @override
  void initState() {
    super.initState();
    _faceNetService = FaceNetService();
    _initializeCamera();
  }

  Future<void> _initializeCamera() async {
    final cameras = await availableCameras();
    final front = cameras.firstWhere((c) => c.lensDirection == CameraLensDirection.front);
    _controller = CameraController(front, ResolutionPreset.medium, enableAudio: false);
    await _controller!.initialize();
    if (mounted) setState(() {});
  }

  Future<void> _capture() async {
    if (_isProcessing || _controller == null || !_controller!.value.isInitialized) return;

    setState(() {
      _isProcessing = true;
      _message = "Processando biometria...";
    });

    try {
      final image = await _controller!.takePicture();
      final inputImage = InputImage.fromFilePath(image.path);
      
      final faces = await _faceNetService.detectFaces(inputImage);

      if (faces.isEmpty) {
        setState(() {
          _isProcessing = false;
          _message = "Nenhum rosto detectado. Tente novamente.";
        });
        return;
      }

      // Pega o primeiro rosto detectado
      final embedding = await _faceNetService.getEmbedding(image, faces.first);
      
      widget.onCapture(embedding, image);
      if (mounted) Navigator.pop(context);

    } catch (e) {
      setState(() {
        _isProcessing = false;
        _message = "Erro ao capturar: $e";
      });
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    _faceNetService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_controller == null || !_controller!.value.isInitialized) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Captura Biométrica')),
      body: Stack(
        children: [
          CameraPreview(_controller!),
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              padding: const EdgeInsets.all(24),
              color: Colors.black54,
              width: double.infinity,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_message, style: const TextStyle(color: Colors.white, fontSize: 16)),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _isProcessing ? null : _capture,
                    style: ElevatedButton.styleFrom(
                      shape: const CircleBorder(),
                      padding: const EdgeInsets.all(20),
                    ),
                    child: _isProcessing 
                      ? const CircularProgressIndicator()
                      : const Icon(Icons.camera_alt, size: 32),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
