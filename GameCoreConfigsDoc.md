# Configuration reference guide

This document explains **every configurable variable** defined in `basic_game.html`’s `CONFIG` object, what it affects in `game_core.js`, and how changing it will change gameplay or visuals.

Key rule to remember:

- Changes to `CONFIG` in **`start()`** affect *initialization-time* behavior (assets, spawning, initial camera/player setup).
- Changes to `CONFIG` read in **`update(dt)` / `stepCore()`** affect *every-frame* behavior (movement, jumping, climbing, camera follow).

Most variables are read inside `stepCore(state, CONFIG, dt)` (main loop) or `startCore(state, CONFIG)` (startup). In the core file, variables are referenced as `CONFIG.<NAME>`.

---

## How to change CONFIG safely

You can change values directly in `basic_game.html` before `startCore()` runs:

```js
const CONFIG = {
  // ...
  PLAYER_MAX_SPEED: 18,
  PLAYER_ACCEL: 90,
  // ...
};

async function start() {
  await startCore(state, CONFIG);
}
```
Or you can toggle some values at runtime (in the main loop) if you want dynamic difficulty or power-ups:

```js
function update(dt) {
  // Example: temporary low gravity power-up
  if (state.powerupLowG) CONFIG.GRAVITY = -2.5;

  stepCore(state, CONFIG, dt);
}
```
---

## Debug & UI

### `DEBUG_MODE`

- **Default:** `false`
- **Status:** Used in `game_core.js`

Shows/hides debug collider meshes/axes and enables the on-screen Debug UI toggles. Useful for level building and collider alignment.

**Example:**

```js
CONFIG.DEBUG_MODE = true; // show colliders/axes for level building
```
**Where it’s applied (excerpt):**

```js

  await createPlayer(state, CONFIG, CONFIG.PLAYER_STARTING_POSITION);

  bindKeys(state);
  setDebugMode(state, CONFIG, CONFIG.DEBUG_MODE);

  // camera defaults
  state.cameraPitch = CONFIG.CAMERA_DEFAULT_PITCH;
```



### `FADE_SECONDS`

- **Default:** `0.15`
- **Status:** Used in `game_core.js`

UI fade timing (e.g., instructions overlay fade-out) during start/early gameplay.

**Where it’s applied (excerpt):**

```js
  next.reset();
  next.play();

  if (state.playerCurrentAction && !immediate) {
    state.playerCurrentAction.crossFadeTo(next, CONFIG.FADE_SECONDS, false);
  } else if (state.playerCurrentAction && immediate) {
    state.playerCurrentAction.stop();
  }
```



---

## World

### `GRAVITY`

- **Default:** `-9.81`
- **Status:** Used in `game_core.js`

Sets Ammo world gravity (Y axis). More negative = stronger gravity; closer to 0 = floaty.

**Example:**

```js
CONFIG.GRAVITY = -3.0; // floaty
// if you change gravity after start, also update Ammo world gravity:
state.physicsWorld.setGravity(new Ammo.btVector3(0, CONFIG.GRAVITY, 0));
```
**Where it’s applied (excerpt):**

```js
    broadphase,
    solver,
    config
  );
  state.physicsWorld.setGravity(new Ammo.btVector3(0, CONFIG.GRAVITY, 0));
}

// ------------------------------------------------------------
```



### `PLANE_SIZE`

- **Default:** `1000`
- **Status:** Used in `game_core.js`

Size of the visual ground plane mesh (and typically your playable area reference). Bigger = larger visible grass/ground.

**Where it’s applied (excerpt):**

```js

function createPlane(state, CONFIG) {
  state.textureLoader.load("/static/textures/grass.jpg", (texture) => {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.PLANE_SIZE, CONFIG.PLANE_SIZE),
      new THREE.MeshStandardMaterial({ map: texture })
    );
    plane.rotation.x = -Math.PI / 2;
```



### `GROUND_PLANE_Y`

- **Default:** `0`
- **Status:** Used in `game_core.js`

Y position used as the conceptual ground plane height for rays/logic (should match ground collider).

**Where it’s applied (excerpt):**

```js
  ms.getWorldTransform(state.tmpTransform);
  const o = state.tmpTransform.getOrigin();

  const targetPos = new THREE.Vector3(o.x(), o.y(), o.z());
  state.playerHeightAboveGround = targetPos.y - CONFIG.GROUND_PLANE_Y;

  // Initialize yaw/distance once
  if (!state.cameraYawInitialized) {
```



---

## Player visuals & assets (start-time)

### `PLAYER_FBX_IDLE`

- **Default:** `"/static/player_fbx/idle.fbx"`
- **Status:** Used in `game_core.js`

Path to the idle FBX file loaded at start().

**Where it’s applied (excerpt):**

```js

  // FBX visual + anims
  const fbxLoader = new FBXLoader();

  const idleObj = await loadFBX(fbxLoader, CONFIG.PLAYER_FBX_IDLE);
  idleObj.scale.copy(CONFIG.PLAYER_MODEL_SCALE);
  idleObj.rotation.copy(CONFIG.PLAYER_MODEL_ROTATION);
  idleObj.traverse((c) => {
```



