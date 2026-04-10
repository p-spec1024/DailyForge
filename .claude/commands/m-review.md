# /m-review — Media QA Agent

A world-class exercise media reviewer for DailyForge. Analyzes images (4-frame WebP) and videos (8-sec MP4) with expert-level scrutiny.

**Trigger:** `/m-review <filepath>` or `/m-review <filepath> "Exercise Name"`

---

## What This Is

A specialized QA agent that:
1. **INSPECTS your image/video** — Describes exactly what it sees in each frame (body position, equipment, movement, muscles glowing)
2. **IDENTIFIES the exercise** — From the visual or from the name you provide
3. **RESEARCHES correct form** — Searches for proper technique, joint angles, common mistakes
4. **COMPARES** — What the media shows vs what correct form should look like
5. **REPORTS** — Detailed findings with specific issues so you can regenerate with fixes

This is NOT `/review` (code quality). This is media-specific QA.

---

## Auto-Detection

The agent automatically detects file type and applies the appropriate review:

| Extension | Type | Review Applied |
|-----------|------|----------------|
| `.webp`, `.png`, `.jpg`, `.gif` | Image | 4-frame animation review |
| `.mp4`, `.mov`, `.webm` | Video | Full motion review |

---

## Review Process

### Step 1: Visual Inspection — Describe Exactly What You See

**CRITICAL: Analyze the actual image/video FIRST. Do not assume anything based on filename.**

Open the media file and describe in detail:

**For Images (4-frame WebP / 2x2 grid):**

```
FRAME A (Top-Left):
- Body position: [standing/seated/lying/kneeling]
- Equipment: [what is visible — barbell, dumbbells, mat, machine, none]
- Grip: [overhand/underhand/neutral, wide/narrow/shoulder-width]
- Stance: [feet position, width, angle]
- Limbs: [arm position, leg position, joint angles]
- Muscles glowing: [which muscles are highlighted, what color]
- Character: [outfit color, bald/hair, build]

FRAME B (Top-Right):
[Same level of detail — what changed from Frame A?]

FRAME C (Bottom-Left):
[Same level of detail — is this the peak/bottom of movement?]

FRAME D (Bottom-Right):
[Same level of detail — return to start or continuation?]
```

**For Videos (8-sec MP4):**

```
0-2 SECONDS:
- Starting position: [full description]
- Initial movement: [what begins happening]

2-4 SECONDS:
- Movement phase: [what is the person doing]
- Form observations: [joint angles, bar path, etc.]

4-6 SECONDS:
- Peak/end position: [deepest point, top of movement, etc.]

6-8 SECONDS:
- Return phase: [how they return to start]
- Additional reps: [if any]
```

**Also note during inspection:**
- Any AI artifacts (extra limbs, warping, melting, random objects)
- Finger count on each visible hand
- Face/head appearance
- Background cleanliness

### Step 2: Identify the Exercise

Based on your visual inspection:
- **If exercise name was provided:** Confirm it matches what you see
- **If no name provided:** Identify the exercise from the movement, equipment, and body position
- **If filename available:** Parse from filename (e.g., `barbell-squat.webp` → "Barbell Squat")
- **If unclear:** State what exercise it APPEARS to be and note uncertainty

### Step 3: Research Correct Form

Once exercise is identified, **search the web** for:
- "[Exercise Name] proper form technique"
- "[Exercise Name] common mistakes"

Document the gold standard:
- Correct starting position
- Proper movement path and joint angles
- Full range of motion requirements
- Primary and secondary muscles worked
- Key coaching cues ("chest up", "knees out", "neutral spine")
- Common form errors to avoid

### Step 4: Compare — Does the Visual Match Correct Form?

Frame-by-frame comparison of what you SAW (Step 1) vs what SHOULD happen (Step 3).

**For Images (4-frame WebP / 2x2 grid):**

