/// FS #203 W2: typed exception hierarchy for the yoga session adapter.
///
/// Pre-fix, the adapter threw [StateError] with a freeform message and the
/// launcher's `_friendlyYogaError` translated it to user copy via substring
/// matching (`msg.contains('hydrat')` etc.). Fragile: any wording tweak
/// silently broke the friendly copy.
///
/// Post-fix, the adapter throws one of two sealed subclasses:
///
/// * [YogaContractException] — engine output violates the session-shape
///   contract (wrong session_shape, missing focus_slug, unknown phase
///   token, non-positive duration, etc.). This is a server/engine bug
///   from the client's perspective.
/// * [YogaHydrationException] — the engine output is shape-correct, but
///   the hydration step (POST /api/yoga/poses-by-ids) returned incomplete
///   data — a pose id is missing from the lookup map. This is a network/
///   data-integrity issue, not a contract violation.
///
/// The launcher switches on type, not text. Engine wording can drift; the
/// user-facing copy stays stable.
sealed class YogaSessionException implements Exception {
  final String message;

  /// Original error this exception wraps (when applicable). Preserved so
  /// crash reporters / debug logs can see the underlying transport or
  /// parse failure rather than only the friendly wrapper. Commit 2.1 CR-1.
  final Object? cause;
  final StackTrace? stackTrace;

  YogaSessionException(this.message, {this.cause, this.stackTrace});

  /// User-facing snackbar copy. Overridden by each subtype with the
  /// situation-appropriate string.
  String get userMessage;

  @override
  String toString() {
    final base = '$runtimeType: $message';
    return cause == null ? base : '$base (cause: $cause)';
  }
}

class YogaContractException extends YogaSessionException {
  YogaContractException(super.message, {super.cause, super.stackTrace});

  @override
  String get userMessage =>
      'Could not start session — try picking a focus again.';
}

class YogaHydrationException extends YogaSessionException {
  YogaHydrationException(super.message, {super.cause, super.stackTrace});

  /// Commit 3 W-2.1.1: dropped "tap to retry" — the launcher's catch
  /// handler shows this in a plain SnackBar with no SnackBarAction, so the
  /// prior copy promised an affordance that didn't exist. Locked down by
  /// regression test in
  /// `app/test/adapters/yoga_session_adapter_test.dart`.
  @override
  String get userMessage => "Couldn't load today's yoga. Please try again.";
}
