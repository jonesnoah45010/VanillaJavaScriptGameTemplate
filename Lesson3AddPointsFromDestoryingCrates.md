# Lesson 3: Add Points From Destroying Crates

This lesson shows exactly how to update `static/js/lesson2-game_core_kick_crate.js` so it behaves like `static/js/lesson3-game_core_kick_crate_points.js`.

The goal is to keep kick-to-crate behavior, then make kicked crates flicker, disappear, and award points.

## Step 1: Add score state in `createGameState()`

Find this ending of the shared state section:

```js
    // shared
    clock: new THREE.Clock(),
    textureLoader: new THREE.TextureLoader(),
  };
}
```

Replace it with:

```js
    // shared
    clock: new THREE.Clock(),
    textureLoader: new THREE.TextureLoader(),
    score: 0,
    scoreUi: null,
  };
}
```

## Step 2: Create the score UI after `createDebugUI()`

Immediately after `createDebugUI(state, CONFIG)`, add these two functions:

```js
function createScoreUI(state) {
  const ui = document.createElement("div");
  ui.id = "score-ui";
  ui.style.position = "fixed";
  ui.style.top = "16px";
  ui.style.right = "16px";
  ui.style.zIndex = "1000";
  ui.style.padding = "10px 14px";
  ui.style.background = "rgba(0, 0, 0, 0.65)";
  ui.style.color = "#ffffff";
  ui.style.fontFamily = "monospace";
  ui.style.fontSize = "18px";
  ui.style.fontWeight = "700";
  ui.style.border = "1px solid rgba(255, 255, 255, 0.2)";
  ui.style.borderRadius = "8px";
  ui.style.pointerEvents = "none";
  document.body.appendChild(ui);

  state.scoreUi = ui;
  updateScoreUI(state);
}

function updateScoreUI(state) {
  if (!state.scoreUi) return;
  state.scoreUi.textContent = `Points: ${state.score}`;
}
```

## Step 3: Initialize the score UI in `startCore()`

Find this startup section:

```js
  initThree(state, CONFIG);
  createDebugUI(state, CONFIG);
  initPhysics(state, CONFIG);
```

Replace it with:

```js
  initThree(state, CONFIG);
  createDebugUI(state, CONFIG);
  createScoreUI(state);
  initPhysics(state, CONFIG);
```

## Step 4: Update `stepCore()` to run crate effects every frame

Find this section:

```js
  // sync visuals
  syncVisualsFromPhysics(state, CONFIG);

  // animations
  updatePlayerAnimationState(state, CONFIG, dt);
```

Replace it with:

```js
  // sync visuals
  syncVisualsFromPhysics(state, CONFIG);
  updateCrateEffects(state, CONFIG, dt);

  // animations
  updatePlayerAnimationState(state, CONFIG, dt);
```

## Step 5: Make `findKickableCrate()` skip crates already marked for destruction

In `findKickableCrate(state, CONFIG)`, find this loop section:

```js
  for (const obj of state.gameObjects) {
    if (!obj?.body || typeof obj.name !== "string") continue;
    if (!obj.name.toLowerCase().startsWith("crate")) continue;

    const cratePos = getBodyPosition(obj.body);
```

Replace it with:

```js
  for (const obj of state.gameObjects) {
    if (!obj?.body || typeof obj.name !== "string") continue;
    if (!obj.name.toLowerCase().startsWith("crate")) continue;
    if (obj.crateDestroyStarted) continue;

    const cratePos = getBodyPosition(obj.body);
```

## Step 6: Start the destroy sequence after the kick force is applied

Find `applyKickForceToCrate(state, CONFIG)`:

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

Replace it with:

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
  startCrateDestroySequence(state, CONFIG, crate);
  Ammo.destroy(impulse);
  Ammo.destroy(torque);
}
```

## Step 7: Add crate destroy helpers after `applyKickForceToCrate()`

Immediately after `applyKickForceToCrate(state, CONFIG)`, add these functions:

```js
function startCrateDestroySequence(state, CONFIG, crate) {
  if (!crate || crate.crateDestroyStarted) return;

  crate.crateDestroyStarted = true;
  crate.crateDestroyTimer = CONFIG.CRATE_DESTROY_FLICKER_SECONDS ?? 3;
  crate.crateDestroyDuration = crate.crateDestroyTimer;
}