### `PLAYER_FBX_MOVE`

- **Default:** `"/static/player_fbx/move.fbx"`
- **Status:** Used in `game_core.js`

Path to the move/run FBX file loaded at start().

**Where it’s applied (excerpt):**

```js

  const idleClip = (idleObj.animations && idleObj.animations.length > 0) ? idleObj.animations[0] : null;

  const [moveClip, inAirClip, climbClip] = await Promise.all([
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_MOVE),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_IN_AIR),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_CLIMB),
  ]);
```



### `PLAYER_FBX_IN_AIR`

- **Default:** `"/static/player_fbx/in_air.fbx"`
- **Status:** Used in `game_core.js`

Path to the jump/fall FBX file loaded at start().

**Where it’s applied (excerpt):**

```js
  const idleClip = (idleObj.animations && idleObj.animations.length > 0) ? idleObj.animations[0] : null;

  const [moveClip, inAirClip, climbClip] = await Promise.all([
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_MOVE),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_IN_AIR),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_CLIMB),
  ]);

```



### `PLAYER_FBX_CLIMB`

- **Default:** `"/static/player_fbx/climb.fbx"`
- **Status:** Used in `game_core.js`

Path to the climb FBX file loaded at start().

**Where it’s applied (excerpt):**

```js

  const [moveClip, inAirClip, climbClip] = await Promise.all([
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_MOVE),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_IN_AIR),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_CLIMB),
  ]);

  if (idleClip)   state.playerActions.idle   = state.playerMixer.clipAction(idleClip);
```



### `PLAYER_MODEL_SCALE`

- **Default:** `new THREE.Vector3(0.05, 0.05, 0.05)`
- **Status:** Used in `game_core.js`

Scale applied to the loaded player FBX model (visual-only).

**Example:**

```js
CONFIG.PLAYER_MODEL_SCALE = new THREE.Vector3(0.08, 0.08, 0.08); // larger visual model
```
**Where it’s applied (excerpt):**

```js
  // FBX visual + anims
  const fbxLoader = new FBXLoader();

  const idleObj = await loadFBX(fbxLoader, CONFIG.PLAYER_FBX_IDLE);
  idleObj.scale.copy(CONFIG.PLAYER_MODEL_SCALE);
  idleObj.rotation.copy(CONFIG.PLAYER_MODEL_ROTATION);
  idleObj.traverse((c) => {
    if (c.isMesh) {
```



### `PLAYER_MODEL_OFFSET`

- **Default:** `new THREE.Vector3(0, -8/2, 0), // overwritten in start() after we know PLAYER_HEIGHT`
- **Status:** Used in `game_core.js`

Offset applied to the player model relative to the physics capsule (visual alignment).

**Where it’s applied (excerpt):**

```js
      state.Player.__axes.position.copy(bodyPos);
      state.Player.__axes.quaternion.copy(bodyQuat);
    }
    if (state.playerVisual) {
      state.playerVisual.position.copy(bodyPos).add(CONFIG.PLAYER_MODEL_OFFSET.clone().applyQuaternion(bodyQuat));
      state.playerVisual.quaternion.copy(bodyQuat).multiply(new THREE.Quaternion().setFromEuler(CONFIG.PLAYER_MODEL_ROTATION));
    }
  }
```



### `PLAYER_MODEL_ROTATION`

- **Default:** `new THREE.Euler(0, 0, 0)`
- **Status:** Used in `game_core.js`

Rotation applied to the player model relative to physics (visual alignment / forward axis).

**Where it’s applied (excerpt):**

```js
  const fbxLoader = new FBXLoader();

  const idleObj = await loadFBX(fbxLoader, CONFIG.PLAYER_FBX_IDLE);
  idleObj.scale.copy(CONFIG.PLAYER_MODEL_SCALE);
  idleObj.rotation.copy(CONFIG.PLAYER_MODEL_ROTATION);
  idleObj.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = false;
```



---

## Player physics & movement

### `PLAYER_RADIUS`

- **Default:** `2`
- **Status:** Used in `game_core.js`

Radius of the player's capsule collider. Bigger radius makes the player “thicker” and changes wall/ground contact.

**Where it’s applied (excerpt):**

```js
// Player (capsule body + FBX visual + animations)
// ------------------------------------------------------------
async function createPlayer(state, CONFIG, position) {
  const shape = new Ammo.btCapsuleShape(
    CONFIG.PLAYER_RADIUS,
    CONFIG.PLAYER_HEIGHT - 2 * CONFIG.PLAYER_RADIUS
  );
  const transform = new Ammo.btTransform();
```



### `PLAYER_HEIGHT`

- **Default:** `8`
- **Status:** Used in `game_core.js`

Height of the player's capsule collider (overall capsule height used by Ammo). Taller player hits ceilings sooner.

**Where it’s applied (excerpt):**

```js
// ------------------------------------------------------------
async function createPlayer(state, CONFIG, position) {
  const shape = new Ammo.btCapsuleShape(
    CONFIG.PLAYER_RADIUS,
    CONFIG.PLAYER_HEIGHT - 2 * CONFIG.PLAYER_RADIUS
  );
  const transform = new Ammo.btTransform();
  transform.setIdentity();
```



