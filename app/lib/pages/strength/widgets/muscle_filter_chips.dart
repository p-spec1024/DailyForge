import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../config/theme.dart';
import '../../../providers/strength_provider.dart';

class MuscleFilterChips extends StatelessWidget {
  const MuscleFilterChips({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<StrengthProvider>(
      builder: (context, provider, child) {
        final groups = ['All', ...provider.muscleGroups];
        
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: groups.map((group) {
              final isAll = group == 'All';
              final isSelected = isAll 
                  ? provider.selectedMuscle == null 
                  : provider.selectedMuscle == group;
              
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(
                    capitalize(group),
                    style: TextStyle(
                      color: isSelected ? Colors.white : AppColors.secondaryText,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                  selected: isSelected,
                  onSelected: (selected) {
                    provider.setMuscleFilter(isAll ? null : group);
                  },
                  backgroundColor: Colors.transparent,
                  selectedColor: AppColors.strength,
                  checkmarkColor: Colors.white,
                  showCheckmark: false,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide(
                      color: isSelected ? AppColors.strength : AppColors.cardBorder,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        );
      },
    );
  }
}
