# Swapping the character model + animations (Tinkercad → Mixamo → Game)

This guide walks you through **everything step-by-step** to replace the player character model and animations in this project.

You will:
1. Build a **T-pose** character in **Tinkercad**
2. Auto-rig it in **Mixamo**
3. Download a **rigged base FBX** + several **animation FBX** files (**always “In Place”**)
4. Add those FBX files to your project
5. Point your game’s `CONFIG` variables to the new files and tune scale/offset/rotation

> **Important:** Every Mixamo animation you download for this project should be an **“In Place”** animation (turn **ON** the “In Place” checkbox in Mixamo whenever it appears).  
> If you don’t do this, the character will “run forward” inside the animation file and it will fight against the physics-driven movement in the game.

---

## How the game uses your FBX files (mental model)

In this project:
- The **player physics** (a capsule collider) moves the character around.
- The **player model** is just a visual mesh that gets positioned/rotated to follow the physics capsule.
- Animations are chosen automatically in the main game loop:
  - `idle` when standing still
  - `move` when running
  - `in_air` when jumping/falling
  - `climb` when wall-climbing

You control the files used for those animations via `CONFIG` in `basic_game.html`:

```js
PLAYER_FBX_IDLE: "/static/models/player_custom/idle.fbx",
PLAYER_FBX_MOVE: "/static/models/player_custom/move.fbx",
PLAYER_FBX_IN_AIR: "/static/models/player_custom/in_air.fbx",
PLAYER_FBX_CLIMB: "/static/models/player_custom/climb.fbx",
```

And you align the model (visual-only) using:

```js
PLAYER_MODEL_SCALE: new THREE.Vector3(...),
PLAYER_MODEL_OFFSET: new THREE.Vector3(...),
PLAYER_MODEL_ROTATION: new THREE.Euler(...),
```

---

# Part 1 — Make a T-pose character in Tinkercad

## 1.1 Create a new design
1. Go to **Tinkercad** → **Create new design**
2. Set a comfortable unit system (mm is fine—scale will be corrected later anyway)

## 1.2 Build a “Mixamo-friendly” character shape
Mixamo’s auto-rigger works best when:
- the character is a **single connected mesh** (one object)
- limbs are clearly separated from the torso (not fused into a blob)
- the pose is a clean **T-pose**:
  - arms straight out to the sides (like a “T”)
  - legs slightly apart (not touching)
  - no weird overlaps (hands intersecting hips, legs intersecting, etc.)

### Simple recommended proportions
You don’t need perfection; you need **readable joints**.

- Head: sphere / rounded box
- Torso: box / cylinder
- Upper arms + forearms: cylinders
- Hands: small boxes
- Upper legs + lower legs: cylinders
- Feet: boxes

### Tips that help rigging succeed
- Keep the character **standing upright** (Y axis up)
- Avoid tiny detached accessories until you’ve confirmed rigging works
- Make sure **arms don’t touch the torso**
- Make sure **legs don’t touch each other**
- Avoid “floating pieces” (like separate eyes not attached)

## 1.3 Combine into one solid export
Tinkercad exports your design as a single mesh, but try to:
- **Group** your shapes if possible (so it behaves like one object)
- Remove any base plate or floor you used for positioning

## 1.4 Export from Tinkercad
1. Click **Export**
2. Choose **OBJ** (recommended for Mixamo uploads)  
   - If OBJ isn’t available for your plan, STL can work, but OBJ tends to be friendlier.
3. Download the exported file to your computer

---

# Part 2 — Rig the character in Mixamo (Auto-Rigger)

## 2.1 Upload your model
1. Go to **Mixamo**
2. Click **Upload Character**
3. Upload the **OBJ** you exported from Tinkercad  
   - If Mixamo asks for textures, ignore that for now (you can add textures later)

## 2.2 Place the rig markers (this part matters)
Mixamo will show your character with markers.

1. **Chin** marker: place it under the head, where the jaw would be
2. **Wrists**: place at the bend point between hand and forearm
3. **Elbows**: place at the arm hinge
4. **Knees**: place at the knee hinge
5. **Groin**: place where the legs meet the torso

Then press **Next**.

### Skeleton type choice
Mixamo sometimes offers skeleton options like:
- Standard
- “No Fingers” vs “With Fingers”

If your Tinkercad model has very simple hands, choose the simpler option.

## 2.3 Confirm the rigged preview
Mixamo will generate a rig and show a preview animation.

Before downloading anything, verify:
- Arms bend correctly at elbows
- Legs bend correctly at knees
- The character doesn’t explode into pieces

If it looks wrong:
- Go back and adjust marker placement
- Consider separating arms/legs slightly more in Tinkercad and re-upload

---

# Part 3 — Download the rigged base model (T-pose FBX)

This “base model” is the one your game loads as the skinned mesh.

1. On your rigged character page, open the **Download** panel
2. Use these settings (good defaults):

- **Format:** `FBX` (Binary if there’s a choice)
- **Skin:** `With Skin`
- **Frames Per Second:** `30` (or default)
- **Keyframe Reduction:** `None` (or default)

3. Download it and rename it something like:

- `player_rig.fbx`

---

# Part 4 — Download the animations (Idle / Move / In-Air / Climb)

## 4.1 The “In Place” rule (always)
When you select an animation in Mixamo, look for a checkbox:

✅ **In Place**  
Turn it **ON** whenever it’s available.

**Why:** Your game’s physics capsule already moves the player around.  
If your animation includes forward translation, the character will “moonwalk” or drift away from the capsule.

## 4.2 Choose and download these four animations

