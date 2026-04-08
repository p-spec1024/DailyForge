# DailyForge — Video Generation Tracker

Videos for complex exercises where 4-frame animation isn't enough. Generated 3-5 per day.

---

## Technical Settings (Veo 3 / Google AI Studio)

| Setting | Value |
|---------|-------|
| Model | Veo 3 |
| Resolution | 720p |
| Duration | 8 seconds |
| Aspect Ratio | 16:9 (widescreen) |
| Audio | Enabled |
| Person Generation | allow_adult |

---

## Visual Style (LOCKED)

| Element | Specification |
|---------|---------------|
| Subject | Realistic athletic adult male |
| Skin tone | Dark brown |
| Hair | Short textured black hair |
| Build | Muscular but natural (not bodybuilder) |
| Top | Dark charcoal fitted tank top |
| Bottoms | Dark charcoal shorts (strength) / yoga pants (yoga) |
| Footwear | White athletic shoes (strength) / barefoot (yoga) |
| Background | Clean light gray or off-white gradient |
| Floor | Subtle shadow beneath subject |
| Props | Only equipment needed for exercise (barbell, dumbbells, etc.) |
| Camera | Static (no movement), full body visible |
| Camera angle | Side profile (default) or front-facing (specified per exercise) |
| Camera height | Eye level |
| Style | Professional fitness demonstration, smooth controlled movement |

---

## Prompt Template

```
[EXERCISE NAME] demonstration.

A realistic athletic adult male with dark brown skin and short black hair performs [EXERCISE NAME]. He wears a dark charcoal fitted tank top, dark charcoal [shorts/yoga pants], and [white athletic shoes/is barefoot].

[STARTING POSITION DESCRIPTION]. [MOVEMENT DESCRIPTION]. [END POSITION OR RETURN TO START].

Clean light gray studio background with subtle floor shadow. Static camera, [side profile/front-facing] view, full body visible. Professional fitness demonstration style. Smooth, controlled movement showing proper form.
```

---

## Generation Log

| Date | Videos Generated | Uploaded | Notes |
|------|------------------|----------|-------|
| | | | |

---

## Exercise List (35 Complex Exercises)

### Strength — Olympic & Compound Lifts (12)

| # | Exercise | Camera Angle | Equipment | Status | Date |
|---|----------|--------------|-----------|--------|------|
| 1 | Barbell Squat | Side | Barbell | ⏳ Pending | |
| 2 | Deadlift (Conventional) | Side | Barbell | ⏳ Pending | |
| 3 | Clean & Jerk | Side | Barbell | ⏳ Pending | |
| 4 | Snatch | Side | Barbell | ⏳ Pending | |
| 5 | Power Clean | Side | Barbell | ⏳ Pending | |
| 6 | Hang Clean | Side | Barbell | ⏳ Pending | |
| 7 | Turkish Get-Up | Side | Kettlebell | ⏳ Pending | |
| 8 | Thruster | Side | Barbell | ⏳ Pending | |
| 9 | Sumo Deadlift | Front | Barbell | ⏳ Pending | |
| 10 | Romanian Deadlift | Side | Barbell | ⏳ Pending | |
| 11 | Front Squat | Side | Barbell | ⏳ Pending | |
| 12 | Overhead Squat | Side | Barbell | ⏳ Pending | |

### Strength — Explosive & Complex Movements (10)

| # | Exercise | Camera Angle | Equipment | Status | Date |
|---|----------|--------------|-----------|--------|------|
| 13 | Burpee | Side | Bodyweight | ⏳ Pending | |
| 14 | Burpee Box Jump | Side | Box | ⏳ Pending | |
| 15 | Devil Press | Side | Dumbbells | ⏳ Pending | |
| 16 | Man Maker | Side | Dumbbells | ⏳ Pending | |
| 17 | Muscle-Up | Front | Pull-up bar | ⏳ Pending | |
| 18 | Kipping Pull-Up | Front | Pull-up bar | ⏳ Pending | |
| 19 | Box Jump | Side | Box | ⏳ Pending | |
| 20 | Kettlebell Swing | Side | Kettlebell | ⏳ Pending | |
| 21 | Kettlebell Snatch | Side | Kettlebell | ⏳ Pending | |
| 22 | Battle Rope Slams | Front | Battle ropes | ⏳ Pending | |

### Yoga — Flow Sequences (8)

| # | Exercise | Camera Angle | Equipment | Status | Date |
|---|----------|--------------|-----------|--------|------|
| 23 | Sun Salutation A | Side | None | ⏳ Pending | |
| 24 | Sun Salutation B | Side | None | ⏳ Pending | |
| 25 | Vinyasa Flow (Plank-Chaturanga-UpDog-DownDog) | Side | None | ⏳ Pending | |
| 26 | Warrior Flow (W1-W2-W3) | Side | None | ⏳ Pending | |
| 27 | Moon Salutation | Front | None | ⏳ Pending | |
| 28 | Cat-Cow Flow | Side | None | ⏳ Pending | |
| 29 | Seated Twist Flow | Front | None | ⏳ Pending | |
| 30 | Hip Opener Flow | Side | None | ⏳ Pending | |

### Breathwork — Visible Movement Techniques (5)

| # | Exercise | Camera Angle | Equipment | Status | Date |
|---|----------|--------------|-----------|--------|------|
| 31 | Kapalabhati (Skull Shining Breath) | Front | None | ⏳ Pending | |
| 32 | Bhastrika (Bellows Breath) | Front | None | ⏳ Pending | |
| 33 | Breath of Fire | Front | None | ⏳ Pending | |
| 34 | Wim Hof Breathing | Front | None | ⏳ Pending | |
| 35 | Uddiyana Bandha | Side | None | ⏳ Pending | |

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ⏳ Pending | Not started |
| 🎬 Generated | Video created, not uploaded |
| ☁️ Uploaded | On ImageKit CDN |
| ✅ Live | In app, media_url updated |

---

## Workflow

1. Open Google AI Studio → Video Gen → Veo 3
2. Copy prompt template → Fill in exercise details
3. Generate → Download MP4
4. Upload to ImageKit → Get CDN URL
5. Update DB → Set video_url for exercise
6. Mark complete → Update this tracker

---

## Notes

- Generate 3-5 videos per day max
- Side profile default; use front for symmetrical exercises (pull-ups, battle ropes)
- Yoga videos: barefoot, yoga pants instead of shorts
- Breathwork videos: show visible torso/belly movement
- If 8 seconds isn't enough for full movement, break into sub-exercises in DB
