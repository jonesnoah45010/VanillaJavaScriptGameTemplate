# GameCore Documentation


## game_core.js helper functions guide (and how to make noticeable changes in basic_game.html)

This document walks through the helper functions inside `game_core.js`, ordered from **easy/visual changes** (adding obstacles / environment) to **deeper mechanics changes** (movement, climbing, animation, camera). Every example ties back to this core idea:

- **`start()` in `basic_game.html` runs once** at game boot. Put *setup* work here: spawning obstacles, setting config values, loading assets, etc.
- **`update(dt)` in `basic_game.html` runs every frame** (the main loop). Put *ongoing* work here: time-based logic, win/lose rules, AI, spawning over time, powerups, etc.

In base  project, the loop is:

```js
async function start() {
  await startCore(state, CONFIG);  // run once
  requestAnimationFrame(frame);
}

function update(dt) {
  stepCore(state, CONFIG, dt);     // run every frame
}
```

So: **`startCore()` is the “do all the initialization” helper**, and **`stepCore()` is the “do one frame” helper**.

---

## 0) Big picture: exported vs internal helpers

### Exported (called directly by `basic_game.html`)
These are the only functions imported in `basic_game.html`:

- `createGameState()`
- `startCore(state, CONFIG)` (async)
- `stepCore(state, CONFIG, dt)`

Everything else in `game_core.js` is a helper that `startCore()` or `stepCore()` uses.

### Internal helpers (called by the exported ones)
The file is organized in a fairly clean pipeline:

**Startup path** (`startCore()` calls these once):
- `initThree()`, `createDebugUI()`, `initPhysics()`
- `createSkySphere()`, `createPlane()`, `createLighting()`
- `createStaticGroundCollider()`, `spawnEnvironment()`
- `createPlayer()`, `bindKeys()`, `setDebugMode()`

**Per-frame path** (`stepCore()` calls these every frame):
- physics step
- `updatePlayerContacts()`, `handleInput()`
- `syncVisualsFromPhysics()`
- `updatePlayerAnimationState()`
- `updateCamera()`, render

That is the mental model you’ll use for every change.

---

## 1) The state object: `createGameState()`

### What it does
`createGameState()` returns a “single source of truth” state object that holds:

- Three.js: `scene`, `camera`, `renderer`
- Ammo.js: `physicsWorld`, `dispatcher`, `tmpTransform`
- Player: physics body (`Player`), visuals, animations, grounded/wall/climb flags
- Debug: toggles, debug meshes, axis helpers
- Shared loaders: texture loader, OBJ/MTL loaders, clock, etc.

### How to use it in `basic_game.html`
We already do:

```js
let state = createGameState();
```

**Noticeable changes you can make here**
- Add your own custom properties to state (ex: score, timers, enemy list), then update them in the main loop:

```js
let state = createGameState();
state.score = 0;
state.spawnTimer = 0;
```

Then in `update(dt)` you can do:

```js
state.spawnTimer += dt;
if (state.spawnTimer > 3) {
  state.spawnTimer = 0;
  state.score += 1;
  console.log("score", state.score);
}
```
The example above would create a score value that increases by 1 every 3 seconds.

---

## 2) Startup pipeline: `startCore(state, CONFIG)` (runs once)

### What it does
`startCore()` is the core boot procedure:

1. Initializes Ammo, then creates Three scene/camera/renderer
2. Creates debug UI (optional collider visualization)
3. Builds physics world (gravity)
4. Creates sky, plane, lighting
5. Creates static ground collider
6. Spawns environment (crates, buildings, border rocks)
7. Creates player (capsule body + FBX visual + animations)
8. Binds input keys
9. Applies debug mode & camera defaults

### Where you “hook in”
In `basic_game.html`, you can do extra one-time setup *after* `startCore()` finishes:

```js
async function start() {
  await startCore(state, CONFIG);

  // Custom “run once” setup goes here:
  // e.g., tweak config, add timers, spawn extra things (see sections below)

  requestAnimationFrame(frame);
}
```

---

## 3) Per-frame pipeline: `stepCore(state, CONFIG, dt)` (runs every frame)

### What it does
One frame of the game:

1. Physics: `physicsWorld.stepSimulation(dt, 1)`
2. Contacts: `updatePlayerContacts()`
3. Input: `handleInput()`
4. Sync physics → visuals: `syncVisualsFromPhysics()`
5. Animation state switching: `updatePlayerAnimationState()` and mixer update
6. Camera follow: `updateCamera()`
7. Render