### `PLAYER_MASS`

- **Default:** `1`
- **Status:** Used in `game_core.js`

Mass of the player's rigid body. Higher mass feels heavier and interacts differently with dynamic objects.

**Where it’s applied (excerpt):**

```js
  transform.setRotation(startRot);

  const motionState = new Ammo.btDefaultMotionState(transform);
  const localInertia = new Ammo.btVector3(0, 0, 0);
  shape.calculateLocalInertia(CONFIG.PLAYER_MASS, localInertia);

  const rbInfo = new Ammo.btRigidBodyConstructionInfo(CONFIG.PLAYER_MASS, motionState, shape, localInertia);
  const body = new Ammo.btRigidBody(rbInfo);
```



### `PLAYER_STARTING_POSITION`

- **Default:** `new THREE.Vector3(0, 0, 0)`
- **Status:** Used in `game_core.js`

Initial spawn position for the player rigid body (runs in start()).

**Where it’s applied (excerpt):**

```js

  createStaticGroundCollider(state, CONFIG);
  spawnEnvironment(state, CONFIG);

  await createPlayer(state, CONFIG, CONFIG.PLAYER_STARTING_POSITION);

  bindKeys(state);
  setDebugMode(state, CONFIG, CONFIG.DEBUG_MODE);
```



### `PLAYER_STARTING_YAW_DEG`

- **Default:** `180`
- **Status:** Used in `game_core.js`

Initial facing direction (yaw) in degrees at spawn time.

**Where it’s applied (excerpt):**

```js
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(position.x, position.y + CONFIG.PLAYER_HEIGHT / 2, position.z));

  // Apply starting yaw (same behavior you already implemented) :contentReference[oaicite:5]{index=5}
  const yawRad = THREE.MathUtils.degToRad(CONFIG.PLAYER_STARTING_YAW_DEG);
  const startRot = new Ammo.btQuaternion(0, Math.sin(yawRad / 2), 0, Math.cos(yawRad / 2));
  transform.setRotation(startRot);

```



### `PLAYER_MOVE_MIDAIR`

- **Default:** `true`
- **Status:** Used in `game_core.js`

If true, input can accelerate the player while not grounded; if false, mid-air movement is mostly ballistic.

**Where it’s applied (excerpt):**

```js
  return { forward, right };
}

function applyCharacterMovement(state, CONFIG, moveAxis, dt) {
  if (!CONFIG.PLAYER_MOVE_MIDAIR && !isGrounded(state, CONFIG)) moveAxis = 0;

  const lv = state.Player.getLinearVelocity();
  const current = new THREE.Vector3(lv.x(), 0, lv.z());
```



### `PLAYER_MID_AIR_DAMPEN`

- **Default:** `0.5`
- **Status:** Used in `game_core.js`

Multiplier applied to desired movement while airborne (lower = less control in the air).

**Where it’s applied (excerpt):**

```js
    const into = desired.dot(state.playerWallNormal);
    if (into > 0) desired.addScaledVector(state.playerWallNormal, -into);
  }

  const accel = grounded ? CONFIG.PLAYER_ACCEL : CONFIG.PLAYER_AIR_ACCEL * CONFIG.PLAYER_MID_AIR_DAMPEN;
  const brake = grounded ? CONFIG.PLAYER_BRAKE : CONFIG.PLAYER_AIR_BRAKE;

  const target = (moveAxis !== 0) ? desired : new THREE.Vector3(0, 0, 0);
```



### `PLAYER_JUMP_IMPULSE`

- **Default:** `25`
- **Status:** Used in `game_core.js`

Upward impulse applied when jumping (bigger = higher jump).

**Example:**

```js
CONFIG.PLAYER_JUMP_IMPULSE = 45; // bigger jumps
```
**Where it’s applied (excerpt):**

```js
}

function jump(state, CONFIG) {
  const lv = state.Player.getLinearVelocity();
  state.Player.setLinearVelocity(new Ammo.btVector3(lv.x(), CONFIG.PLAYER_JUMP_IMPULSE, lv.z()));
  state.Player.activate();
}

```



### `PLAYER_MAX_SPEED`

- **Default:** `15.0`
- **Status:** Used in `game_core.js`

Top horizontal speed cap for ground movement (and sometimes air movement depending on implementation).

**Example:**

```js
CONFIG.PLAYER_MAX_SPEED = 28; // faster sprinty feel
```
**Where it’s applied (excerpt):**

```js
  const lv = state.Player.getLinearVelocity();
  const current = new THREE.Vector3(lv.x(), 0, lv.z());

  const { forward, right } = getPlayerBasis(state);
  const desired = forward.clone().multiplyScalar(CONFIG.PLAYER_MAX_SPEED * moveAxis);

  const grounded = isGrounded(state, CONFIG);
  const wallSliding = (!grounded && state.playerOnWall && moveAxis !== 0);
```



### `PLAYER_ACCEL`

