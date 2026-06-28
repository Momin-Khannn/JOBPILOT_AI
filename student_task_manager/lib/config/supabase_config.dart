/// Values used to connect the Flutter app to Supabase.
///
/// They are supplied at run time with `--dart-define`. This avoids placing a
/// real project URL or key directly in source control.
class SupabaseConfig {
  static const String url = String.fromEnvironment('SUPABASE_URL');
  static const String anonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  static bool get isConfigured => url.isNotEmpty && anonKey.isNotEmpty;
}
