# Lesson 2: Add Kick-to-Crate Behavior to `lesson1-game_core_kick.js`

This lesson shows exactly how to update `static/js/lesson1-game_core_kick.js` so it behaves like `static/js/lesson2-game_core_kick_crate.js`.

The goal is to keep the existing kick animation, then make the kick launch one nearby crate when the animation reaches its midpoint.

## Step 1: Extend the kick state in `createGameState()`

In `static/js/lesson1-game_core_kick.js`, find this section:

```js
    playerCurrentAction: null,
    playerCurrentState: "idle",
    playerKickActive: false,
    playerKickTimer: 0,
```

Replace it with:

```js
    playerCurrentAction: null,
    playerCurrentState: "idle",
    playerKickActive: false,
    playerKickTimer: 0,
    playerKickDuration: 0,
    playerKickImpactApplied: false,
```

## Step 2: Update `triggerKick()` so each kick resets its timing data

Find this function:

```js
function triggerKick(state, CONFIG) {
  const action = state.playerActions.kick;
  if (!action) return;

  const clip = action.getClip ? action.getClip() : null;
  state.playerKickTimer = clip ? clip.duration : 0;
  state.playerKickActive = state.playerKickTimer > 0;

  if (state.playerCurrentAction === action) {
    action.reset();
    action.play();
    state.playerCurrentState = "kick";
    return;
  }

  playPlayerAction(state, CONFIG, "kick", false);
}
```

Replace it with:

```js
function triggerKick(state, CONFIG) {
  const action = state.playerActions.kick;
  if (!action) return;

  const clip = action.getClip ? action.getClip() : null;
  state.playerKickDuration = clip ? clip.duration : 0;
  state.playerKickTimer = state.playerKickDuration;
  state.playerKickActive = state.playerKickTimer > 0;
  state.playerKickImpactApplied = false;

  if (state.playerCurrentAction === action) {
    action.reset();
    action.play();
    state.playerCurrentState = "kick";
    return;
  }

  playPlayerAction(state, CONFIG, "kick", false);
}
```

## Step 3: Add `getBodyPosition(body)` after `triggerKick()`

Immediately after `triggerKick()`, add this function:

```js
function getBodyPosition(body) {
  if (!body) return null;
  const transform = new Ammo.btTransform();
  body.getMotionState().getWorldTransform(transform);
  const origin = transform.getOrigin();
  const position = new THREE.Vector3(origin.x(), origin.y(), origin.z());
  Ammo.destroy(transform);
  return position;
}
```

## Step 4: Add `findKickableCrate(state, CONFIG)` after `getBodyPosition()`

Immediately after `getBodyPosition(body)`, add this function:

```js
function findKickableCrate(state, CONFIG) {
  if (!state.Player) return null;

  const playerPos = getBodyPosition(state.Player);
  if (!playerPos) return null;

  const { forward } = getPlayerBasis(state);
  const flatForward = forward.clone().setY(0);
  if (flatForward.lengthSq() <= 1e-6) return null;
  flatForward.normalize();

  const kickRange = CONFIG.KICK_CRATE_RANGE ?? 18;
  const facingDotMin = CONFIG.KICK_CRATE_FACING_DOT ?? 0.45;

  let bestCrate = null;
  let bestDistanceSq = kickRange * kickRange;

  for (const obj of state.gameObjects) {
    if (!obj?.body || typeof obj.name !== "string") continue;
    if (!obj.name.toLowerCase().startsWith("crate")) continue;

    const cratePos = getBodyPosition(obj.body);
    if (!cratePos) continue;

    const toCrate = cratePos.clone().sub(playerPos);
    toCrate.y = 0;

    const distanceSq = toCrate.lengthSq();
    if (distanceSq <= 1e-6 || distanceSq > bestDistanceSq) continue;

    toCrate.normalize();
    if (flatForward.dot(toCrate) < facingDotMin) continue;

    bestCrate = obj;
    bestDistanceSq = distanceSq;
  }

  return bestCrate;
}
```

## Step 5: Add `applyKickForceToCrate(state, CONFIG)` after `findKickableCrate()`

Immediately after `findKickableCrate(state, CONFIG)`, add this function:

```js
function applyKickForceToCrate(state, CONFIG) {
  const crate = findKickableCrate(state, CONFIG);
  if (!crate?.body) return;

  const playerPos = getBodyPosition(state.Player);
  const cratePos = getBodyPosition(crate.body);
  if (!playerPos || !cratePos) return;

  const direction = cratePos.clone().sub(playerPos).setY(0);
  if (direction.lengthSq() <= 1e-6) return;
  direction.normalize();

  const impulseStrength = CONFIG.KICK_CRATE_IMPULSE ?? 21;
  const upwardImpulse = CONFIG.KICK_CRATE_UPWARD_IMPULSE ?? 12;
  const spinImpulse = CONFIG.KICK_CRATE_SPIN_IMPULSE ?? 6;
  const impulse = new Ammo.btVector3(
    direction.x * impulseStrength,
    upwardImpulse,
    direction.z * impulseStrength
  );
  const torque = new Ammo.btVector3(
    direction.z * spinImpulse,
    0,
    -direction.x * spinImpulse
  );

  crate.body.activate();
  crate.body.applyCentralImpulse(impulse);
  crate.body.applyTorqueImpulse(torque);
  Ammo.destroy(impulse);
  Ammo.destroy(torque);
}
```