- **Default:** `55.0`
- **Status:** Used in `game_core.js`

Acceleration strength toward target ground speed (higher = snappier).

**Example:**

```js
CONFIG.PLAYER_ACCEL = 120; // very snappy starts
```
**Where it’s applied (excerpt):**

```js
    const into = desired.dot(state.playerWallNormal);
    if (into > 0) desired.addScaledVector(state.playerWallNormal, -into);
  }

  const accel = grounded ? CONFIG.PLAYER_ACCEL : CONFIG.PLAYER_AIR_ACCEL * CONFIG.PLAYER_MID_AIR_DAMPEN;
  const brake = grounded ? CONFIG.PLAYER_BRAKE : CONFIG.PLAYER_AIR_BRAKE;

  const target = (moveAxis !== 0) ? desired : new THREE.Vector3(0, 0, 0);
```



### `PLAYER_BRAKE`

- **Default:** `75.0`
- **Status:** Used in `game_core.js`

Deceleration strength when no input / opposite input on ground (higher = stops faster).

**Example:**

```js
CONFIG.PLAYER_BRAKE = 200; // stop on a dime
```
**Where it’s applied (excerpt):**

```js
    if (into > 0) desired.addScaledVector(state.playerWallNormal, -into);
  }

  const accel = grounded ? CONFIG.PLAYER_ACCEL : CONFIG.PLAYER_AIR_ACCEL * CONFIG.PLAYER_MID_AIR_DAMPEN;
  const brake = grounded ? CONFIG.PLAYER_BRAKE : CONFIG.PLAYER_AIR_BRAKE;

  const target = (moveAxis !== 0) ? desired : new THREE.Vector3(0, 0, 0);
  const rate = (moveAxis !== 0) ? accel : brake;
```



### `PLAYER_AIR_ACCEL`

- **Default:** `18.0`
- **Status:** Used in `game_core.js`

Air acceleration (only matters when PLAYER_MOVE_MIDAIR is true).

**Where it’s applied (excerpt):**

```js
    const into = desired.dot(state.playerWallNormal);
    if (into > 0) desired.addScaledVector(state.playerWallNormal, -into);
  }

  const accel = grounded ? CONFIG.PLAYER_ACCEL : CONFIG.PLAYER_AIR_ACCEL * CONFIG.PLAYER_MID_AIR_DAMPEN;
  const brake = grounded ? CONFIG.PLAYER_BRAKE : CONFIG.PLAYER_AIR_BRAKE;

  const target = (moveAxis !== 0) ? desired : new THREE.Vector3(0, 0, 0);
```



### `PLAYER_AIR_BRAKE`

- **Default:** `8.0`
- **Status:** Used in `game_core.js`

Air braking (how quickly you slow down in air).

**Where it’s applied (excerpt):**

```js
    if (into > 0) desired.addScaledVector(state.playerWallNormal, -into);
  }

  const accel = grounded ? CONFIG.PLAYER_ACCEL : CONFIG.PLAYER_AIR_ACCEL * CONFIG.PLAYER_MID_AIR_DAMPEN;
  const brake = grounded ? CONFIG.PLAYER_BRAKE : CONFIG.PLAYER_AIR_BRAKE;

  const target = (moveAxis !== 0) ? desired : new THREE.Vector3(0, 0, 0);
  const rate = (moveAxis !== 0) ? accel : brake;
```



### `PLAYER_SIDE_DAMP_GROUND`

- **Default:** `18.0`
- **Status:** Used in `game_core.js`

Sideways dampening on ground (higher = less strafey slide).

**Where it’s applied (excerpt):**

```js
  const newVel = current.clone().add(delta);

  // strafe damp
  if (CONFIG.PLAYER_USE_STRAFE_DAMP) {
    const sideDamp = grounded ? CONFIG.PLAYER_SIDE_DAMP_GROUND : CONFIG.PLAYER_SIDE_DAMP_AIR;
    const f = forward.clone().setY(0).normalize();
    const r = right.clone().setY(0).normalize();

```



### `PLAYER_SIDE_DAMP_AIR`

- **Default:** `2.0`
- **Status:** Used in `game_core.js`

Sideways dampening in air.

**Where it’s applied (excerpt):**

```js
  const newVel = current.clone().add(delta);

  // strafe damp
  if (CONFIG.PLAYER_USE_STRAFE_DAMP) {
    const sideDamp = grounded ? CONFIG.PLAYER_SIDE_DAMP_GROUND : CONFIG.PLAYER_SIDE_DAMP_AIR;
    const f = forward.clone().setY(0).normalize();
    const r = right.clone().setY(0).normalize();

```



### `PLAYER_USE_STRAFE_DAMP`

- **Default:** `true`
- **Status:** Used in `game_core.js`

Turns the side-dampening feature on/off (true = tighter, false = more drift).

**Where it’s applied (excerpt):**

```js

  const newVel = current.clone().add(delta);

  // strafe damp
  if (CONFIG.PLAYER_USE_STRAFE_DAMP) {
    const sideDamp = grounded ? CONFIG.PLAYER_SIDE_DAMP_GROUND : CONFIG.PLAYER_SIDE_DAMP_AIR;
    const f = forward.clone().setY(0).normalize();
    const r = right.clone().setY(0).normalize();
```



