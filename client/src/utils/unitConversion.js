// Weight
export const kgToLbs = (kg) => kg * 2.20462;
export const lbsToKg = (lbs) => lbs / 2.20462;

// Height
export const cmToFeetInches = (cm) => {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
};
export const feetInchesToCm = (feet, inches) => (feet * 12 + inches) * 2.54;

// Circumference
export const cmToInches = (cm) => cm / 2.54;
export const inchesToCm = (inches) => inches * 2.54;

// BMI
export const calculateBMI = (weightKg, heightCm) => {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
};

export const getBMICategory = (bmi) => {
  if (bmi == null) return { label: '—', color: 'rgba(255,255,255,0.4)' };
  if (bmi < 18.5) return { label: 'Underweight', color: '#60a5fa' };
  if (bmi < 25) return { label: 'Normal', color: '#1D9E75' };
  if (bmi < 30) return { label: 'Overweight', color: '#f59e0b' };
  return { label: 'Obese', color: '#ef4444' };
};

// Display helpers — convert kg/cm to user's preferred unit display
export const formatWeight = (kg, system) => {
  if (kg == null) return '—';
  if (system === 'imperial') return `${kgToLbs(kg).toFixed(1)} lb`;
  return `${Number(kg).toFixed(1)} kg`;
};

export const formatLength = (cm, system) => {
  if (cm == null) return '—';
  if (system === 'imperial') return `${cmToInches(cm).toFixed(1)} in`;
  return `${Number(cm).toFixed(1)} cm`;
};

export const formatHeight = (cm, system) => {
  if (cm == null) return '—';
  if (system === 'imperial') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}' ${inches}"`;
  }
  return `${Number(cm).toFixed(0)} cm`;
};

// Convert user-entered weight value (in display unit) back to kg for storage
export const toKg = (value, system) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return system === 'imperial' ? lbsToKg(n) : n;
};

// Convert user-entered length value back to cm
export const toCm = (value, system) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return system === 'imperial' ? inchesToCm(n) : n;
};

// Convert kg → display unit number (no suffix), for input field values
export const fromKg = (kg, system) => {
  if (kg == null) return '';
  return system === 'imperial' ? Number(kgToLbs(kg).toFixed(1)) : Number(Number(kg).toFixed(1));
};

export const fromCm = (cm, system) => {
  if (cm == null) return '';
  return system === 'imperial' ? Number(cmToInches(cm).toFixed(1)) : Number(Number(cm).toFixed(1));
};
