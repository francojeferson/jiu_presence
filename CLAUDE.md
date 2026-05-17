# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `flutter run` - Run the app on a connected device or emulator
- `flutter analyze` - Run static analysis (dart analyzer) to check for errors and warnings
- `flutter test` - Run all tests
- `flutter test test/login_screen_test.dart` - Run a specific test file
- `flutter pub get` - Get dependencies (run after pubspec.yaml changes)

### Building
- `flutter build apk` - Build Android APK
- `flutter build ios` - Build iOS app
- `flutter build web` - Build for web

### Code Quality
- `flutter format .` - Format Dart code according to flutter_lints rules
- `flutter pub outdated` - Check for outdated dependencies

## Project Structure

### Key Directories
- `lib/` - Main application code
  - `main.dart` - App entry point
  - `screens/` - UI screens (login_screen.dart, home_screen.dart, etc.)
  - `services/` - Service classes (supabase_service.dart for backend interactions)
- `test/` - Test files
  - `*_test.dart` - Unit and widget tests using flutter_test and mocktail
- `supabase/` - Supabase schema and configuration
- `web/` - Web-specific assets (favicon, manifest, index.html)
- `windows/` - Windows-specific build files

### Important Files
- `pubspec.yaml` - Project dependencies and Flutter configuration
- `analysis_options.yaml` - Dart analyzer configuration (includes flutter_lints)
- `README.md` - Project overview and getting started guide

## Architecture Overview

This Flutter application follows a simple structure:
1. **Entry Point**: `main.dart` initializes the app and sets the home to `LoginScreen`
2. **UI Layer**: Screens in `lib/screens/` use Material Design components
3. **Service Layer**: `lib/services/supabase_service.dart` handles backend interactions with Supabase
4. **State Management**: Currently uses StatefulWidget for state management in screens
5. **Testing**: Widget tests in `test/` verify UI behavior and service interactions

### Dependencies
- **Flutter SDK**: Core UI framework
- **supabase_flutter**: Backend-as-a-service for authentication and data storage
- **google_ml_kit**: Machine learning capabilities (likely for face detection)
- **tflite_flutter**: TensorFlow Lite integration
- **syncfusion_flutter_pdf**: PDF generation/manipulation
- **firebase_core & firebase_messaging**: Firebase services for app initialization and push notifications
- **path_provider**: Access to filesystem directories
- **image_picker & camera**: Media capture functionality
- **cpf_cnpj_validator**: Brazilian tax ID validation

### Testing Approach
- Uses `flutter_test` for widget testing
- Uses `mocktail` for mocking dependencies (see SupabaseService mock in login_screen_test.dart)
- Tests focus on validation, service calls, and UI state transitions

## Development Guidelines

1. **Code Formatting**: Run `flutter format .` before committing to ensure consistent code style
2. **Static Analysis**: Run `flutter analyze` frequently to catch lint errors early
3. **Testing**: Write tests for new features following the patterns in existing test files
4. **State Management**: Consider lifting state up or using provider pattern as the app grows
5. **Error Handling**: Follow existing patterns in login_screen.dart for handling service exceptions
6. **Assets**: Add new assets to pubspec.yaml under the flutter/assets section when needed

## Common Tasks

### Adding a New Screen
1. Create a new file in `lib/screens/` (e.g., `new_screen.dart`)
2. Implement a StatefulWidget or StatelessWidget
3. Add navigation to/from the screen in existing screens
4. Update tests if the screen contains interactive elements

### Adding a New Service
1. Create a new file in `lib/services/` (e.g., `new_service.dart`)
2. Implement methods for interacting with external APIs or backend services
3. Consider using dependency injection for testability
4. Add mock implementations for testing if needed

### Working with Supabase
1. The `SupabaseService` class in `lib/services/supabase_service.dart` encapsulates Supabase interactions
2. Follow existing patterns for authentication and data operations
3. Handle exceptions appropriately and map them to user-friendly messages