### `PLAYER_DEFAULT_FRICTION`

- **Default:** `2.5`
- **Status:** Used in `game_core.js`

Friction value applied to the player rigid body (lower = slippery, higher = sticky).

**Where it’s applied (excerpt):**

```js
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(CONFIG.PLAYER_MASS, motionState, shape, localInertia);
  const body = new Ammo.btRigidBody(rbInfo);

  body.setRestitution(0);
  body.setFriction(CONFIG.PLAYER_DEFAULT_FRICTION);
  body.setDamping(0.2, 0.98);
  body.setAngularFactor(new Ammo.btVector3(0, 0, 0));
  body.setActivationState(Ammo.DISABLE_DEACTIVATION);
```



---

## Turning

### `TURN_SPEED`

- **Default:** `3`
- **Status:** Used in `game_core.js`

Yaw turn speed (how quickly A/D or left/right rotates the player).

**Where it’s applied (excerpt):**

```js
  const backKey    = state.keys["ArrowDown"] || state.keys["KeyS"];
  const leftKey    = state.keys["ArrowLeft"] || state.keys["KeyA"];
  const rightKey   = state.keys["ArrowRight"]|| state.keys["KeyD"];

  if (leftKey)  turn(state, CONFIG,  CONFIG.TURN_SPEED, dt);
  if (rightKey) turn(state, CONFIG, -CONFIG.TURN_SPEED, dt);

  let moveAxis = 0;
```



---

## Ground / wall detection & climbing

### `WALL_SLIDE_FRICTION`

- **Default:** `0.15`
- **Status:** Used in `game_core.js`

When on a wall, how much falling velocity is resisted (higher = slower slide).

**Where it’s applied (excerpt):**

```js
}

function applyWallClimb(state, CONFIG) {
  const stick = state.playerWallNormal.clone().multiplyScalar(-CONFIG.WALL_CLIMB_STICK_SPEED);
  state.Player.setFriction(CONFIG.WALL_SLIDE_FRICTION);
  state.Player.setLinearVelocity(new Ammo.btVector3(stick.x, CONFIG.WALL_CLIMB_SPEED, stick.z));
  state.Player.activate();
}
```



### `WALL_SLIDE_MAX_FALL_SPEED`

- **Default:** `-8.0`
- **Status:** Used in `game_core.js`

Clamp for maximum downward speed while sliding on a wall (less negative = slower fall).

**Where it’s applied (excerpt):**

```js
  if (spd > CONFIG.PLAYER_MAX_SPEED) newVel.multiplyScalar(CONFIG.PLAYER_MAX_SPEED / spd);

  let vy = lv.y();
  if (wallSliding && state.playerWallNormal.lengthSq() > 1e-6) {
    if (vy < CONFIG.WALL_SLIDE_MAX_FALL_SPEED) vy = CONFIG.WALL_SLIDE_MAX_FALL_SPEED;
    const into2 = newVel.dot(state.playerWallNormal);
    if (into2 > 0) newVel.addScaledVector(state.playerWallNormal, -into2);
    state.Player.setFriction(CONFIG.WALL_SLIDE_FRICTION);
```



### `WALL_NORMAL_MAX_Y`

- **Default:** `0.30`
- **Status:** Used in `game_core.js`

Wall classification: if a contact normal points too much upward (Y > this), it is treated more like ground than wall.

**Where it’s applied (excerpt):**

```js
        state.playerGrounded = true;
      }

      const horizLenSq = (nx * nx + nz * nz);
      if (horizLenSq > 1e-5 && Math.abs(ny) <= CONFIG.WALL_NORMAL_MAX_Y) {
        state.playerOnWall = true;
        const len = Math.sqrt(horizLenSq);
        state.playerWallNormal.x += (nx / len);
```



### `GROUND_NORMAL_MIN_Y`

- **Default:** `0.10`
- **Status:** Used in `game_core.js`

Ground classification: minimum normal Y component for a surface to count as “ground”.

**Where it’s applied (excerpt):**

```js
      const pB = pt.get_m_positionWorldOnB();
      const pPlayer = isPlayer0 ? pA : pB;
      const py = pPlayer.y();

      if (py <= (groundBandTopY + 0.05) && ny > CONFIG.GROUND_NORMAL_MIN_Y) {
        state.playerGrounded = true;
      }

```



### `GROUND_BAND_FRACTION`

- **Default:** `0.10`
- **Status:** Used in `game_core.js`

How much of the capsule's lower portion counts as “ground contact band” (bigger band = more forgiving grounding).

**Where it’s applied (excerpt):**

```js
  const t = state.Player.getWorldTransform();
  const o = t.getOrigin();
  const centerY = o.y();
  const bottomY = centerY - (CONFIG.PLAYER_HEIGHT / 2);
  const groundBandTopY = bottomY + (CONFIG.PLAYER_HEIGHT * CONFIG.GROUND_BAND_FRACTION);

  const numManifolds = state.dispatcher.getNumManifolds();

```



