/**
 * Exercise Media Generator — Prompt templates for Vertex AI media generation
 */

export const PROMPT_TEMPLATES = {
  strength: (exercise) =>
    `Minimalist fitness illustration of a person performing ${exercise.name}. ` +
    `Side view showing proper form. Clean lines, neutral background. ` +
    `Target muscles: ${exercise.target_muscles || 'full body'}. ` +
    `Professional, anatomically correct, safe exercise form.`,

  yoga: (exercise) =>
    `Yoga pose illustration: ${exercise.name}${exercise.sanskrit_name ? ` (${exercise.sanskrit_name})` : ''}. ` +
    `Serene, balanced composition showing correct alignment. ` +
    `Side or three-quarter view. Clean, calming aesthetic. ` +
    `Anatomically correct positioning, peaceful expression.`,

  breathwork: (exercise) =>
    `Calm meditation illustration for ${exercise.name} breathing technique. ` +
    `Person in comfortable seated position, eyes closed, peaceful expression. ` +
    `Soft, calming colors. Subtle indication of breath (gentle glow or flow lines). ` +
    `Minimalist, serene atmosphere.`,

  stretch: (exercise) =>
    `Minimalist fitness illustration of a person performing ${exercise.name} stretch. ` +
    `Side view showing proper form and full range of motion. Clean lines, neutral background. ` +
    `Target muscles: ${exercise.target_muscles || 'full body'}. ` +
    `Professional, anatomically correct, safe stretching form.`
};
