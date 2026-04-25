import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:go_router/go_router.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../config/theme.dart';
import '../../providers/progress_provider.dart';

class ExerciseProgressPage extends StatefulWidget {
  final int exerciseId;
  final String type;

  const ExerciseProgressPage({
    super.key,
    required this.exerciseId,
    required this.type,
  });

  @override
  State<ExerciseProgressPage> createState() => _ExerciseProgressPageState();
}

class _ExerciseProgressPageState extends State<ExerciseProgressPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProgressProvider>().fetchExerciseDetail(
            widget.exerciseId,
            widget.type,
          );
    });
  }

  @override
  void dispose() {
    context.read<ProgressProvider>().clearDetail();
    super.dispose();
  }

  void _onRangeChanged(String range) {
    context.read<ProgressProvider>().fetchExerciseDetail(
          widget.exerciseId,
          widget.type,
          range: range,
        );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, color: AppColors.primaryText),
          onPressed: () => context.pop(),
        ),
        title: Consumer<ProgressProvider>(
          builder: (context, provider, _) {
            final name =
                provider.exerciseDetail?['exercise']?['name'] ?? 'Loading...';
            return Text(
              name,
              style: const TextStyle(
                color: AppColors.primaryText,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
              overflow: TextOverflow.ellipsis,
            );
          },
        ),
      ),
      body: Consumer<ProgressProvider>(
        builder: (context, provider, _) {
          if (provider.isLoadingDetail && provider.exerciseDetail == null) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            );
          }

          if (provider.detailError != null && provider.exerciseDetail == null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.alertCircle,
                      color: Colors.red.shade400, size: 48),
                  const SizedBox(height: 16),
                  Text(
                    'Failed to load progress',
                    style: TextStyle(color: Colors.red.shade400),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.fetchExerciseDetail(
                      widget.exerciseId,
                      widget.type,
                    ),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          final detail = provider.exerciseDetail;
          if (detail == null) return const SizedBox();

          final chartData =
              List<Map<String, dynamic>>.from(detail['chart_data'] ?? []);
          final summary = detail['summary'] as Map<String, dynamic>? ?? {};
          final recentSessions =
              List<Map<String, dynamic>>.from(detail['recent_sessions'] ?? []);

          return RefreshIndicator(
            onRefresh: () => provider.fetchExerciseDetail(
              widget.exerciseId,
              widget.type,
            ),
            color: AppColors.gold,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildRangeSelector(provider.selectedRange),
                const SizedBox(height: 20),
                _buildChart(chartData),
                const SizedBox(height: 8),
                _buildPrLegend(),
                const SizedBox(height: 24),
                _buildSummary(summary),
                const SizedBox(height: 24),
                if (widget.type == 'strength' &&
                    recentSessions.isNotEmpty) ...[
                  const Text(
                    'Recent Sessions',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ...recentSessions.take(5).map(_buildSessionCard),
                ],
                const SizedBox(height: 100),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildRangeSelector(String selected) {
    const ranges = ['30d', '90d', 'All'];

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        children: ranges.map((range) {
          final isSelected = selected == range;
          return Expanded(
            child: GestureDetector(
              onTap: () => _onRangeChanged(range),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.gold : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Center(
                  child: Text(
                    range == 'All' ? 'All Time' : range,
                    style: TextStyle(
                      color: isSelected ? Colors.white : AppColors.secondaryText,
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.normal,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildChart(List<Map<String, dynamic>> chartData) {
    if (chartData.isEmpty) {
      return Container(
        height: 200,
        decoration: BoxDecoration(
          color: AppColors.cardBackground,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: const Center(
          child: Text(
            'No data for this period',
            style: TextStyle(color: AppColors.hintText),
          ),
        ),
      );
    }

    String valueKey;
    String unit;
    if (widget.type == 'strength') {
      valueKey = 'weight';
      unit = 'kg';
    } else if (widget.type == 'yoga') {
      valueKey = 'hold_seconds';
      unit = 's';
    } else {
      valueKey = 'rounds';
      unit = '';
    }

    final spots = <FlSpot>[];
    final prIndices = <int>{};
    double minY = double.infinity;
    double maxY = double.negativeInfinity;

    for (int i = 0; i < chartData.length; i++) {
      final value = (chartData[i][valueKey] as num?)?.toDouble() ?? 0;
      spots.add(FlSpot(i.toDouble(), value));

      if (value < minY) minY = value;
      if (value > maxY) maxY = value;

      if (chartData[i]['is_pr'] == true) prIndices.add(i);
    }

    if (minY == maxY) {
      minY = (minY - 10).clamp(0, double.infinity);
      maxY = maxY + 10;
    } else {
      final yPadding = (maxY - minY) * 0.15;
      minY = (minY - yPadding).clamp(0, double.infinity);
      maxY = maxY + yPadding;
    }

    return Container(
      height: 220,
      padding: const EdgeInsets.fromLTRB(8, 16, 16, 8),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: LineChart(
        LineChartData(
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            horizontalInterval:
                ((maxY - minY) / 4).clamp(1, double.infinity),
            getDrawingHorizontalLine: (value) => FlLine(
              color: AppColors.cardBorder,
              strokeWidth: 1,
            ),
          ),
          titlesData: FlTitlesData(
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 44,
                getTitlesWidget: (value, meta) {
                  return Text(
                    '${value.toInt()}$unit',
                    style: const TextStyle(
                      color: AppColors.hintText,
                      fontSize: 11,
                    ),
                  );
                },
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 24,
                interval: (chartData.length / 4)
                    .ceilToDouble()
                    .clamp(1, double.infinity),
                getTitlesWidget: (value, meta) {
                  final index = value.toInt();
                  if (index < 0 || index >= chartData.length) {
                    return const SizedBox();
                  }

                  final dateStr = chartData[index]['date'] as String?;
                  if (dateStr == null) return const SizedBox();

                  try {
                    final date = DateTime.parse(dateStr);
                    return Text(
                      '${date.day}/${date.month}',
                      style: const TextStyle(
                        color: AppColors.hintText,
                        fontSize: 10,
                      ),
                    );
                  } catch (_) {
                    return const SizedBox();
                  }
                },
              ),
            ),
            topTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          ),
          borderData: FlBorderData(show: false),
          minY: minY,
          maxY: maxY,
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: true,
              curveSmoothness: 0.3,
              color: AppColors.gold,
              barWidth: 2.5,
              isStrokeCapRound: true,
              dotData: FlDotData(
                show: true,
                getDotPainter: (spot, percent, barData, index) {
                  final isPr = prIndices.contains(index);
                  return FlDotCirclePainter(
                    radius: isPr ? 6 : 3,
                    color: isPr ? AppColors.gold : AppColors.gold.withValues(alpha: 0.6),
                    strokeWidth: isPr ? 2 : 0,
                    strokeColor: Colors.white,
                  );
                },
              ),
              belowBarData: BarAreaData(
                show: true,
                color: AppColors.gold.withValues(alpha: 0.1),
              ),
            ),
          ],
          lineTouchData: LineTouchData(
            enabled: true,
            touchSpotThreshold: 20,
            handleBuiltInTouches: true,
            touchTooltipData: LineTouchTooltipData(
              tooltipRoundedRadius: 8,
              tooltipPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              tooltipMargin: 10,
              getTooltipColor: (_) => const Color(0xFF1a2332),
              tooltipBorder: BorderSide(color: AppColors.cardBorder, width: 1),
              fitInsideHorizontally: true,
              fitInsideVertically: true,
              getTooltipItems: (touchedSpots) {
                return touchedSpots.map((spot) {
                  final index = spot.spotIndex;
                  if (index < 0 || index >= chartData.length) {
                    return null;
                  }
                  final data = chartData[index];
                  final value = spot.y;
                  final dateStr = data['date'] as String? ?? '';
                  final isPr = data['is_pr'] == true;

                  return LineTooltipItem(
                    '${value.toInt()}$unit${isPr ? ' 🏆' : ''}\n$dateStr',
                    const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  );
                }).toList();
              },
            ),
            getTouchedSpotIndicator: (barData, spotIndexes) {
              return spotIndexes.map((index) {
                return TouchedSpotIndicatorData(
                  FlLine(color: AppColors.gold, strokeWidth: 2),
                  FlDotData(
                    show: true,
                    getDotPainter: (spot, percent, bar, index) {
                      return FlDotCirclePainter(
                        radius: 6,
                        color: AppColors.gold,
                        strokeWidth: 2,
                        strokeColor: Colors.white,
                      );
                    },
                  ),
                );
              }).toList();
            },
          ),
        ),
      ),
    );
  }

  Widget _buildPrLegend() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: AppColors.gold,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 1.5),
          ),
        ),
        const SizedBox(width: 6),
        const Text(
          'Personal Record',
          style: TextStyle(
            color: AppColors.hintText,
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  Widget _buildSummary(Map<String, dynamic> summary) {
    final List<Map<String, String>> stats = [];

    if (widget.type == 'strength') {
      final bestWeight = summary['best_weight'];
      final est1rm = summary['estimated_1rm'];
      final totalVolume = summary['total_volume'];
      final improvement = summary['improvement_percentage'];
      final totalSessions = summary['total_sessions'];

      if (bestWeight != null) {
        stats.add({'label': 'Best Weight', 'value': '${bestWeight}kg'});
      }
      if (est1rm != null) {
        stats.add({'label': 'Est. 1RM', 'value': '${est1rm}kg'});
      }
      if (totalVolume != null) {
        final vol = totalVolume as num;
        final formatted = vol > 1000
            ? '${(vol / 1000).toStringAsFixed(1)}k'
            : '$totalVolume';
        stats.add({'label': 'Total Volume', 'value': '${formatted}kg'});
      }
      if (improvement != null) {
        final imp = (improvement as num).toDouble();
        stats.add({
          'label': 'Improvement',
          'value': '+${imp.toStringAsFixed(1)}%',
        });
      }
      if (totalSessions != null) {
        stats.add({'label': 'Sessions', 'value': '$totalSessions'});
      }
    } else {
      final bestHold = summary['best_hold_seconds'];
      final totalSessions = summary['total_sessions'];

      if (bestHold != null) {
        stats.add({'label': 'Best Hold', 'value': '${bestHold}s'});
      }
      if (totalSessions != null) {
        stats.add({'label': 'Sessions', 'value': '$totalSessions'});
      }
    }

    if (stats.isEmpty) return const SizedBox();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Wrap(
        spacing: 24,
        runSpacing: 16,
        children: stats
            .map((s) => _buildStatItem(s['label']!, s['value']!))
            .toList(),
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return SizedBox(
      width: 100,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.hintText,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSessionCard(Map<String, dynamic> session) {
    final dateStr = session['date'] as String? ?? '';
    final sets = List<Map<String, dynamic>>.from(session['sets'] ?? []);

    String formattedDate = dateStr;
    try {
      final date = DateTime.parse(dateStr);
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      formattedDate = '${months[date.month - 1]} ${date.day}';
    } catch (_) {}

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            formattedDate,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: sets.map((set) {
              final weight = set['weight'] ?? 0;
              final reps = set['reps'] ?? 0;
              return Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '${weight}kg x $reps',
                  style: const TextStyle(
                    color: AppColors.secondaryText,
                    fontSize: 13,
                    fontFamily: 'RobotoMono',
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
