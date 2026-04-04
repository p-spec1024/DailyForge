export const defaultHabits = [
  { name: 'Workout completed',      category: 'health',      type: 'boolean',  auto_type: 'workout',    target_value: null, unit: null,  sort_order: 1 },
  { name: 'Breathwork done',        category: 'health',      type: 'boolean',  auto_type: 'breathwork', target_value: null, unit: null,  sort_order: 2 },
  { name: 'Water intake',           category: 'health',      type: 'quantity', auto_type: null,         target_value: 3,    unit: 'L',   sort_order: 3 },
  { name: 'Sleep 7+ hours',         category: 'health',      type: 'boolean',  auto_type: null,         target_value: null, unit: null,  sort_order: 4 },
  { name: 'Study / learning',       category: 'learning',    type: 'quantity', auto_type: null,         target_value: 2,    unit: 'hr',  sort_order: 1 },
  { name: 'Course module done',     category: 'learning',    type: 'boolean',  auto_type: null,         target_value: null, unit: null,  sort_order: 2 },
  { name: 'Build / code something', category: 'learning',    type: 'boolean',  auto_type: null,         target_value: null, unit: null,  sort_order: 3 },
  { name: 'Meditation',             category: 'mindfulness', type: 'quantity', auto_type: null,         target_value: 10,   unit: 'min', sort_order: 1 },
  { name: 'No phone first 30 min',  category: 'mindfulness', type: 'boolean',  auto_type: null,         target_value: null, unit: null,  sort_order: 2 },
  { name: 'Reading',                category: 'personal',    type: 'boolean',  auto_type: null,         target_value: null, unit: null,  sort_order: 1 },
];

export async function seedDefaultHabits(pool, userId) {
  const existing = await pool.query('SELECT COUNT(*) FROM habits WHERE user_id = $1', [userId]);
  if (Number(existing.rows[0].count) > 0) {
    return { seeded: false, message: 'User already has habits' };
  }

  for (const h of defaultHabits) {
    await pool.query(
      `INSERT INTO habits (user_id, name, category, type, auto_type, target_value, unit, sort_order, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
      [userId, h.name, h.category, h.type, h.auto_type, h.target_value, h.unit, h.sort_order]
    );
  }

  return { seeded: true, count: defaultHabits.length };
}