| Frame | Position | What to Check |
|-------|----------|---------------|
| A (top-left) | Starting | Setup position correct? |
| B (top-right) | Phase 1 | First movement phase correct? |
| C (bottom-left) | Phase 2 | End position / deepest point correct? |
| D (bottom-right) | Phase 3 | Return movement correct? |

**For Videos (8-sec MP4):**
Analyze at timestamps: 0s, 2s, 4s, 6s, 8s minimum. Note issues at specific moments.

---

## Review Checklist

### 1. Physical Possibility (Critical — AI Failure Points)

Look for these common AI generation errors:

- [ ] **Limb count** — Exactly 2 arms, 2 legs visible (no extra/missing limbs)
- [ ] **Joint angles** — Elbows, knees, hips bend in anatomically possible directions
- [ ] **Left/Right symmetry** — Bilateral movements show balanced sides
- [ ] **Finger count** — 5 fingers per hand (AI often fails this)
- [ ] **Body proportions** — Head, torso, limbs in realistic proportion
- [ ] **Feet grounded** — Unless exercise requires airborne phase
- [ ] **Spine integrity** — No impossible twisting or bending
- [ ] **Face/head** — One head, facing correct direction, not distorted

### 2. Exercise Accuracy (Critical)

Compare what you SEE vs what the exercise REQUIRES:

- [ ] **Starting position correct** — Matches how exercise actually begins
- [ ] **Movement path correct** — Bar/dumbbell/body moves in right direction
- [ ] **End position correct** — Full range of motion shown
- [ ] **Grip correct** — Overhand vs underhand vs neutral as required
- [ ] **Stance width correct** — Shoulder-width, wide, narrow as appropriate
- [ ] **Equipment held correctly** — Barbell centered, dumbbells parallel, etc.
- [ ] **Joint angles match exercise** — e.g., 90° elbow for bicep curl peak
- [ ] **Common mistakes avoided** — Knees caving, back rounding, etc.

### 3. Muscle Glow Accuracy (DailyForge Style)

- [ ] **Correct muscles highlighted** — Glow matches primary movers
- [ ] **Glow color correct** — Orange-amber for strength/yoga, blue for breathwork
- [ ] **Glow intensity proportional** — Primary muscles brighter than secondary
- [ ] **No incorrect muscles glowing** — Biceps shouldn't glow during squats

### 4. Character Consistency (DailyForge Style)

- [ ] **Bald head** — No hair
- [ ] **Wii Sports-style face** — Simple, friendly features
- [ ] **Correct outfit:**
  - Navy tank top = strength
  - Teal tank top = yoga
  - Navy long-sleeve = breathwork
- [ ] **Athletic build** — Muscular but natural
- [ ] **Gender-neutral appearance** — As per style guide
- [ ] **Consistent across frames** — Same character in all 4 frames / throughout video

### 5. Composition & Technical

- [ ] **Full body visible** — Not cropped awkwardly
- [ ] **Clean background** — No distracting elements
- [ ] **Good lighting** — Even, no harsh shadows obscuring form
- [ ] **No AI artifacts** — No warping, melting, extra objects
- [ ] **Equipment visible** — Barbell/dumbbells/mat clearly shown
- [ ] **Camera angle appropriate** — Can see the form being demonstrated
- [ ] **Frame sequence logical** — Movement flows naturally A → B → C → D

---

## Verdict System

After review, assign one verdict:

| Verdict | Meaning | Action |
|---------|---------|--------|
| ✅ **PASS** | Ready for production | Upload to ImageKit, update DB |
| 🟡 **FLAG** | Minor issues, usable with notes | Document issues, human decision |
| ❌ **REJECT** | Significant errors | Regenerate with adjusted prompt |

---

## Output Format