### `WALL_CLIMB_SPEED`

- **Default:** `9.5`
- **Status:** Used in `game_core.js`

Upward speed while actively climbing.

**Example:**

```js
CONFIG.WALL_CLIMB_SPEED = 18; // faster climbing
```
**Where it’s applied (excerpt):**

```js

function applyWallClimb(state, CONFIG) {
  const stick = state.playerWallNormal.clone().multiplyScalar(-CONFIG.WALL_CLIMB_STICK_SPEED);
  state.Player.setFriction(CONFIG.WALL_SLIDE_FRICTION);
  state.Player.setLinearVelocity(new Ammo.btVector3(stick.x, CONFIG.WALL_CLIMB_SPEED, stick.z));
  state.Player.activate();
}

```



### `WALL_CLIMB_STICK_SPEED`

- **Default:** `3.0`
- **Status:** Used in `game_core.js`

How strongly the player is pushed/stuck into the wall while climbing (reduces bounce-off).

**Where it’s applied (excerpt):**

```js
  state.Player.activate();
}

function applyWallClimb(state, CONFIG) {
  const stick = state.playerWallNormal.clone().multiplyScalar(-CONFIG.WALL_CLIMB_STICK_SPEED);
  state.Player.setFriction(CONFIG.WALL_SLIDE_FRICTION);
  state.Player.setLinearVelocity(new Ammo.btVector3(stick.x, CONFIG.WALL_CLIMB_SPEED, stick.z));
  state.Player.activate();
```



### `WALL_CLIMB_MIN_NORMAL`

- **Default:** `0.5`
- **Status:** Used in `game_core.js`

Minimum wall normal strength to allow climbing (higher = must be a “flatter wall”, lower = allows climbing slanted surfaces).

**Where it’s applied (excerpt):**

```js

  const grounded = isGrounded(state, CONFIG);

  // Climb gating (keep expanding with your probe-based animation latch if desired)
  const wallOkPhysics = state.playerOnWall && (state.playerWallNormal.length() >= CONFIG.WALL_CLIMB_MIN_NORMAL);
  const canAttemptClimb = (!grounded && moveAxis > 0 && state.climbExitTimer <= 0);

  if (state.playerClimbing) {
```



### `WALL_CLIMB_EXIT_COOLDOWN`

- **Default:** `0.3`
- **Status:** Used in `game_core.js`

Cooldown time after leaving a wall before climbing can re-engage (prevents flicker).

**Where it’s applied (excerpt):**

```js
  state.Player.activate();

  state.playerClimbing = false;
  state.climbAnimGrace = 0;
  state.climbExitTimer = CONFIG.WALL_CLIMB_EXIT_COOLDOWN;
}

function getPlayerBasis(state) {
```



### `CLIMB_ANIM_GRACE_SECONDS`

- **Default:** `1.0`
- **Status:** Used in `game_core.js`

Short grace period to keep climb animation active when wall contact is briefly lost (animation smoothing).

**Where it’s applied (excerpt):**

```js
      state.playerClimbing = false;
      state.climbAnimGrace = 0;
    } else if (canAttemptClimb && wallOkPhysics) {
      state.playerClimbing = true;
      state.climbAnimGrace = CONFIG.CLIMB_ANIM_GRACE_SECONDS;
    } else {
      if (state.climbAnimGrace <= 0) state.playerClimbing = false;
    }
```



### `CLIMB_ANIM_PROBE_DISTANCE`

- **Default:** `3.5`
- **Status:** Not used in current `game_core.js`

Defined in CONFIG but **not referenced** in the current `game_core.js`. You can wire it in if you want more advanced animation probes/snapping behavior.

**Tip (if you want to wire this in):** pick a function you want to affect (usually animation-state selection or ground snapping), add a `CONFIG.CLIMB_ANIM_PROBE_DISTANCE` reference there, and tune from `basic_game.html`.



### `CLIMB_ANIM_PROBE_START_PAD`

- **Default:** `0.25`
- **Status:** Not used in current `game_core.js`

Defined in CONFIG but **not referenced** in the current `game_core.js`. You can wire it in if you want more advanced animation probes/snapping behavior.

**Tip (if you want to wire this in):** pick a function you want to affect (usually animation-state selection or ground snapping), add a `CONFIG.CLIMB_ANIM_PROBE_START_PAD` reference there, and tune from `basic_game.html`.



---

## Animation state tuning

### `ANIM_PROBE_LENGTH`

- **Default:** `10`
- **Status:** Not used in current `game_core.js`

Defined in CONFIG but **not referenced** in the current `game_core.js`. You can wire it in if you want more advanced animation probes/snapping behavior.

**Tip (if you want to wire this in):** pick a function you want to affect (usually animation-state selection or ground snapping), add a `CONFIG.ANIM_PROBE_LENGTH` reference there, and tune from `basic_game.html`.



### `ANIM_FALL_TRIGGER_DISTANCE`

- **Default:** `4.0`
- **Status:** Not used in current `game_core.js`

Defined in CONFIG but **not referenced** in the current `game_core.js`. You can wire it in if you want more advanced animation probes/snapping behavior.

