import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../config/theme.dart';
import '../../utils/unit_conversion.dart';

class HeightPromptSheet extends StatefulWidget {
  final String unitSystem;
  final double? currentHeightCm;
  final Future<bool> Function(double heightCm) onSave;

  const HeightPromptSheet({
    super.key,
    required this.unitSystem,
    this.currentHeightCm,
    required this.onSave,
  });

  @override
  State<HeightPromptSheet> createState() => _HeightPromptSheetState();
}

class _HeightPromptSheetState extends State<HeightPromptSheet> {
  late bool _isMetric;
  bool _isSaving = false;

  final _cmCtrl = TextEditingController();
  final _feetCtrl = TextEditingController();
  final _inchesCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _isMetric = widget.unitSystem == 'metric';
    _prefillHeight();
  }

  void _prefillHeight() {
    final cm = widget.currentHeightCm;
    if (cm == null) return;
    _cmCtrl.text = cm.round().toString();
    final totalInches = cm / 2.54;
    _feetCtrl.text = (totalInches / 12).floor().toString();
    _inchesCtrl.text = (totalInches % 12).round().toString();
  }

  @override
  void dispose() {
    _cmCtrl.dispose();
    _feetCtrl.dispose();
    _inchesCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    double? heightCm;

    if (_isMetric) {
      if (_cmCtrl.text.isEmpty) return;
      heightCm = double.tryParse(_cmCtrl.text);
      if (heightCm == null || heightCm < 50 || heightCm > 300) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter a valid height (50-300 cm)')),
        );
        return;
      }
    } else {
      if (_feetCtrl.text.isEmpty) return;
      final feet = int.tryParse(_feetCtrl.text) ?? 0;
      final inches = int.tryParse(_inchesCtrl.text) ?? 0;
      if (feet < 2 || feet > 9) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter a valid height')),
        );
        return;
      }
      heightCm = feetInchesToCm(feet, inches);
    }

    setState(() => _isSaving = true);
    final success = await widget.onSave(heightCm);
    if (mounted) {
      setState(() => _isSaving = false);
      if (success) Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.hintText.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          const Text(
            'Set Your Height',
            style: TextStyle(
              color: AppColors.primaryText,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Height is needed to calculate your BMI',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 20),

          // Unit toggle
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                _buildToggle('Metric', _isMetric, () {
                  setState(() => _isMetric = true);
                }),
                _buildToggle('Imperial', !_isMetric, () {
                  setState(() => _isMetric = false);
                }),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Input fields
          if (_isMetric)
            TextFormField(
              controller: _cmCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: const TextStyle(color: AppColors.primaryText),
              decoration: InputDecoration(
                labelText: 'Height',
                labelStyle:
                    const TextStyle(color: AppColors.secondaryText),
                suffixText: 'cm',
                suffixStyle:
                    const TextStyle(color: AppColors.hintText, fontSize: 14),
                filled: true,
                fillColor: AppColors.background,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.cardBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.gold),
                ),
              ),
            )
          else
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _feetCtrl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(1),
                    ],
                    style: const TextStyle(color: AppColors.primaryText),
                    decoration: InputDecoration(
                      labelText: 'Feet',
                      labelStyle:
                          const TextStyle(color: AppColors.secondaryText),
                      suffixText: 'ft',
                      suffixStyle: const TextStyle(
                          color: AppColors.hintText, fontSize: 14),
                      filled: true,
                      fillColor: AppColors.background,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: AppColors.cardBorder),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.gold),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _inchesCtrl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(2),
                    ],
                    style: const TextStyle(color: AppColors.primaryText),
                    decoration: InputDecoration(
                      labelText: 'Inches',
                      labelStyle:
                          const TextStyle(color: AppColors.secondaryText),
                      suffixText: 'in',
                      suffixStyle: const TextStyle(
                          color: AppColors.hintText, fontSize: 14),
                      filled: true,
                      fillColor: AppColors.background,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: AppColors.cardBorder),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.gold),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          const SizedBox(height: 24),

          // Save button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSaving ? null : _handleSave,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: Colors.white,
                disabledBackgroundColor:
                    AppColors.gold.withValues(alpha: 0.5),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _isSaving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Text(
                      'Save',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildToggle(String label, bool isSelected, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.gold : Colors.transparent,
            borderRadius: BorderRadius.circular(7),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : AppColors.secondaryText,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                fontSize: 14,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