```
## /m-review: [Exercise Name]

**File:** [filename]
**Type:** [Image (4-frame) / Video (8-sec)]

---

### 1. Visual Inspection — What I See

**Frame A (Top-Left):**
- Body position: [description]
- Equipment: [description]
- Grip/Stance: [description]
- Muscles glowing: [description]
- Character: [outfit, build]

**Frame B (Top-Right):**
- [description of what changed]

**Frame C (Bottom-Left):**
- [description]

**Frame D (Bottom-Right):**
- [description]

**AI Artifact Check:**
- Limb count: [2 arms, 2 legs — OK / Issue]
- Finger count: [5 per hand — OK / Issue]
- Face/head: [OK / Issue]
- Warping/melting: [None / Describe]

---

### 2. Exercise Identified

**Exercise:** [Name]
**Confidence:** [High/Medium/Low — explain if not high]

---

### 3. Research — Correct Form

[2-4 sentences describing proper form for this exercise, from web search]

**Key cues:**
- [cue 1]
- [cue 2]
- [cue 3]

**Common mistakes:**
- [mistake 1]
- [mistake 2]

---

### 4. Comparison — Frame-by-Frame Analysis

**Frame A (Starting Position):**
- Expected: [what should be shown]
- Observed: [what is shown]
- Match: ✅ / ⚠️ / ❌
- Notes: [any discrepancies]

**Frame B (Phase 1):**
- Expected: [what should be shown]
- Observed: [what is shown]
- Match: ✅ / ⚠️ / ❌
- Notes: [any discrepancies]

**Frame C (Phase 2 / End Position):**
- Expected: [what should be shown]
- Observed: [what is shown]
- Match: ✅ / ⚠️ / ❌
- Notes: [any discrepancies]

**Frame D (Phase 3 / Return):**
- Expected: [what should be shown]
- Observed: [what is shown]
- Match: ✅ / ⚠️ / ❌
- Notes: [any discrepancies]

---

### 5. Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Physical Possibility | ✅/⚠️/❌ | [limbs, fingers, joints] |
| Exercise Form Accuracy | ✅/⚠️/❌ | [matches correct technique?] |
| Muscle Glow | ✅/⚠️/❌ | [correct muscles, correct color] |
| Character Consistency | ✅/⚠️/❌ | [outfit, bald, build] |
| Composition | ✅/⚠️/❌ | [framing, background, artifacts] |

---

### 6. Issues Found

| # | Issue | Severity | Frame(s) | Fix Suggestion |
|---|-------|----------|----------|----------------|
| 1 | [description] | Critical/Medium/Minor | [A/B/C/D] | [how to fix in prompt] |
| 2 | [description] | Critical/Medium/Minor | [A/B/C/D] | [how to fix in prompt] |

---

### Verdict: ✅ PASS / 🟡 FLAG / ❌ REJECT

[1-2 sentence summary explaining the decision]

[If FLAG or REJECT: Specific prompt modifications to fix issues]
```

---

## Example Review