### Where you “hook in”
In `basic_game.html`, you can do extra logic before/after core step or, alternatively, add within the stepCore function itself in game_core.js:

```js
function update(dt) {
  // pre-step: read inputs, do AI intentions, timers, etc.

  stepCore(state, CONFIG, dt);

  // post-step: detect win/lose, clamp score, spawn/despawn, etc.
}
```

---

# PART A — Simple / visible changes (environment & obstacles)

## 4) Three.js setup: `initThree()` + `onResize()`

### What it does
- Creates `scene`, `camera`, `renderer`
- Adds pointer-lock camera controls (mouse yaw/pitch)
- Adds scroll-wheel zoom
- Handles resize

### Noticeable changes you can make
**A) Camera “feel” (quick win):** adjust values in `CONFIG` in `basic_game.html`

```js
CONFIG.CAMERA_MIN_DISTANCE = 10;
CONFIG.CAMERA_MAX_DISTANCE = 80;
CONFIG.MOUSE_YAW_SENSITIVITY = 0.0015;
CONFIG.MOUSE_PITCH_SENSITIVITY = 0.0010;
```

**B) Rendering quality/perf:**
Inside `initThree()` you can add:

```js
state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```

---

## 5) Debug UI: `createDebugUI()`, `setDebugMode()`, `createAxes()`

### What it does
- Builds the “Controls + Debug Colliders” panel
- Toggles visibility of:
  - player collider mesh
  - debug meshes for obstacles
  - axes helpers

### Noticeable changes you can make
**A) Add your own UI controls**
Add another checkbox or button in `createDebugUI()` and wire it to a `CONFIG` value or a `state` value.

Example: “Low gravity” toggle:

```js
// inside createDebugUI() after checkbox wiring:
const lowG = document.createElement("button");
lowG.textContent = "Toggle Low Gravity";
lowG.onclick = () => {
  CONFIG.GRAVITY = (CONFIG.GRAVITY < -5) ? -2.0 : -9.81;
  state.physicsWorld.setGravity(new Ammo.btVector3(0, CONFIG.GRAVITY, 0));
};
ui.appendChild(lowG);
```

**B) Debug-only design workflow**
Turn debug mode on, place obstacles, and visually verify colliders:

```js
CONFIG.DEBUG_MODE = true;
```

---

## 6) Basic environment visuals: `createSkySphere()`, `createPlane()`, `createLighting()`

### What they do
- Sky sphere with a sky texture
- Grass plane mesh (visual-only)
- Ambient + directional light

### Noticeable changes you can make
**A) Swap textures** by changing the texture paths in these helpers.

**B) Make the world feel “night”**
Lower ambient light, add a bluish directional (or even add a point light):

```js
// in createLighting()
state.scene.add(new THREE.AmbientLight(0xffffff, 0.2));
const light = new THREE.DirectionalLight(0xffffff, 0.6);
light.position.set(-20, 40, -10);
state.scene.add(light);
```

---

## 7) Physics ground: `createStaticGroundCollider()`

### What it does
- Adds an Ammo static plane collider at y=0
- Adds a debug wireframe box to represent it

### Noticeable changes you can make
**A) “Floating” ground**
Raise the ground plane:

```js
transform.setOrigin(new Ammo.btVector3(0, 10, 0)); // was 0
```

If you do this, also adjust `CONFIG.GROUND_PLANE_Y` and any logic that uses it.

---

## 8) Simple obstacles: `createBoxDynamic()` (the easiest spawner)

### What it does
Creates a **dynamic** physics box (it can move) with:
- Ammo `btBoxShape`
- debug wireframe mesh
- optional OBJ/MTL visual that follows physics
- pushes into `state.gameObjects` so `syncVisualsFromPhysics()` moves it each frame

### How to add boxes to your map (easy)
Right now, boxes are spawned inside `spawnEnvironment()`.

To add more crates: copy the pattern used for `crate1` and `crate2`:

```js
createBoxDynamic(
  state,
  CONFIG,
  new THREE.Vector3(0, 0, 80),        // position
  new THREE.Vector3(6, 6, 6),         // size
  2.0,                                // mass (bigger = heavier)
  crateOpts,                           // optional visual model
  "crate3"                             // name
);
```

