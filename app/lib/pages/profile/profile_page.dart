import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/profile_provider.dart';
import '../../widgets/profile/unit_toggle.dart';
import '../../widgets/calendar/workout_calendar.dart';
import '../../widgets/profile/profile_menu_card.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  bool _isUpdatingUnit = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProfileProvider>().fetchProfile();
    });
  }

  Future<void> _handleUnitChange(String newUnit) async {
    setState(() => _isUpdatingUnit = true);

    final success =
        await context.read<ProfileProvider>().updateUnitSystem(newUnit);

    setState(() => _isUpdatingUnit = false);

    if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to update unit system'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _handleLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBackground,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Log Out',
          style: TextStyle(color: AppColors.primaryText),
        ),
        content: const Text(
          'Are you sure you want to log out?',
          style: TextStyle(color: AppColors.secondaryText),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ctx.read<AuthProvider>().logout();
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Log Out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Consumer<ProfileProvider>(
          builder: (context, profileProvider, _) {
            if (profileProvider.isLoading && profileProvider.profile == null) {
              return const Center(
                child: CircularProgressIndicator(color: AppColors.gold),
              );
            }

            return RefreshIndicator(
              onRefresh: () => profileProvider.fetchProfile(force: true),
              color: AppColors.gold,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header
                    const Text(
                      'Profile',
                      style: TextStyle(
                        color: AppColors.primaryText,
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Error banner
                    if (profileProvider.error != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: AppColors.error.withValues(alpha: 0.3)),
                        ),
                        child: const Row(
                          children: [
                            Icon(LucideIcons.alertCircle,
                                color: AppColors.error, size: 18),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Failed to load profile. Pull down to retry.',
                                style: TextStyle(
                                    color: AppColors.error, fontSize: 13),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // User Info Card
                    _buildUserInfoCard(profileProvider),
                    const SizedBox(height: 20),

                    // Unit System Section
                    _buildSectionHeader('Units'),
                    const SizedBox(height: 12),
                    Center(
                      child: UnitToggle(
                        currentUnit: profileProvider.unitSystem,
                        onChanged: _handleUnitChange,
                        isLoading: _isUpdatingUnit,
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Activity Section
                    _buildSectionHeader('Activity'),
                    const SizedBox(height: 12),

                    // Workout Calendar
                    const WorkoutCalendar(),
                    const SizedBox(height: 20),

                    // Exercise History
                    ProfileMenuCard(
                      icon: LucideIcons.barChart3,
                      title: 'Exercise History',
                      subtitle: 'Track your progress over time',
                      iconColor: AppColors.breathwork,
                      onTap: () => context.push('/exercise-history'),
                    ),
                    const SizedBox(height: 12),

                    // Body Measurements
                    ProfileMenuCard(
                      icon: LucideIcons.ruler,
                      title: 'Body Measurements',
                      subtitle: 'Weight, body fat & more',
                      iconColor: AppColors.yoga,
                      onTap: () => context.push('/body-measurements'),
                    ),
                    const SizedBox(height: 12),

                    // TODO(S10-T5a): remove after spike — dev entry to 3D body map spike
                    ProfileMenuCard(
                      icon: LucideIcons.box,
                      title: '[spike] 3D Body Map',
                      subtitle: 'Step 0 verification — remove before commit',
                      iconColor: AppColors.breathwork,
                      onTap: () => context.push('/spike/body-map'),
                    ),
                    const SizedBox(height: 32),

                    // Logout Button
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _handleLogout,
                        icon: const Icon(LucideIcons.logOut, size: 18),
                        label: const Text('Log Out'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red.shade400,
                          side: BorderSide(
                              color: Colors.red.shade400
                                  .withValues(alpha: 0.5)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 100),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildUserInfoCard(ProfileProvider provider) {
    final authProvider = context.read<AuthProvider>();
    final name = provider.userName.isNotEmpty
        ? provider.userName
        : authProvider.user?['name'] ?? 'User';
    final email = provider.userEmail.isNotEmpty
        ? provider.userEmail
        : authProvider.user?['email'] ?? '';

    final initials = name.isNotEmpty
        ? name
            .split(' ')
            .map((w) => w.isNotEmpty ? w[0] : '')
            .take(2)
            .join()
            .toUpperCase()
        : 'U';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.gold,
                  AppColors.gold.withValues(alpha: 0.7),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(
              child: Text(
                initials,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  email,
                  style: const TextStyle(
                    color: AppColors.hintText,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: const TextStyle(
        color: AppColors.secondaryText,
        fontSize: 13,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
      ),
    );
  }
}
