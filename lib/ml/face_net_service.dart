import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

class FaceNetService {
  FaceDetector? _faceDetector;

  FaceNetService() {
    if (!kIsWeb) {
      _faceDetector = FaceDetector(
        options: FaceDetectorOptions(
          enableContours: true,
          enableClassification: true,
          performanceMode: FaceDetectorMode.accurate,
        ),
      );
    }
  }

  Future<void> initialize() async {
    // Aqui carregaríamos o .tflite via tflite_flutter se o arquivo existisse
    // Debug print removed for production
  }

  /// Detecta rostos em uma imagem usando Google ML Kit
  Future<List<Face>> detectFaces(InputImage inputImage) async {
    if (kIsWeb) {
      // No Web, o ML Kit Nativo não funciona via canal de método.
      // Retornamos um rosto mockado para permitir o teste da UI.
      return [
        Face(
          boundingBox: Rect.fromLTWH(0, 0, 100, 100),
          landmarks: {},
          contours: {},
        )
      ];
    }
    return await _faceDetector!.processImage(inputImage);
  }

  /// Gera embedding fake de 128 dimensões.
  /// No ambiente real, aqui faríamos o pré-processamento da imagem
  /// e passaríamos pelo interpretador do FaceNet.
  Future<List<double>> getEmbedding(XFile imageFile, Face face) async {
    // Simulação de processamento pesado
    await Future.delayed(const Duration(milliseconds: 100));
    return List.generate(128, (index) => Random().nextDouble());
  }

  /// Compara dois embeddings usando Similaridade do Cosseno
  double compare(List<double> emb1, List<double> emb2) {
    if (emb1.length != emb2.length) return 0.0;
    double dot = 0.0;
    double normA = 0.0;
    double normB = 0.0;
    for (int i = 0; i < emb1.length; i++) {
        dot += emb1[i] * emb2[i];
        normA += emb1[i] * emb1[i];
        normB += emb2[i] * emb2[i];
    }
    return dot / (sqrt(normA) * sqrt(normB));
  }

  void dispose() {
    if (!kIsWeb) {
      _faceDetector?.close();
    }
  }
}