### Make it “noticeable”
- Increase mass and drop it from higher up:

```js
createBoxDynamic(state, CONFIG, new THREE.Vector3(0, 30, 80), new THREE.Vector3(10, 10, 10), 10.0, crateOpts, "bigCrate");
```

---

## 9) Border / pillars: `createCapsuleObstacle()` (static or dynamic)

### What it does
Creates an Ammo capsule collider (useful for rocks/pillars):
- static if `mass = 0`
- dynamic if `mass > 0`
- optional OBJ/MTL visual
- debug capsule mesh + axes

### Example: add “pillars” inside the map
Inside `spawnEnvironment()`:

```js
createCapsuleObstacle(
  state,
  CONFIG,
  new THREE.Vector3(0, 0, 0),  // center
  3,                           // radius
  30,                          // height
  0,                           // mass 0 = static
  null,
  "pillar1"
);
```

---

## 10) Static concave obstacles: `createStaticTrimeshObstacleFromObjMtl()` (main “map building” tool)

### What it does
This is the key function for **static concave colliders**:
- Loads OBJ/MTL for the *visual*
- Builds an Ammo triangle mesh collider (`btBvhTriangleMeshShape`)
- The triangles are baked into **world space**, so the physics body sits at identity
- Adds a debug wireframe version of the triangles (debug-only)

### Why it matters
Box/capsule colliders are fast but simple. Trimesh colliders let you:
- use irregular architecture
- make “real” buildings, ramps, caves, etc.
- have believable climbing/wall contact behavior

### Easiest workflow: add static trimesh obstacles in `spawnEnvironment()`
You already have skyscrapers being created with this function. To add another:

```js
const myBuilding = {
  objPath: "/static/models/my_building/tinker.obj",
  mtlPath: "/static/models/my_building/obj.mtl",
  scale: new THREE.Vector3(1, 1, 1),
  rotation: new THREE.Euler(Math.PI / 2, Math.PI, Math.PI),
  offset: new THREE.Vector3(0, 0, 0),
};

createStaticTrimeshObstacleFromObjMtl(
  state,
  CONFIG,
  new THREE.Vector3(50, 0, 50),
  myBuilding,
  "myBuilding1"
);
```

### Common “why is my collider wrong?” checklist
1. **Rotation & axis conventions**: many OBJ exports need a `-Math.PI/2` or `Math.PI/2` correction.
2. **Offset**: the visual position is `position + offset`. Use offset to align OBJ origin with the collider placement.
3. **Scale**: collider triangles are built from the scaled visual object. If scale is wrong, collider is wrong.

### Make it “noticeable” quickly
Add a *wall maze* out of a few static trimesh buildings:

```js
const wall = { objPath: "/static/models/skyScraper/tinker.obj", mtlPath: "/static/models/skyScraper/obj.mtl",
  scale: new THREE.Vector3(0.15, 0.15, 0.15),
  rotation: new THREE.Euler(Math.PI / 2, Math.PI, Math.PI),
  offset: new THREE.Vector3(-1, 0, 0),
};

for (let i = 0; i < 8; i++) {
  createStaticTrimeshObstacleFromObjMtl(state, CONFIG, new THREE.Vector3(-200 + i*60, 0, 0), wall, `mazeWall${i}`);
}
```

---

## 11) Environment composition: `spawnEnvironment()`

### What it does
Defines the “map”:
- crates (dynamic boxes)
- skyscrapers (static trimesh)
- rock wall border (capsule obstacles)

### Recommended implementation pattern
Treat `spawnEnvironment()` as your “level script.” Keep it readable:

```js
function spawnEnvironment(state, CONFIG) {
  spawnCrates(state, CONFIG);
  spawnBuildings(state, CONFIG);
  spawnBorders(state, CONFIG);
  spawnYourCustomStuff(state, CONFIG);
}
```

Even if you keep it in one function, conceptually you’ll want that structure.

---

# PART B — Mechanics changes (movement, climbing, animation, camera)

## 12) Player creation: `createPlayer()` + FBX loader helpers

### What it does
- Creates Ammo capsule rigid body for the player
- Applies starting yaw
- Creates debug capsule mesh
- Loads FBX model for visuals
- Loads 3 other FBX files as animation clips
- Sets up a Three.js `AnimationMixer` and action clips

