# DailyForge — Video Generation Tracker

Videos for complex exercises where 4-frame animation isn't enough. Generated 3-5 per day.

---

## Technical Settings (Veo 3.1 / Vertex AI Studio) — LOCKED Apr 9, 2026

| Setting | Value |
|---------|-------|
| Model | Veo 3.1 |
| Resolution | 1080p |
| Duration | 8 seconds |
| Aspect Ratio | 16:9 (widescreen) |
| Audio | Enabled (breathing/effort sounds, no speech) |
| Number of results | 1 |
| Person Generation | Allow (All ages) |
| Cost | ~$3.20 per video ($0.40/sec × 8 sec) |

---

## Visual Style (LOCKED — Apr 9, 2026)

| Element | Specification |
|---------|---------------|
| Subject | Realistic athletic adult male |
| Skin tone | Dark brown |
| Hair | Short textured black hair |
| Build | Muscular but natural (not bodybuilder) |
| Top | Dark charcoal fitted tank top |
| Bottoms | Dark charcoal shorts (strength) / yoga pants (yoga) |
| Footwear | White athletic shoes (strength) / barefoot (yoga/breathwork) |
| Background | Pure white studio |
| Lighting | Bright, even lighting |
| Floor | Subtle shadow beneath feet |
| Props | Only equipment needed for exercise |
| Camera | Static with subtle depth parallax |
| Style | Professional fitness demonstration, smooth controlled movement |

---

## Camera Angle & Face Visibility Guide

| Camera Angle | Face Visible? | When Used | Exercises |
|--------------|---------------|-----------|-----------|
| **Side profile** | **No** | Most exercises | Squats, Deadlifts, Rows, Olympic lifts, Yoga flows, Box Jumps, Burpees, Kettlebell moves |
| **Front view** | **Yes** (acceptable) | When symmetry/front movement matters | Pull-ups, Battle Ropes, Breathwork, Sumo Deadlift, Moon Salutation, Seated Twist |

---

## Prompt Templates

### For SIDE PROFILE Exercises (Face NOT Visible)

```
[EXERCISE NAME] demonstration.

A realistic athletic adult male with dark brown skin and short textured black hair performs [EXERCISE NAME]. He wears a dark charcoal fitted tank top, dark charcoal [shorts/yoga pants], and [white athletic shoes/is barefoot].

[STARTING POSITION DESCRIPTION]. [MOVEMENT DESCRIPTION]. [END POSITION OR RETURN TO START].

Pure white studio background with subtle floor shadow beneath feet. Bright, even lighting. Static camera with subtle depth parallax. Side profile view, full body visible, face not clearly visible. Professional fitness demonstration style. Smooth, controlled movement showing proper form.
```

### For FRONT VIEW Exercises (Face Visible)

```
[EXERCISE NAME] demonstration.

A realistic athletic adult male with dark brown skin and short textured black hair performs [EXERCISE NAME]. He wears a dark charcoal fitted tank top, dark charcoal [shorts/yoga pants], and [white athletic shoes/is barefoot].

[STARTING POSITION DESCRIPTION]. [MOVEMENT DESCRIPTION]. [END POSITION OR RETURN TO START].

Pure white studio background with subtle floor shadow beneath feet. Bright, even lighting. Static camera with subtle depth parallax. Front view, full body visible. Professional fitness demonstration style. Smooth, controlled movement showing proper form.
```

---

## Generation Log

| Date | Videos Generated | Uploaded | Notes |
|------|------------------|----------|-------|
| Apr 9 | Barbell Squat | 🎬 Local | Test video via Gemini, style locked |

---

## Exercise List (35 Complex Exercises)

### Strength — Olympic & Compound Lifts (12)

| # | Exercise | Best Angle | Face Visible | Reasoning | Equipment | Status | Date |
|---|----------|------------|--------------|-----------|-----------|--------|------|
| 1 | Barbell Squat | Side | No | See depth, knee tracking, back angle | Barbell | 🎬 Generated | Apr 9 |
| 2 | Deadlift (Conventional) | Side | No | See hip hinge, bar path, spine neutral | Barbell | ⏳ Pending | |
| 3 | Clean & Jerk | Side | No | See bar path, triple extension, catch position | Barbell | ⏳ Pending | |
| 4 | Snatch | Side | No | See full pull, overhead catch, bar trajectory | Barbell | ⏳ Pending | |
| 5 | Power Clean | Side | No | See explosive hip drive, front rack catch | Barbell | ⏳ Pending | |
| 6 | Hang Clean | Side | No | See starting position, pull from hang | Barbell | ⏳ Pending | |
| 7 | Turkish Get-Up | Side | No | See all 7 phases, arm vertical, hip movement | Kettlebell | ⏳ Pending | |
| 8 | Thruster | Side | No | See squat depth + overhead press transition | Barbell | ⏳ Pending | |
| 9 | Sumo Deadlift | Front | Yes | See wide stance, knee tracking over toes | Barbell | ⏳ Pending | |
| 10 | Romanian Deadlift | Side | No | See hip hinge, hamstring stretch, bar path | Barbell | ⏳ Pending | |
| 11 | Front Squat | Side | No | See elbow position, upright torso, depth | Barbell | ⏳ Pending | |
| 12 | Overhead Squat | Side | No | See bar overhead, torso angle, depth | Barbell | ⏳ Pending | |