### A) Idle
Search for something like:
- “Idle”
- “Standing Idle”

Download settings:
- **Format:** FBX
- **In Place:** ON (if available)
- **Skin:** `Without Skin` (recommended for animation files)

Rename to:
- `idle.fbx`

### B) Move (walk/run)
Search for:
- “Walking”
- “Running”

Download:
- **In Place:** ON
- **Skin:** Without Skin

Rename to:
- `move.fbx`

### C) In Air (jump / fall)
Search for:
- “Jump”
- “Falling”
- “Jumping Down”
- “Run Jump”

Download:
- **In Place:** ON
- **Skin:** Without Skin

Rename to:
- `in_air.fbx`

### D) Climb
Search for:
- “Climb”
- “Climbing Ladder”
- “Rock Climb”

Download:
- **In Place:** ON
- **Skin:** Without Skin

Rename to:
- `climb.fbx`

> **Critical:** Download all animations from the **same character** (your uploaded rigged model).  
> Don’t switch to a different Mixamo character for some animations—bones won’t match.

---

# Part 5 — Put the FBX files into your project

## 5.1 Create a folder for your character assets
A common pattern is:

```
static/models/player_custom/
```

Place these files inside:

- `player_rig.fbx`
- `idle.fbx`
- `move.fbx`
- `in_air.fbx`
- `climb.fbx`

## 5.2 Verify the files are served by your web server
Your HTML loads these by URL, so they must be reachable at runtime, for example:

- `/static/models/player_custom/player_rig.fbx`

---

# Part 6 — Update the code to use your new FBX files

Open `basic_game.html` and update the `CONFIG` paths.

## 6.1 Update animation file paths
Replace the old paths with your new ones:

```js
PLAYER_FBX_IDLE: "/static/models/player_custom/idle.fbx",
PLAYER_FBX_MOVE: "/static/models/player_custom/move.fbx",
PLAYER_FBX_IN_AIR: "/static/models/player_custom/in_air.fbx",
PLAYER_FBX_CLIMB: "/static/models/player_custom/climb.fbx",
```

## 6.2 Update the base model path (if your project uses one)
Some projects load a “base mesh FBX” and then load animation clips from the animation FBXs.

- If you already have a config variable for the base model, point it to:
  ```js
  PLAYER_FBX_MODEL: "/static/models/player_custom/player_rig.fbx",
  ```

- If you **don’t** have a separate base-model config variable, your project may be using one of the FBXs as the base mesh. In that case:
  - Quick workaround: download your **idle** as **With Skin** and use that as the base.
  - Cleaner approach: add a `PLAYER_FBX_MODEL` config variable and update the loader code to use it.

---

# Part 7 — Align the model to the physics capsule (scale / offset / rotation)

Even if everything loads, your model will probably be:
- too big or too small
- sunk into the ground
- rotated the wrong way (walking sideways/backwards)

That’s normal. Fix it with these three config variables:

## 7.1 Scale
Start by adjusting scale until it matches the capsule size.

```js
PLAYER_MODEL_SCALE: new THREE.Vector3(0.05, 0.05, 0.05),
```

If your model looks gigantic, try `0.01`.  
If it’s tiny, try `0.1`.

## 7.2 Offset
Offset moves the model relative to the physics capsule.

Most commonly you’ll adjust **Y** to make feet touch the ground:

```js
PLAYER_MODEL_OFFSET: new THREE.Vector3(0, -4, 0),
```

- More negative Y moves the model **down**
- More positive Y moves the model **up**

## 7.3 Rotation
If your model faces the wrong direction, rotate it:

```js
PLAYER_MODEL_ROTATION: new THREE.Euler(0, Math.PI, 0),
```

Try these common fixes:
- flip 180°: `Math.PI`
- rotate 90°: `Math.PI / 2`
- rotate -90°: `-Math.PI / 2`

---

# Part 8 — Troubleshooting (common problems + fixes)

## Problem: character “slides forward” during run animation
Cause: You downloaded a non-in-place animation.

Fix:
- Re-download that animation with ✅ **In Place ON**

## Problem: character moves but stays stuck in T-pose
Common causes:
- Animation FBX doesn’t contain a clip
- Bones don’t match (downloaded from a different character)
- Loader expects “first clip” but your file is missing one

Fix:
- Re-download animations from your uploaded character
- Try downloading **With Skin** once to confirm it contains animation data

## Problem: character is rotated sideways/backwards while moving
Fix:
- Adjust `PLAYER_MODEL_ROTATION` (start with `Math.PI` yaw)
- If movement animation direction feels inverted (walking backward), you may need a 180° yaw fix.

## Problem: character is floating or sunk into ground
Fix:
- Adjust `PLAYER_MODEL_OFFSET.y`
- If the *physics capsule* is wrong size, also adjust:
  - `PLAYER_RADIUS`
  - `PLAYER_HEIGHT`

## Problem: Mixamo rigging looks broken (arms twisting / legs weird)
Fix:
- Improve Tinkercad pose:
  - arms not touching torso
  - legs separated
  - elbows/knees clearly shaped
- Re-upload and redo marker placement carefully

---

# Part 9 — Quick checklist recap

✅ Tinkercad: clean T-pose, single connected mesh, limbs separated  
✅ Mixamo: upload → marker placement → auto-rig preview looks good  
✅ Download base: FBX, **With Skin**  
✅ Download animations: FBX, **In Place ON**, usually **Without Skin**  
✅ Place files under `static/models/...`  
✅ Update `CONFIG.PLAYER_FBX_*` paths  
✅ Tune `PLAYER_MODEL_SCALE / OFFSET / ROTATION`