Helper functions here:
- `loadFBX()`
- `loadFirstClipFromFBX()`
- `playPlayerAction()`
- `applyMoveAnimDirection()`

### Noticeable changes you can make (from `basic_game.html`)
Most player “feel” changes are in `CONFIG`:

- Size/weight:
```js
CONFIG.PLAYER_RADIUS = 1.5;
CONFIG.PLAYER_HEIGHT = 6;
CONFIG.PLAYER_MASS = 2;
```

- Jump:
```js
CONFIG.PLAYER_JUMP_IMPULSE = 35;
```

- Top speed and snappiness:
```js
CONFIG.PLAYER_MAX_SPEED = 22;
CONFIG.PLAYER_ACCEL = 80;
CONFIG.PLAYER_BRAKE = 95;
```

### Replace animations
Point `CONFIG.PLAYER_FBX_*` to new FBX files. If the animation directions look flipped, adjust `applyMoveAnimDirection()` logic or your model’s forward axis.

---

## 13) Input plumbing: `bindKeys()` + `handleInput()`

### What they do
- `bindKeys()` listens for keydown/keyup and stores into `state.keys`
- `handleInput()` reads keys every frame and decides:
  - turning
  - forward/back axis
  - climb gating
  - jump / wall jump
  - whether to apply ground movement or wall climb

### Add new controls (example: sprint)
**Step 1: add config**
In `basic_game.html`:

```js
CONFIG.PLAYER_SPRINT_MULT = 1.6;
```

**Step 2: apply it in `handleInput()`**
In `game_core.js` inside `handleInput()`:

```js
const sprint = state.keys["ShiftLeft"] || state.keys["ShiftRight"];
const speedMult = sprint ? CONFIG.PLAYER_SPRINT_MULT : 1.0;

// when calling applyCharacterMovement:
if (!state.playerClimbing) applyCharacterMovement(state, { ...CONFIG, PLAYER_MAX_SPEED: CONFIG.PLAYER_MAX_SPEED * speedMult }, moveAxis, dt);
```

A cleaner alternative: pass `speedMult` into `applyCharacterMovement()` and multiply the desired speed there.

---

## 14) Ground detection: `isGrounded()` + `isGroundedRay()`

### What they do
- `isGrounded()` is the main decision: it returns true if:
  - physics contacts say grounded (`state.playerGrounded`), OR
  - a downward ray test hits within some threshold
- `isGroundedRay()` does the Ammo ray test

### Why you’d change this
Grounding affects:
- whether you can jump
- whether movement is “ground” vs “air”
- whether you can start climbing logic
- which animation plays

### Noticeable tuning knobs
In `basic_game.html`:
- `GROUND_BAND_FRACTION` (how far up the capsule counts as “ground contact”)
- `GROUND_NORMAL_MIN_Y` (how “upward” a surface normal must be)
- `ANIM_AIR_MIN_TIME` (how long before in-air anim triggers)

---

## 15) Movement physics: `applyCharacterMovement()` + `turn()`

### What it does
- Computes forward direction from player’s rigid body rotation
- Accelerates or brakes toward a target velocity
- Applies strafe dampening (optional)
- Clamps max speed
- Adds special logic for wall sliding (limits fall speed, prevents moving “into” wall)

### The best “game feel” changes (fast)
In `basic_game.html` tune:

```js
CONFIG.PLAYER_ACCEL = 90;
CONFIG.PLAYER_BRAKE = 120;
CONFIG.PLAYER_AIR_ACCEL = 10;
CONFIG.PLAYER_AIR_BRAKE = 6;
CONFIG.PLAYER_MID_AIR_DAMPEN = 0.35;
CONFIG.PLAYER_USE_STRAFE_DAMP = true;
```

### Example: add “ice level” feel (slippery)
Lower friction and reduce braking:

```js
CONFIG.PLAYER_DEFAULT_FRICTION = 0.2;
CONFIG.PLAYER_BRAKE = 10;
CONFIG.PLAYER_SIDE_DAMP_GROUND = 1.0;
```

This will feel dramatically different.

---

## 16) Wall contact + climbing: `updatePlayerContacts()`, `applyWallClimb()`, `wallJumpOff()`

### What they do
- `updatePlayerContacts()` inspects contact manifolds from Ammo and sets:
  - `state.playerGrounded`
  - `state.playerOnWall`
  - `state.playerWallNormal`
