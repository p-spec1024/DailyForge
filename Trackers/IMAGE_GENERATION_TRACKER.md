# DailyForge — Image Generation Tracker

Track for generating exercise illustrations. Updated daily as images are completed.

**Model:** Nano Banana 2 (Vertex AI Studio)
**Cost:** ~$0.067 per image
**Format:** 4-frame animated WebP (2x2 grid → crop → stitch)
**Target:** 1,050 exercises (736 strength + 265 yoga + 49 breathwork)

---

## Priority Tiers

### Tier 1: Default Weekly Program (generate first)
Core exercises that appear in the 7-day default program. ~50-80 exercises.

### Tier 2: Common Alternatives
Top alternatives for each slot. ~150-200 exercises.

### Tier 3: Full Library
Everything else. ~800 exercises.

---

## Generation Log

| Date | Exercises Generated | Uploaded | Notes |
|------|---------------------|----------|-------|
| | | | |

---

## Tier 1 — Default Weekly Program

| # | Exercise | Type | Muscles | Status | Date |
|---|----------|------|---------|--------|------|
| 1 | Barbell Squat | Strength | Quads, Glutes | ⏳ Pending | |
| 2 | Barbell Bench Press | Strength | Chest, Triceps | ⏳ Pending | |
| 3 | Barbell Deadlift | Strength | Back, Hamstrings | ⏳ Pending | |
| 4 | Overhead Press | Strength | Shoulders, Triceps | ⏳ Pending | |
| 5 | Barbell Row | Strength | Back, Biceps | ⏳ Pending | |
| 6 | Pull-up | Strength | Back, Biceps | ⏳ Pending | |
| 7 | Dumbbell Lateral Raise | Strength | Shoulders | ⏳ Pending | |
| 8 | Dumbbell Curl | Strength | Biceps | ⏳ Pending | |
| 9 | Tricep Pushdown | Strength | Triceps | ⏳ Pending | |
| 10 | Leg Press | Strength | Quads, Glutes | ⏳ Pending | |
| 11 | Romanian Deadlift | Strength | Hamstrings, Glutes | ⏳ Pending | |
| 12 | Leg Curl | Strength | Hamstrings | ⏳ Pending | |
| 13 | Calf Raise | Strength | Calves | ⏳ Pending | |
| 14 | Plank | Strength | Core | ⏳ Pending | |
| 15 | Cable Crunch | Strength | Core | ⏳ Pending | |
| 16 | Warrior I | Yoga | Legs, Hips | ⏳ Pending | |
| 17 | Warrior II | Yoga | Legs, Hips | ⏳ Pending | |
| 18 | Downward Dog | Yoga | Full Body | ⏳ Pending | |
| 19 | Sun Salutation A | Yoga | Full Body | ⏳ Pending | |
| 20 | Cat-Cow | Yoga | Spine | ⏳ Pending | |
| 21 | Child's Pose | Yoga | Back, Hips | ⏳ Pending | |
| 22 | Pigeon Pose | Yoga | Hips | ⏳ Pending | |
| 23 | Cobra Pose | Yoga | Back, Chest | ⏳ Pending | |
| 24 | Triangle Pose | Yoga | Legs, Core | ⏳ Pending | |
| 25 | Tree Pose | Yoga | Balance, Legs | ⏳ Pending | |
| 26 | Box Breathing | Breathwork | Lungs | ⏳ Pending | |
| 27 | Anulom Vilom | Breathwork | Lungs | ⏳ Pending | |
| 28 | Kapalabhati | Breathwork | Core, Lungs | ⏳ Pending | |
| 29 | 4-7-8 Breathing | Breathwork | Lungs | ⏳ Pending | |
| 30 | Bhramari | Breathwork | Lungs | ⏳ Pending | |

**Status Legend:** ⏳ Pending | 🎨 Generated | ☁️ Uploaded | ✅ Live

---

## Tier 2 — Common Alternatives

(To be populated after Tier 1 complete)

---

## Tier 3 — Full Library

(To be populated after Tier 2 complete)

---

## Workflow

1. **Generate** — Create 2x2 grid in Vertex AI Studio using prompt template
2. **Crop** — Split into 4 frames (A, B, C, D)
3. **Stitch** — Create animated WebP with ping-pong loop
4. **Upload** — Push to ImageKit CDN
5. **Update DB** — Set `media_url` for exercise
6. **Mark complete** — Update this tracker

---

## Notes

- Complex exercises (Clean & Jerk, Turkish Get-Up) need 6 frames
- Blue glow for breathwork, orange-amber for strength/yoga
- Character wears navy tank (strength), teal tank (yoga), navy long-sleeve (breathwork)