**Tip (if you want to wire this in):** pick a function you want to affect (usually animation-state selection or ground snapping), add a `CONFIG.ANIM_FALL_TRIGGER_DISTANCE` reference there, and tune from `basic_game.html`.



### `ANIM_GROUND_SNAP_DISTANCE`

- **Default:** `3.0`
- **Status:** Not used in current `game_core.js`

Defined in CONFIG but **not referenced** in the current `game_core.js`. You can wire it in if you want more advanced animation probes/snapping behavior.

**Tip (if you want to wire this in):** pick a function you want to affect (usually animation-state selection or ground snapping), add a `CONFIG.ANIM_GROUND_SNAP_DISTANCE` reference there, and tune from `basic_game.html`.



### `ANIM_AIR_MIN_TIME`

- **Default:** `0.10`
- **Status:** Used in `game_core.js`

Minimum time airborne before switching to the in-air animation (prevents flickering when stepping down small ledges).

**Where it’s applied (excerpt):**

```js
    state.animInAir = false;
    state.animAirTimer = 0;
  } else {
    state.animAirTimer += dt;
    if (!state.animInAir && state.animAirTimer >= CONFIG.ANIM_AIR_MIN_TIME) state.animInAir = true;
  }

  const lv = state.Player.getLinearVelocity();
```



### `ANIM_GROUND_PROBE_OFFSETS`

- **Default:** `[`
- **Status:** Not used in current `game_core.js`

Defined in CONFIG but **not referenced** in the current `game_core.js`. You can wire it in if you want more advanced animation probes/snapping behavior.

**Tip (if you want to wire this in):** pick a function you want to affect (usually animation-state selection or ground snapping), add a `CONFIG.ANIM_GROUND_PROBE_OFFSETS` reference there, and tune from `basic_game.html`.



### `MOVE_SPEED_THRESHOLD`

- **Default:** `0.6`
- **Status:** Used in `game_core.js`

Horizontal speed threshold for switching between idle vs move animations.

**Where it’s applied (excerpt):**

```js
  const horizSpeed = Math.sqrt(lv.x() * lv.x() + lv.z() * lv.z());

  let desired = "idle";
  if (state.animInAir) desired = "in_air";
  else if (horizSpeed > CONFIG.MOVE_SPEED_THRESHOLD) desired = "move";

  if (desired !== state.playerCurrentState) playPlayerAction(state, CONFIG, desired, false);

```



---

## Camera & input feel

### `CAMERA_MIN_DISTANCE`

- **Default:** `20`
- **Status:** Used in `game_core.js`

Minimum camera follow distance (scroll wheel zoom can’t go closer than this).

**Example:**

```js
CONFIG.CAMERA_MIN_DISTANCE = 8;
CONFIG.CAMERA_MAX_DISTANCE = 22;
```
**Where it’s applied (excerpt):**

```js
  // camera defaults
  state.cameraPitch = CONFIG.CAMERA_DEFAULT_PITCH;
  state.cameraDistance = THREE.MathUtils.clamp(
    state.cameraDistance,
    CONFIG.CAMERA_MIN_DISTANCE,
    CONFIG.CAMERA_MAX_DISTANCE
  );
}
```



### `CAMERA_MAX_DISTANCE`

- **Default:** `40`
- **Status:** Used in `game_core.js`

Maximum camera follow distance.

**Where it’s applied (excerpt):**

```js
  state.cameraPitch = CONFIG.CAMERA_DEFAULT_PITCH;
  state.cameraDistance = THREE.MathUtils.clamp(
    state.cameraDistance,
    CONFIG.CAMERA_MIN_DISTANCE,
    CONFIG.CAMERA_MAX_DISTANCE
  );
}

```



### `CAMERA_VERTICAL_OFFSET`

- **Default:** `20`
- **Status:** Used in `game_core.js`

How high above the player the camera looks/targets (higher = more top-down feel).

**Where it’s applied (excerpt):**

```js
  const zOff  = horiz * Math.cos(state.cameraYaw);

  const desiredPos = new THREE.Vector3(
    targetPos.x + xOff,
    targetPos.y + yOff + (CONFIG.CAMERA_VERTICAL_OFFSET * 0.15),
    targetPos.z + zOff
  );

```



### `CAMERA_DEFAULT_PITCH`

- **Default:** `0.55`
- **Status:** Used in `game_core.js`

Initial camera pitch angle (how far down it tilts).

**Where it’s applied (excerpt):**

```js
  bindKeys(state);
  setDebugMode(state, CONFIG, CONFIG.DEBUG_MODE);

  // camera defaults
  state.cameraPitch = CONFIG.CAMERA_DEFAULT_PITCH;
  state.cameraDistance = THREE.MathUtils.clamp(
    state.cameraDistance,
    CONFIG.CAMERA_MIN_DISTANCE,
```



### `CAMERA_MIN_PITCH`

- **Default:** `0.15`
- **Status:** Used in `game_core.js`

Minimum pitch clamp (prevents aiming too far up/down).

**Where it’s applied (excerpt):**