- `applyWallClimb()` pulls player slightly into wall + moves upward
- `wallJumpOff()` launches away from wall + upward

### Make climbing harder or easier
In `basic_game.html`:
- Harder to start climbing:
```js
CONFIG.WALL_CLIMB_MIN_NORMAL = 0.9; // must be a “real wall”
CONFIG.WALL_CLIMB_EXIT_COOLDOWN = 0.6;
```

- Faster climb, stickier to wall:
```js
CONFIG.WALL_CLIMB_SPEED = 14;
CONFIG.WALL_CLIMB_STICK_SPEED = 6;
```

- “No wall climbing” mode:
```js
CONFIG.WALL_CLIMB_MIN_NORMAL = 999; // effectively never true
```

---

## 17) Animation logic: `updatePlayerAnimationState()`

### What it does
Chooses between:
- `idle`
- `move`
- `in_air`
- `climb`

based on:
- climb flags
- grounded checks
- horizontal speed
- a small “air latch” delay (`ANIM_AIR_MIN_TIME`) to avoid flicker

### Make the game feel different via animation gating
If you want “arcade” behavior, switch to in-air immediately:

```js
CONFIG.ANIM_AIR_MIN_TIME = 0.0;
```

Or add a “landing” animation by introducing a new state and a timer. Pattern:

1. Add new clip to `createPlayer()`
2. Add state machine branch in `updatePlayerAnimationState()`

---

## 18) Physics → visuals: `syncVisualsFromPhysics()`

### What it does
For every object in `state.gameObjects`, it:
- reads physics transform from Ammo
- updates debug mesh, axes, and optional visual model
Then does similar sync for the player visuals.

### Why it matters
Any time you add a new physics object that should be visible, you want to:
- store it in `state.gameObjects`
- provide `visual`, `visualOffset`, `visualRotationOffset` if needed

If you forget to push into `state.gameObjects`, the physics body will exist but you won’t see it move.

---

## 19) Camera “feel”: `getDynamicMinPitch()` + `updateCamera()`

### What it does
- Follows the player at a distance
- Uses yaw/pitch set by mouse input
- Enforces min/max pitch, with a special case when the player is high above the ground
- Smoothly lerps camera position

### Quick “noticeable” camera changes
In `basic_game.html`:

```js
CONFIG.CAMERA_VERTICAL_OFFSET = 35;   // higher camera
CONFIG.CAMERA_DEFAULT_PITCH = 0.75;   // steeper tilt
CONFIG.CAMERA_MIN_DISTANCE = 8;       // closer
CONFIG.CAMERA_MAX_DISTANCE = 25;
```

### Example: add camera shake on landing (mechanics + feel)
You need a per-frame hook in `basic_game.html`:

```js
let lastGrounded = false;
let shake = 0;

function update(dt) {
  const groundedNow = state.playerGrounded;

  if (!lastGrounded && groundedNow) {
    shake = 0.25; // start shake on landing
  }
  lastGrounded = groundedNow;

  stepCore(state, CONFIG, dt);

  if (shake > 0 && state.camera) {
    shake = Math.max(0, shake - dt);
    state.camera.position.y += Math.sin(performance.now() * 0.02) * shake * 0.5;
  }
}
```

This is a good example of “your code in update() changes mechanics/feel in the main loop.”

---

# PART C — Practical extension patterns (how to avoid forking too hard)

## 20) Pattern: “Expose a spawner” to basic_game.html (recommended)

Right now, important spawners like `createStaticTrimeshObstacleFromObjMtl()` are internal to `game_core.js`. If you want to spawn things from `basic_game.html` **without editing the core map function each time**, export a small API:

In `game_core.js`:

```js
export function spawnStaticTrimesh(state, CONFIG, position, modelOptions, name) {
  return createStaticTrimeshObstacleFromObjMtl(state, CONFIG, position, modelOptions, name);
}
```

Then in `basic_game.html`:

```js
import { spawnStaticTrimesh } from "/static/js/game_core.js";

async function start() {
  await startCore(state, CONFIG);

  spawnStaticTrimesh(state, CONFIG, new THREE.Vector3(0,0,200), {
    objPath: "/static/models/skyScraper/tinker.obj",
    mtlPath: "/static/models/skyScraper/obj.mtl",
    scale: new THREE.Vector3(0.25, 0.25, 0.25),
    rotation: new THREE.Euler(Math.PI/2, Math.PI, Math.PI),
    offset: new THREE.Vector3(-1,0,0),
  }, "extraBuilding");

  requestAnimationFrame(frame);
}
```

