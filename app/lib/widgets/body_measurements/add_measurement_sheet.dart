import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../config/theme.dart';
import '../../models/body_measurement.dart';
import '../../utils/unit_conversion.dart';

class AddMeasurementSheet extends StatefulWidget {
  final String unitSystem;
  final Future<bool> Function(Map<String, dynamic> data) onSave;

  /// When non-null, the sheet opens in edit mode with fields pre-filled.
  final BodyMeasurement? existing;

  const AddMeasurementSheet({
    super.key,
    required this.unitSystem,
    required this.onSave,
    this.existing,
  });

  @override
  State<AddMeasurementSheet> createState() => _AddMeasurementSheetState();
}

class _AddMeasurementSheetState extends State<AddMeasurementSheet> {
  final _formKey = GlobalKey<FormState>();
  late DateTime _date;
  bool _isSaving = false;

  late final TextEditingController _weightCtrl;
  late final TextEditingController _bodyFatCtrl;
  late final TextEditingController _waistCtrl;
  late final TextEditingController _hipsCtrl;
  late final TextEditingController _chestCtrl;
  late final TextEditingController _bicepLeftCtrl;
  late final TextEditingController _bicepRightCtrl;
  late final TextEditingController _notesCtrl;

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _date = e?.measuredAt ?? DateTime.now();

    String fmtWeight(double? kg) => kg == null
        ? ''
        : kgToDisplay(kg, widget.unitSystem).toStringAsFixed(1);
    String fmtLength(double? cm) => cm == null
        ? ''
        : cmToDisplay(cm, widget.unitSystem).toStringAsFixed(1);
    String fmtRaw(double? v) => v == null ? '' : v.toStringAsFixed(1);

    _weightCtrl = TextEditingController(text: fmtWeight(e?.weightKg));
    _bodyFatCtrl = TextEditingController(text: fmtRaw(e?.bodyFatPercent));
    _waistCtrl = TextEditingController(text: fmtLength(e?.waistCm));
    _hipsCtrl = TextEditingController(text: fmtLength(e?.hipsCm));
    _chestCtrl = TextEditingController(text: fmtLength(e?.chestCm));
    _bicepLeftCtrl = TextEditingController(text: fmtLength(e?.bicepLeftCm));
    _bicepRightCtrl = TextEditingController(text: fmtLength(e?.bicepRightCm));
    _notesCtrl = TextEditingController(text: e?.notes ?? '');
  }

  @override
  void dispose() {
    _weightCtrl.dispose();
    _bodyFatCtrl.dispose();
    _waistCtrl.dispose();
    _hipsCtrl.dispose();
    _chestCtrl.dispose();
    _bicepLeftCtrl.dispose();
    _bicepRightCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: AppColors.gold,
              surface: AppColors.surface,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() => _date = picked);
    }
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    // Check at least one field is filled
    final hasData = _weightCtrl.text.isNotEmpty ||
        _bodyFatCtrl.text.isNotEmpty ||
        _waistCtrl.text.isNotEmpty ||
        _hipsCtrl.text.isNotEmpty ||
        _chestCtrl.text.isNotEmpty ||
        _bicepLeftCtrl.text.isNotEmpty ||
        _bicepRightCtrl.text.isNotEmpty;

    if (!hasData) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter at least one measurement')),
      );
      return;
    }

    setState(() => _isSaving = true);

    final data = <String, dynamic>{
      'measured_at': _date.toIso8601String().split('T')[0],
    };

    if (_weightCtrl.text.isNotEmpty) {
      data['weight_kg'] =
          displayWeightToKg(double.parse(_weightCtrl.text), widget.unitSystem);
    }
    if (_bodyFatCtrl.text.isNotEmpty) {
      data['body_fat_percent'] = double.parse(_bodyFatCtrl.text);
    }
    if (_waistCtrl.text.isNotEmpty) {
      data['waist_cm'] =
          displayLengthToCm(double.parse(_waistCtrl.text), widget.unitSystem);
    }
    if (_hipsCtrl.text.isNotEmpty) {
      data['hips_cm'] =
          displayLengthToCm(double.parse(_hipsCtrl.text), widget.unitSystem);
    }
    if (_chestCtrl.text.isNotEmpty) {
      data['chest_cm'] =
          displayLengthToCm(double.parse(_chestCtrl.text), widget.unitSystem);
    }
    if (_bicepLeftCtrl.text.isNotEmpty) {
      data['bicep_left_cm'] =
          displayLengthToCm(double.parse(_bicepLeftCtrl.text), widget.unitSystem);
    }
    if (_bicepRightCtrl.text.isNotEmpty) {
      data['bicep_right_cm'] = displayLengthToCm(
          double.parse(_bicepRightCtrl.text), widget.unitSystem);
    }
    if (_notesCtrl.text.isNotEmpty) {
      data['notes'] = _notesCtrl.text;
    }

    final success = await widget.onSave(data);

    if (mounted) {
      setState(() => _isSaving = false);
      if (success) {
        Navigator.pop(context);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final wUnit = weightUnit(widget.unitSystem);
    final lUnit = lengthUnit(widget.unitSystem);

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
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
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

              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _isEditing ? 'Edit Measurement' : 'Add Measurement',
                    style: const TextStyle(
                      color: AppColors.primaryText,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(LucideIcons.x,
                        color: AppColors.secondaryText, size: 22),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Date picker
              GestureDetector(
                onTap: _pickDate,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.cardBorder),
                  ),
                  child: Row(
                    children: [
                      const Icon(LucideIcons.calendar,
                          color: AppColors.secondaryText, size: 18),
                      const SizedBox(width: 10),
                      Text(
                        '${_date.day}/${_date.month}/${_date.year}',
                        style: const TextStyle(
                          color: AppColors.primaryText,
                          fontSize: 15,
                        ),
                      ),
                      const Spacer(),
                      const Icon(LucideIcons.chevronDown,
                          color: AppColors.hintText, size: 16),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Weight & Body Fat
              Row(
                children: [
                  Expanded(
                    child: _buildField('Weight', wUnit, _weightCtrl),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildField('Body Fat', '%', _bodyFatCtrl),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Circumferences header
              const Text(
                'CIRCUMFERENCES',
                style: TextStyle(
                  color: AppColors.secondaryText,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: _buildField('Waist', lUnit, _waistCtrl),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildField('Hips', lUnit, _hipsCtrl),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _buildField('Chest', lUnit, _chestCtrl),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _buildField('Left Bicep', lUnit, _bicepLeftCtrl),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildField('Right Bicep', lUnit, _bicepRightCtrl),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Notes
              TextFormField(
                controller: _notesCtrl,
                style: const TextStyle(color: AppColors.primaryText),
                decoration: InputDecoration(
                  labelText: 'Notes',
                  labelStyle:
                      const TextStyle(color: AppColors.secondaryText),
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
                ),
                maxLines: 2,
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
                      : Text(
                          _isEditing ? 'Update Measurement' : 'Save Measurement',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField(
      String label, String unit, TextEditingController controller) {
    return TextFormField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
      ],
      style: const TextStyle(color: AppColors.primaryText),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: AppColors.secondaryText),
        suffixText: unit,
        suffixStyle: const TextStyle(color: AppColors.hintText, fontSize: 14),
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
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
      validator: (value) {
        if (value == null || value.isEmpty) return null; // optional
        final num = double.tryParse(value);
        if (num == null || num <= 0) return 'Invalid';
        return null;
      },
    );
  }
}