```js
// Camera follow
// ------------------------------------------------------------
function getDynamicMinPitch(state, CONFIG) {
  return (state.playerHeightAboveGround > CONFIG.CAMERA_BELOW_PLAYER_ENABLE_HEIGHT)
    ? CONFIG.CAMERA_MIN_PITCH_BELOW
    : CONFIG.CAMERA_MIN_PITCH;
}

```



### `CAMERA_MAX_PITCH`

- **Default:** `1.20`
- **Status:** Used in `game_core.js`

Maximum pitch clamp.

**Where it’s applied (excerpt):**

```js
    state.cameraPitch -= e.movementY * CONFIG.MOUSE_PITCH_SENSITIVITY;
    state.cameraPitch  = THREE.MathUtils.clamp(
      state.cameraPitch,
      getDynamicMinPitch(state, CONFIG),
      CONFIG.CAMERA_MAX_PITCH
    );
  });

```



### `CAMERA_BELOW_PLAYER_ENABLE_HEIGHT`

- **Default:** `18`
- **Status:** Used in `game_core.js`

When the player is high above the ground, camera pitch constraints may change; this is the enable threshold.

**Where it’s applied (excerpt):**

```js
// ------------------------------------------------------------
// Camera follow
// ------------------------------------------------------------
function getDynamicMinPitch(state, CONFIG) {
  return (state.playerHeightAboveGround > CONFIG.CAMERA_BELOW_PLAYER_ENABLE_HEIGHT)
    ? CONFIG.CAMERA_MIN_PITCH_BELOW
    : CONFIG.CAMERA_MIN_PITCH;
}
```



### `CAMERA_MIN_PITCH_BELOW`

- **Default:** `-0.65`
- **Status:** Used in `game_core.js`

Alternate minimum pitch when “below-player” camera behavior activates.

**Where it’s applied (excerpt):**

```js
// Camera follow
// ------------------------------------------------------------
function getDynamicMinPitch(state, CONFIG) {
  return (state.playerHeightAboveGround > CONFIG.CAMERA_BELOW_PLAYER_ENABLE_HEIGHT)
    ? CONFIG.CAMERA_MIN_PITCH_BELOW
    : CONFIG.CAMERA_MIN_PITCH;
}

```



### `MOUSE_YAW_SENSITIVITY`

- **Default:** `0.0025`
- **Status:** Used in `game_core.js`

Mouse horizontal sensitivity (yaw).

**Example:**

```js
CONFIG.MOUSE_YAW_SENSITIVITY = 0.0018;
CONFIG.MOUSE_PITCH_SENSITIVITY = 0.0012;
```
**Where it’s applied (excerpt):**

```js

  document.addEventListener("mousemove", (e) => {
    if (!state.pointerLocked) return;

    state.cameraYaw   -= e.movementX * CONFIG.MOUSE_YAW_SENSITIVITY;
    state.cameraPitch -= e.movementY * CONFIG.MOUSE_PITCH_SENSITIVITY;
    state.cameraPitch  = THREE.MathUtils.clamp(
      state.cameraPitch,
```



### `MOUSE_PITCH_SENSITIVITY`

- **Default:** `0.0020`
- **Status:** Used in `game_core.js`

Mouse vertical sensitivity (pitch).

**Where it’s applied (excerpt):**

```js
  document.addEventListener("mousemove", (e) => {
    if (!state.pointerLocked) return;

    state.cameraYaw   -= e.movementX * CONFIG.MOUSE_YAW_SENSITIVITY;
    state.cameraPitch -= e.movementY * CONFIG.MOUSE_PITCH_SENSITIVITY;
    state.cameraPitch  = THREE.MathUtils.clamp(
      state.cameraPitch,
      getDynamicMinPitch(state, CONFIG),
```



---

## Quick tuning recipes (copy/paste)

### Make movement arcade-fast

```js
CONFIG.PLAYER_MAX_SPEED = 30;
CONFIG.PLAYER_ACCEL = 140;
CONFIG.PLAYER_BRAKE = 200;
CONFIG.PLAYER_USE_STRAFE_DAMP = true;
CONFIG.PLAYER_SIDE_DAMP_GROUND = 3.0;
```
### Make it slippery / “ice level”

```js
CONFIG.PLAYER_DEFAULT_FRICTION = 0.2;
CONFIG.PLAYER_BRAKE = 8;
CONFIG.PLAYER_SIDE_DAMP_GROUND = 0.8;
CONFIG.PLAYER_USE_STRAFE_DAMP = false;
```
### Make climbing harder

```js
CONFIG.WALL_CLIMB_MIN_NORMAL = 0.95;
CONFIG.WALL_CLIMB_SPEED = 10;
CONFIG.WALL_CLIMB_EXIT_COOLDOWN = 0.8;
```
### Make camera closer and more top-down

```js
CONFIG.CAMERA_MIN_DISTANCE = 8;
CONFIG.CAMERA_MAX_DISTANCE = 20;
CONFIG.CAMERA_VERTICAL_OFFSET = 45;
CONFIG.CAMERA_DEFAULT_PITCH = 0.95;
```