This keeps your “level scripting” close to the game page.

---

## 21) Pattern: Put game rules in `update()` (main loop mechanics)

Examples of “mechanics” logic that belongs in `update()`:

- timed spawning waves
- score and win/lose conditions
- stamina / sprint meters
- checkpoints / respawn
- pickups / buffs
- enemy AI

### Example: checkpoint + respawn
Add to `basic_game.html`:

```js
state.checkpoint = CONFIG.PLAYER_STARTING_POSITION.clone();
state.fallY = -50;

function respawn() {
  const t = new Ammo.btTransform();
  t.setIdentity();
  t.setOrigin(new Ammo.btVector3(state.checkpoint.x, state.checkpoint.y + CONFIG.PLAYER_HEIGHT/2, state.checkpoint.z));
  state.Player.setWorldTransform(t);
  state.Player.getMotionState().setWorldTransform(t);
  state.Player.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
  state.Player.activate();
}

function update(dt) {
  stepCore(state, CONFIG, dt);

  // post-step: check fall-out
  state.Player.getMotionState().getWorldTransform(state.tmpTransform);
  const o = state.tmpTransform.getOrigin();
  if (o.y() < state.fallY) respawn();
}
```

---

# Appendix: Function-by-function reference (quick notes)

## Exported
- `createGameState()` → allocate everything the core needs.
- `startCore(state, CONFIG)` → *one-time initialization*.
- `stepCore(state, CONFIG, dt)` → *one-frame update*.

## Three.js
- `initThree()` → scene/camera/renderer + pointer lock + mouse.
- `onResize()` → updates camera aspect and renderer size.

## Ammo / Physics
- `initPhysics()` → creates world, dispatcher, solver, sets gravity.

## Debug
- `createDebugUI()` → DOM controls, backquote hotkey.
- `setDebugMode()` → toggles visibility of debug meshes/axes.
- `createAxes()` → axis helper group.

## Environment
- `createSkySphere()` → sky texture on big sphere.
- `createPlane()` → grass plane mesh.
- `createLighting()` → ambient + directional.
- `createStaticGroundCollider()` → static plane collider + debug mesh.
- `createBoxDynamic()` → dynamic box rigid body + optional visual.
- `createCapsuleObstacle()` → capsule rigid body + optional visual.
- `createStaticTrimeshObstacleFromObjMtl()` → static concave trimesh collider from OBJ/MTL.
- `spawnEnvironment()` → level script: crates, buildings, border rocks.

## Player & animation
- `createPlayer()` → capsule physics + FBX model + clips.
- `loadFBX()`, `loadFirstClipFromFBX()` → asset loading.
- `playPlayerAction()` → crossfade between actions.
- `applyMoveAnimDirection()` → play move anim forward/back.

## Input & movement
- `bindKeys()` → fills `state.keys`.
- `handleInput()` → interprets keys; triggers movement/jump/climb.
- `isGrounded()`, `isGroundedRay()` → grounding checks.
- `jump()` → vertical impulse.
- `applyWallClimb()` → climb velocity + stick to wall.
- `wallJumpOff()` → launch away from wall.
- `getPlayerBasis()` → forward/right basis from rigid body rotation.
- `applyCharacterMovement()` → acceleration/braking + wall slide constraints.
- `turn()` → yaw rotation.

## Contacts
- `updatePlayerContacts()` → reads manifolds to set grounded/onWall/wallNormal.

## Visual sync & camera
- `syncVisualsFromPhysics()` → physics → mesh/visual transforms.
- `getDynamicMinPitch()` → camera pitch clamp depending on height.
- `updateCamera()` → follow camera; lerp; lookAt.

---

## Suggested next steps
1. **Add 1–3 new static trimesh obstacles** in `spawnEnvironment()` to build a mini course.
2. **Tune climbing + wall slide constants** in `CONFIG` to get your preferred movement feel.
3. Export one or two spawner helpers so you can author levels directly in `basic_game.html`.
4. Add at least one **main-loop mechanic** (checkpoint, timer, enemy spawner) in `update(dt)`.

