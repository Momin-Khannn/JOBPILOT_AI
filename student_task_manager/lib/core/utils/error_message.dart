import 'package:supabase_flutter/supabase_flutter.dart';

/// Converts technical exceptions into short messages students can understand.
String friendlyErrorMessage(Object error) {
  if (error is AuthException) {
    return error.message;
  }
  if (error is PostgrestException) {
    return 'The database request failed. Please try again.';
  }
  return 'Something went wrong. Check your connection and try again.';
}
