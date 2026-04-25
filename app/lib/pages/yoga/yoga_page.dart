import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/yoga_provider.dart';
import '../../providers/yoga_session_provider.dart';
import '../../widgets/yoga/practice_type_selector.dart';
import '../../widgets/yoga/level_selector.dart';
import '../../widgets/yoga/duration_selector.dart';
import '../../widgets/yoga/focus_chips.dart';
import '../../widgets/yoga/recent_sessions.dart';
import '../../widgets/yoga/yoga_start_button.dart';
import '../../widgets/yoga/pose_preview_modal.dart';

class YogaPage extends StatefulWidget {
  const YogaPage({super.key});

  @override
  State<YogaPage> createState() => _YogaPageState();
}

class _YogaPageState extends State<YogaPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final p = context.read<YogaProvider>();
      p.loadConfig();
      if (p.recentSessions.isEmpty && !p.isLoadingRecent) {
        p.loadRecentSessions();
      }
    });
  }

  void _handleStart() {
    context.read<YogaProvider>().generateSession();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Consumer<YogaProvider>(
          builder: (context, provider, _) {
            return Stack(
              children: [
                // Main scrollable content
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 16, 16, 18),
                      child: Text(
                        'Yoga',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                    if (provider.error != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                        child: _ErrorBanner(
                          message: provider.error!,
                          onDismiss: provider.clearError,
                        ),
                      ),
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            PracticeTypeSelector(
                              selected: provider.config.type,
                              onSelect: provider.setType,
                            ),
                            const SizedBox(height: 20),
                            LevelSelector(
                              selected: provider.config.level,
                              onSelect: provider.setLevel,
                            ),
                            const SizedBox(height: 20),
                            DurationSelector(
                              selected: provider.config.duration,
                              onSelect: provider.setDuration,
                            ),
                            const SizedBox(height: 20),
                            FocusChips(
                              selected: provider.config.focus,
                              onToggle: provider.toggleFocus,
                            ),
                            const SizedBox(height: 16),
                            RecentSessions(
                              sessions: provider.recentSessions,
                              onLoad: provider.loadFromRecent,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),

                // Floating start button
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: YogaStartButton(
                    config: provider.config,
                    isGenerating: provider.isGenerating,
                    onStart: _handleStart,
                  ),
                ),

                // Pose preview modal
                if (provider.generatedSession != null)
                  Positioned.fill(
                    child: PosePreviewModal(
                      session: provider.generatedSession!,
                      config: provider.config,
                      isGenerating: provider.isGenerating,
                      onRegenerate: _handleStart,
                      onBegin: () {
                        final session = provider.generatedSession!;
                        context.read<YogaSessionProvider>().startSession(session);
                        context.go('/yoga/session');
                      },
                      onClose: provider.clearSession,
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;
  final VoidCallback onDismiss;
  const _ErrorBanner({required this.message, required this.onDismiss});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: Color(0xFFFCA5A5),
                fontSize: 12,
              ),
            ),
          ),
          GestureDetector(
            onTap: onDismiss,
            child: Icon(
              Icons.close,
              size: 14,
              color: Colors.white.withValues(alpha: 0.4),
            ),
          ),
        ],
      ),
    );
  }
}