function updateCrateEffects(state, CONFIG, dt) {
  const flickerHz = CONFIG.CRATE_DESTROY_FLICKER_HZ ?? 10;

  for (let i = state.gameObjects.length - 1; i >= 0; i--) {
    const obj = state.gameObjects[i];
    if (!obj?.crateDestroyStarted) continue;

    obj.crateDestroyTimer = Math.max(0, obj.crateDestroyTimer - dt);

    if (obj.crateDestroyTimer > 0) {
      const flickerOn = Math.floor(obj.crateDestroyTimer * flickerHz) % 2 === 0;
      if (obj.mesh) obj.mesh.visible = CONFIG.DEBUG_MODE && flickerOn;
      if (obj.visual) obj.visual.visible = flickerOn;
      if (obj.axes) obj.axes.visible = CONFIG.DEBUG_MODE && flickerOn;
      continue;
    }

    destroyCrateAndAwardPoint(state, obj, i);
  }
}

function destroyCrateAndAwardPoint(state, crate, index) {
  if (crate.body && state.physicsWorld) state.physicsWorld.removeRigidBody(crate.body);

  if (crate.mesh?.parent) crate.mesh.parent.remove(crate.mesh);
  if (crate.visual?.parent) crate.visual.parent.remove(crate.visual);
  if (crate.axes?.parent) crate.axes.parent.remove(crate.axes);

  state.debugAxes = state.debugAxes.filter((entry) => entry.group !== crate.axes);
  state.gameObjects.splice(index, 1);

  state.score += 1;
  updateScoreUI(state);
}
```

## Final code checklist

When you finish, `static/js/lesson2-game_core_kick_crate.js` should contain these new code pieces:

```js
score: 0,
scoreUi: null,
```

```js
createScoreUI(state);
```

```js
updateCrateEffects(state, CONFIG, dt);
```

```js
if (obj.crateDestroyStarted) continue;
```

```js
startCrateDestroySequence(state, CONFIG, crate);
```

```js
function createScoreUI(state) {
  const ui = document.createElement("div");
  ui.id = "score-ui";
  ui.style.position = "fixed";
  ui.style.top = "16px";
  ui.style.right = "16px";
  ui.style.zIndex = "1000";
  ui.style.padding = "10px 14px";
  ui.style.background = "rgba(0, 0, 0, 0.65)";
  ui.style.color = "#ffffff";
  ui.style.fontFamily = "monospace";
  ui.style.fontSize = "18px";
  ui.style.fontWeight = "700";
  ui.style.border = "1px solid rgba(255, 255, 255, 0.2)";
  ui.style.borderRadius = "8px";
  ui.style.pointerEvents = "none";
  document.body.appendChild(ui);

  state.scoreUi = ui;
  updateScoreUI(state);
}

function updateScoreUI(state) {
  if (!state.scoreUi) return;
  state.scoreUi.textContent = `Points: ${state.score}`;
}
```

```js
function startCrateDestroySequence(state, CONFIG, crate) {
  if (!crate || crate.crateDestroyStarted) return;

  crate.crateDestroyStarted = true;
  crate.crateDestroyTimer = CONFIG.CRATE_DESTROY_FLICKER_SECONDS ?? 3;
  crate.crateDestroyDuration = crate.crateDestroyTimer;
}
```

```js
function updateCrateEffects(state, CONFIG, dt) {
  const flickerHz = CONFIG.CRATE_DESTROY_FLICKER_HZ ?? 10;

  for (let i = state.gameObjects.length - 1; i >= 0; i--) {
    const obj = state.gameObjects[i];
    if (!obj?.crateDestroyStarted) continue;

    obj.crateDestroyTimer = Math.max(0, obj.crateDestroyTimer - dt);

    if (obj.crateDestroyTimer > 0) {
      const flickerOn = Math.floor(obj.crateDestroyTimer * flickerHz) % 2 === 0;
      if (obj.mesh) obj.mesh.visible = CONFIG.DEBUG_MODE && flickerOn;
      if (obj.visual) obj.visual.visible = flickerOn;
      if (obj.axes) obj.axes.visible = CONFIG.DEBUG_MODE && flickerOn;
      continue;
    }

    destroyCrateAndAwardPoint(state, obj, i);
  }
}
```

```js
function destroyCrateAndAwardPoint(state, crate, index) {
  if (crate.body && state.physicsWorld) state.physicsWorld.removeRigidBody(crate.body);

  if (crate.mesh?.parent) crate.mesh.parent.remove(crate.mesh);
  if (crate.visual?.parent) crate.visual.parent.remove(crate.visual);
  if (crate.axes?.parent) crate.axes.parent.remove(crate.axes);

  state.debugAxes = state.debugAxes.filter((entry) => entry.group !== crate.axes);
  state.gameObjects.splice(index, 1);

  state.score += 1;
  updateScoreUI(state);
}
```