```
## /m-review: Barbell Squat

**File:** barbell-squat.webp
**Type:** Image (4-frame)

---

### 1. Visual Inspection — What I See

**Frame A (Top-Left):**
- Body position: Standing upright
- Equipment: Barbell resting on upper back/traps
- Grip/Stance: Overhand grip outside shoulders, feet shoulder-width apart, toes slightly out
- Muscles glowing: None visible in starting position
- Character: Navy tank top, bald, athletic build

**Frame B (Top-Right):**
- Descending into squat, hips moving back
- Knees beginning to bend, tracking over toes
- Torso leaning forward slightly
- Quads beginning to glow orange-amber

**Frame C (Bottom-Left):**
- Lowest point of squat
- Thighs appear roughly parallel to ground (borderline depth)
- Knees over toes, heels planted
- Quads and glutes glowing orange-amber

**Frame D (Bottom-Right):**
- Ascending from bottom position
- Hips and shoulders rising together
- Bar path appears vertical
- Quads and glutes still glowing

**AI Artifact Check:**
- Limb count: 2 arms, 2 legs — OK
- Finger count: 5 per hand — OK
- Face/head: Simple Wii-style face, bald — OK
- Warping/melting: None detected

---

### 2. Exercise Identified

**Exercise:** Barbell Back Squat
**Confidence:** High — barbell on upper back, bilateral squat movement clearly shown

---

### 3. Research — Correct Form

Barbell back squat: bar rests on upper traps (high bar) or rear delts (low bar), 
feet shoulder-width or wider with toes angled out 15-30°. Descent initiates by 
pushing hips back and down while keeping chest up. At bottom, hip crease should 
be at or below knee level (parallel or deeper). Ascent drives through heels with 
hips and shoulders rising at the same rate.

**Key cues:**
- "Chest up, shoulders back"
- "Knees track over toes"
- "Hip crease below knee at bottom"
- "Drive through heels"

**Common mistakes:**
- Knees caving inward
- Excessive forward lean / "good morning" squat
- Not hitting depth (half-squat)
- Heels rising off ground

---

### 4. Comparison — Frame-by-Frame Analysis

**Frame A (Starting Position):**
- Expected: Standing tall, bar on upper back, neutral spine
- Observed: Standing with bar on traps, good posture
- Match: ✅
- Notes: Setup looks correct

**Frame B (Phase 1 — Descent):**
- Expected: Hips back, knees tracking out, chest up
- Observed: Hips initiating, knees tracking well, slight forward lean
- Match: ⚠️
- Notes: Torso angle is more forward than ideal (maybe 45° vs preferred 60°+)

**Frame C (Phase 2 — Bottom):**
- Expected: Hip crease at or below knee, full depth
- Observed: Hip crease appears AT knee level, borderline parallel
- Match: ⚠️
- Notes: Depth is acceptable but not clearly below parallel — could teach "half squat"

**Frame D (Phase 3 — Ascent):**
- Expected: Hips and shoulders rise together, bar path vertical
- Observed: Good ascent mechanics, bar stays over midfoot
- Match: ✅
- Notes: Return phase looks correct

---

### 5. Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Physical Possibility | ✅ | Correct limb count, natural joint angles, no artifacts |
| Exercise Form Accuracy | ⚠️ | Depth borderline, forward lean in Frame B |
| Muscle Glow | ✅ | Quads and glutes highlighted correctly with orange-amber |
| Character Consistency | ✅ | Bald, navy tank, athletic build, consistent across frames |
| Composition | ✅ | Full body visible, clean background, good lighting |

---

### 6. Issues Found

| # | Issue | Severity | Frame(s) | Fix Suggestion |
|---|-------|----------|----------|----------------|
| 1 | Squat depth borderline | Medium | C | Add to prompt: "deep squat with hip crease clearly below knee level" |
| 2 | Excessive forward lean | Minor | B | Add to prompt: "maintain upright torso throughout descent" |

---

### Verdict: 🟡 FLAG

Usable for general reference but depth issue may teach incorrect form to beginners. 
The squat should clearly show hip crease BELOW knee level in Frame C.

**Recommended prompt modification:**
Add: "Deep squat with hip crease clearly below knee level, maintaining upright torso throughout"
```

---

## Usage in Claude Code

```bash
# Review a specific file
/m-review media/images/barbell-squat.webp

# Review with explicit exercise name (if filename is unclear)
/m-review media/images/exercise_001.webp "Barbell Squat"

# Review last generated file
/m-review

# Review all pending in a folder
/m-review media/images/pending/
```

### Exercise Name Resolution (Priority Order)

1. **Explicit name provided** — `/m-review file.webp "Barbell Squat"` → uses "Barbell Squat"
2. **Parsed from filename** — `barbell-squat.webp` → converts to "Barbell Squat"
3. **Visual identification** — Agent identifies from what it sees in the media
4. **Ask user** — If still unclear, prompt: "What exercise is this?"

---

## Notes

- This agent uses web search to research correct exercise form before comparing
- For yoga poses, it searches for Sanskrit name + alignment cues
- For breathwork, it verifies visible breathing mechanics (chest/belly expansion)
- The agent is intentionally strict — better to reject and regenerate than ship incorrect form
- Reviews should take 30-60 seconds per image, 1-2 minutes per video