## Step 6: Update the kick block in `updatePlayerAnimationState()`

Find this block at the top of `updatePlayerAnimationState(state, CONFIG, dt)`:

```js
  if (state.playerKickActive) {
    state.playerKickTimer = Math.max(0, state.playerKickTimer - dt);
    if (state.playerCurrentState !== "kick") playPlayerAction(state, CONFIG, "kick", false);
    if (state.playerKickTimer > 0) return;
    state.playerKickActive = false;
  }
```

Replace it with:

```js
  if (state.playerKickActive) {
    state.playerKickTimer = Math.max(0, state.playerKickTimer - dt);
    const impactThreshold = state.playerKickDuration * 0.5;
    if (!state.playerKickImpactApplied && state.playerKickTimer <= impactThreshold) {
      applyKickForceToCrate(state, CONFIG);
      state.playerKickImpactApplied = true;
    }
    if (state.playerCurrentState !== "kick") playPlayerAction(state, CONFIG, "kick", false);
    if (state.playerKickTimer > 0) return;
    state.playerKickActive = false;
    state.playerKickDuration = 0;
  }
```

## Final code checklist

When you finish, `static/js/lesson1-game_core_kick.js` should contain these new code pieces:

```js
playerKickDuration: 0,
playerKickImpactApplied: false,
```

```js
state.playerKickDuration = clip ? clip.duration : 0;
state.playerKickTimer = state.playerKickDuration;
state.playerKickImpactApplied = false;
```

```js
function getBodyPosition(body) {
  if (!body) return null;
  const transform = new Ammo.btTransform();
  body.getMotionState().getWorldTransform(transform);
  const origin = transform.getOrigin();
  const position = new THREE.Vector3(origin.x(), origin.y(), origin.z());
  Ammo.destroy(transform);
  return position;
}
```

```js
function findKickableCrate(state, CONFIG) {
  if (!state.Player) return null;

  const playerPos = getBodyPosition(state.Player);
  if (!playerPos) return null;

  const { forward } = getPlayerBasis(state);
  const flatForward = forward.clone().setY(0);
  if (flatForward.lengthSq() <= 1e-6) return null;
  flatForward.normalize();

  const kickRange = CONFIG.KICK_CRATE_RANGE ?? 18;
  const facingDotMin = CONFIG.KICK_CRATE_FACING_DOT ?? 0.45;

  let bestCrate = null;
  let bestDistanceSq = kickRange * kickRange;

  for (const obj of state.gameObjects) {
    if (!obj?.body || typeof obj.name !== "string") continue;
    if (!obj.name.toLowerCase().startsWith("crate")) continue;

    const cratePos = getBodyPosition(obj.body);
    if (!cratePos) continue;

    const toCrate = cratePos.clone().sub(playerPos);
    toCrate.y = 0;

    const distanceSq = toCrate.lengthSq();
    if (distanceSq <= 1e-6 || distanceSq > bestDistanceSq) continue;

    toCrate.normalize();
    if (flatForward.dot(toCrate) < facingDotMin) continue;

    bestCrate = obj;
    bestDistanceSq = distanceSq;
  }

  return bestCrate;
}
```

```js
function applyKickForceToCrate(state, CONFIG) {
  const crate = findKickableCrate(state, CONFIG);
  if (!crate?.body) return;

  const playerPos = getBodyPosition(state.Player);
  const cratePos = getBodyPosition(crate.body);
  if (!playerPos || !cratePos) return;

  const direction = cratePos.clone().sub(playerPos).setY(0);
  if (direction.lengthSq() <= 1e-6) return;
  direction.normalize();

  const impulseStrength = CONFIG.KICK_CRATE_IMPULSE ?? 21;
  const upwardImpulse = CONFIG.KICK_CRATE_UPWARD_IMPULSE ?? 12;
  const spinImpulse = CONFIG.KICK_CRATE_SPIN_IMPULSE ?? 6;
  const impulse = new Ammo.btVector3(
    direction.x * impulseStrength,
    upwardImpulse,
    direction.z * impulseStrength
  );
  const torque = new Ammo.btVector3(
    direction.z * spinImpulse,
    0,
    -direction.x * spinImpulse
  );

  crate.body.activate();
  crate.body.applyCentralImpulse(impulse);
  crate.body.applyTorqueImpulse(torque);
  Ammo.destroy(impulse);
  Ammo.destroy(torque);
}
```

```js
const impactThreshold = state.playerKickDuration * 0.5;
if (!state.playerKickImpactApplied && state.playerKickTimer <= impactThreshold) {
  applyKickForceToCrate(state, CONFIG);
  state.playerKickImpactApplied = true;
}
```