### Strength — Explosive & Complex Movements (10)

| # | Exercise | Best Angle | Face Visible | Reasoning | Equipment | Status | Date |
|---|----------|------------|--------------|-----------|-----------|--------|------|
| 13 | Burpee | Side | No | See jump height, chest-to-ground, full extension | Bodyweight | ⏳ Pending | |
| 14 | Burpee Box Jump | Side | No | See jump onto box, landing mechanics | Box | ⏳ Pending | |
| 15 | Devil Press | Side | No | See burpee + snatch transition, overhead lockout | Dumbbells | ⏳ Pending | |
| 16 | Man Maker | Side | No | See row + thruster combination, transitions | Dumbbells | ⏳ Pending | |
| 17 | Muscle-Up | Side | No | See kip swing, transition over bar, dip lockout | Pull-up bar | ⏳ Pending | |
| 18 | Kipping Pull-Up | Side | No | See hip drive, kip swing, chin over bar | Pull-up bar | ⏳ Pending | |
| 19 | Box Jump | Side | No | See takeoff, hip extension, landing soft | Box | ⏳ Pending | |
| 20 | Kettlebell Swing | Side | No | See hip hinge, arm swing arc, chest up | Kettlebell | ⏳ Pending | |
| 21 | Kettlebell Snatch | Side | No | See pull, punch through, overhead lockout | Kettlebell | ⏳ Pending | |
| 22 | Battle Rope Slams | Front | Yes | See arm symmetry, wave pattern, stance | Battle ropes | ⏳ Pending | |

### Yoga — Flow Sequences (8)

| # | Exercise | Best Angle | Face Visible | Reasoning | Equipment | Status | Date |
|---|----------|------------|--------------|-----------|-----------|--------|------|
| 23 | Sun Salutation A | Side | No | See all transitions, spine curves, flow | None | ⏳ Pending | |
| 24 | Sun Salutation B | Side | No | See warrior additions, full flow sequence | None | ⏳ Pending | |
| 25 | Vinyasa Flow | Side | No | See plank-chaturanga-updog-downdog transitions | None | ⏳ Pending | |
| 26 | Warrior Flow (W1-W2-W3) | Side | No | See stance width, hip alignment, arm positions | None | ⏳ Pending | |
| 27 | Moon Salutation | Front | Yes | See lateral movements, side bends, symmetry | None | ⏳ Pending | |
| 28 | Cat-Cow Flow | Side | No | See spine flexion/extension, breath sync | None | ⏳ Pending | |
| 29 | Seated Twist Flow | Front | Yes | See spinal rotation, shoulder alignment | None | ⏳ Pending | |
| 30 | Hip Opener Flow | Side | No | See hip depth, knee safety, transitions | None | ⏳ Pending | |

### Breathwork — Visible Movement Techniques (5)

| # | Exercise | Best Angle | Face Visible | Reasoning | Equipment | Status | Date |
|---|----------|------------|--------------|-----------|-----------|--------|------|
| 31 | Kapalabhati | Front | Yes | See belly pumping, rhythmic contractions | None | ⏳ Pending | |
| 32 | Bhastrika | Front | Yes | See chest + belly expansion, arm movement | None | ⏳ Pending | |
| 33 | Breath of Fire | Front | Yes | See rapid belly movement, rhythm | None | ⏳ Pending | |
| 34 | Wim Hof Breathing | Front | Yes | See deep inhales, chest expansion, breath hold | None | ⏳ Pending | |
| 35 | Uddiyana Bandha | Side | No | See belly vacuum, diaphragm lift | None | ⏳ Pending | |

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ⏳ Pending | Not started |
| 🎬 Generated | Video created, saved locally |
| ☁️ Uploaded | On ImageKit CDN |
| ✅ Live | In app, video_url updated |

---

## Workflow

1. **Check this tracker** — find exercise, note Best Angle + Face Visible
2. Open Vertex AI Studio → Video → Veo 3.1
3. Set: 1080p, 8 sec, 1 result, audio ON
4. Copy correct prompt template (Side or Front)
5. Fill in exercise details
6. Generate → Download MP4
7. Save to `D:\projects\dailyforge\media\videos\[category]\`
8. Upload to ImageKit → Get CDN URL
9. Update DB → Set video_url for exercise
10. Update this tracker → Mark status + date

---

## File Storage

```
D:\projects\dailyforge\media\videos\
├── strength\
│   ├── barbell-squat.mp4
│   ├── deadlift.mp4
│   └── ...
├── yoga\
│   ├── sun-salutation-a.mp4
│   └── ...
└── breathwork\
    ├── kapalabhati.mp4
    └── ...
```

**Naming:** lowercase, hyphens, no spaces (e.g., `clean-and-jerk.mp4`)

---

## Notes

- Generate 3-5 videos per day max
- Always check "Best Angle" + "Face Visible" columns before generating
- Use correct prompt template based on angle (Side = face hidden, Front = face visible)
- Yoga videos: barefoot, yoga pants instead of shorts
- Breathwork videos: barefoot, show visible torso/belly movement
- If 8 seconds isn't enough, break into sub-exercises in DB
- Gemini can also generate videos — use whichever produces better results
