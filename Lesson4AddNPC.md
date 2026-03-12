# Lesson 4: Add a Follower NPC

This lesson shows exactly how to update `static/js/lesson3-game_core_kick_crate_points.js` so it behaves like `static/js/lesson4-game_core_kick_crate_points-npc.js`.

The goal is to keep all player, crate, and points behavior, then add an NPC that follows the player and animates separately.

## Step 1: Add NPC state in `createGameState()`

Find this player state section:

```js
    playerKickActive: false,
    playerKickTimer: 0,
    playerKickDuration: 0,
    playerKickImpactApplied: false,
```

Replace it with:

```js
    playerKickActive: false,
    playerKickTimer: 0,
    playerKickDuration: 0,
    playerKickImpactApplied: false,
    npc: null,
    npcPtr: 0,
    npcDebugMesh: null,
    npcVisual: null,
    npcMixer: null,
    npcActions: { idle: null, move: null, in_air: null, climb: null, kick: null },
    npcCurrentAction: null,
    npcCurrentState: "idle",
    npcMoveAnimDir: 1,
    npcGrounded: false,
```

## Step 2: Spawn the NPC in `startCore()`

Find this block:

```js
  await createPlayer(state, CONFIG, CONFIG.PLAYER_STARTING_POSITION);

  bindKeys(state);
```

Replace it with:

```js
  await createPlayer(state, CONFIG, CONFIG.PLAYER_STARTING_POSITION);
  await createNPC(state, CONFIG, getNpcStartingPosition(CONFIG));

  bindKeys(state);
```

## Step 3: Update `stepCore()` to run NPC movement and animation

Find this function:

```js
export function stepCore(state, CONFIG, dt) {
  if (!state.physicsWorld || !state.renderer) return;

  // physics
  state.physicsWorld.stepSimulation(dt, 1);

  // contacts + input
  updatePlayerContacts(state, CONFIG);
  handleInput(state, CONFIG, dt);

  // sync visuals
  syncVisualsFromPhysics(state, CONFIG);
  updateCrateEffects(state, CONFIG, dt);

  // animations
  updatePlayerAnimationState(state, CONFIG, dt);
  if (state.playerMixer) state.playerMixer.update(dt);

  // camera + render
  updateCamera(state, CONFIG);
  state.renderer.render(state.scene, state.camera);
}
```

Replace it with:

```js
export function stepCore(state, CONFIG, dt) {
  if (!state.physicsWorld || !state.renderer) return;

  // physics
  state.physicsWorld.stepSimulation(dt, 1);

  // contacts + input
  updatePlayerContacts(state, CONFIG);
  handleInput(state, CONFIG, dt);
  updateNPC(state, CONFIG, dt);

  // sync visuals
  syncVisualsFromPhysics(state, CONFIG);
  updateCrateEffects(state, CONFIG, dt);

  // animations
  updatePlayerAnimationState(state, CONFIG, dt);
  updateNpcAnimationState(state, CONFIG, dt);
  if (state.playerMixer) state.playerMixer.update(dt);
  if (state.npcMixer) state.npcMixer.update(dt);

  // camera + render
  updateCamera(state, CONFIG);
  state.renderer.render(state.scene, state.camera);
}
```

## Step 4: Make debug mode control the NPC debug mesh too

Find this section inside `setDebugMode(state, CONFIG, on)`:

```js
  if (state.playerDebugMesh) state.playerDebugMesh.visible = on;

  for (const obj of state.gameObjects) {
```

Replace it with:

```js
  if (state.playerDebugMesh) state.playerDebugMesh.visible = on;
  if (state.npcDebugMesh) state.npcDebugMesh.visible = on;

  for (const obj of state.gameObjects) {
```

## Step 5: Add NPC config helper functions before `createPlayer()`

Immediately before `createPlayer(state, CONFIG, position)`, add these functions:

```js
function getNpcStartingPosition(CONFIG) {
  if (CONFIG.NPC_STARTING_POSITION) return CONFIG.NPC_STARTING_POSITION;
  return CONFIG.PLAYER_STARTING_POSITION.clone().add(new THREE.Vector3(-18, 0, -18));
}

function getNpcRadius(CONFIG) {
  return CONFIG.NPC_RADIUS ?? CONFIG.PLAYER_RADIUS;
}

function getNpcHeight(CONFIG) {
  return CONFIG.NPC_HEIGHT ?? CONFIG.PLAYER_HEIGHT;
}

function getNpcMass(CONFIG) {
  return CONFIG.NPC_MASS ?? CONFIG.PLAYER_MASS;
}

function getNpcModelScale(CONFIG) {
  return CONFIG.NPC_MODEL_SCALE ?? CONFIG.PLAYER_MODEL_SCALE;
}

function getNpcModelRotation(CONFIG) {
  return CONFIG.NPC_MODEL_ROTATION ?? CONFIG.PLAYER_MODEL_ROTATION;
}

function getNpcModelOffset(CONFIG) {
  return CONFIG.NPC_MODEL_OFFSET ?? CONFIG.PLAYER_MODEL_OFFSET;
}

function getNpcFbxPath(CONFIG, key) {
  const specific = CONFIG[`NPC_FBX_${key}`];
  if (specific) return specific;
  return CONFIG[`PLAYER_FBX_${key}`];
}
```

## Step 6: Add `createNPC()` before `loadFBX()`

Immediately after `createPlayer(state, CONFIG, position)`, add this function:

```js
async function createNPC(state, CONFIG, position) {
  const radius = getNpcRadius(CONFIG);
  const height = getNpcHeight(CONFIG);
  const shape = new Ammo.btCapsuleShape(radius, height - 2 * radius);
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(position.x, position.y + height / 2, position.z));

  const yawDeg = CONFIG.NPC_STARTING_YAW_DEG ?? CONFIG.PLAYER_STARTING_YAW_DEG;
  const yawRad = THREE.MathUtils.degToRad(yawDeg);
  transform.setRotation(new Ammo.btQuaternion(0, Math.sin(yawRad / 2), 0, Math.cos(yawRad / 2)));

  const motionState = new Ammo.btDefaultMotionState(transform);
  const localInertia = new Ammo.btVector3(0, 0, 0);
  shape.calculateLocalInertia(getNpcMass(CONFIG), localInertia);

  const rbInfo = new Ammo.btRigidBodyConstructionInfo(getNpcMass(CONFIG), motionState, shape, localInertia);
  const body = new Ammo.btRigidBody(rbInfo);
  body.setRestitution(0);
  body.setFriction(CONFIG.NPC_DEFAULT_FRICTION ?? CONFIG.PLAYER_DEFAULT_FRICTION);
  body.setDamping(0.2, 0.98);
  body.setAngularFactor(new Ammo.btVector3(0, 0, 0));
  body.setActivationState(Ammo.DISABLE_DEACTIVATION);

  state.physicsWorld.addRigidBody(body);
  state.npc = body;
  state.npcPtr = Ammo.getPointer(body);

  state.npcDebugMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, height - 2 * radius, 8, 16),
    new THREE.MeshBasicMaterial({ color: 0xff66aa, wireframe: true })
  );
  state.npcDebugMesh.visible = CONFIG.DEBUG_MODE;
  state.scene.add(state.npcDebugMesh);

  const npcAxes = createAxes(state, CONFIG, 12);
  state.debugAxes.push({ group: npcAxes, ownerName: "npc" });
  state.npc.__axes = npcAxes;

  const fbxLoader = new FBXLoader();
  const idleObj = await loadFBX(fbxLoader, getNpcFbxPath(CONFIG, "IDLE"));
  idleObj.scale.copy(getNpcModelScale(CONFIG));
  idleObj.rotation.copy(getNpcModelRotation(CONFIG));
  idleObj.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = false;
      c.receiveShadow = false;
      if (c.material) c.material.transparent = false;
    }
  });

  state.scene.add(idleObj);
  state.npcVisual = idleObj;
  state.npcMixer = new THREE.AnimationMixer(state.npcVisual);

  const idleClip = (idleObj.animations && idleObj.animations.length > 0) ? idleObj.animations[0] : null;
  const [moveClip, inAirClip, climbClip, kickClip] = await Promise.all([
    loadFirstClipFromFBX(fbxLoader, getNpcFbxPath(CONFIG, "MOVE")),
    loadFirstClipFromFBX(fbxLoader, getNpcFbxPath(CONFIG, "IN_AIR")),
    loadFirstClipFromFBX(fbxLoader, getNpcFbxPath(CONFIG, "CLIMB")),
    loadFirstClipFromFBX(fbxLoader, getNpcFbxPath(CONFIG, "KICK")),
  ]);

  if (idleClip)   state.npcActions.idle   = state.npcMixer.clipAction(idleClip);
  if (moveClip)   state.npcActions.move   = state.npcMixer.clipAction(moveClip);
  if (inAirClip)  state.npcActions.in_air = state.npcMixer.clipAction(inAirClip);
  if (climbClip)  state.npcActions.climb  = state.npcMixer.clipAction(climbClip);
  if (kickClip)   state.npcActions.kick   = state.npcMixer.clipAction(kickClip);

  for (const k of ["idle", "move", "in_air", "climb"]) {
    const a = state.npcActions[k];
    if (!a) continue;
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = false;
    a.enabled = true;
    a.timeScale = 1;
  }

  if (state.npcActions.kick) {
    state.npcActions.kick.setLoop(THREE.LoopOnce, 1);
    state.npcActions.kick.clampWhenFinished = true;
    state.npcActions.kick.enabled = true;
    state.npcActions.kick.timeScale = 1;
  }

  if (state.npcActions.idle) playNpcAction(state, CONFIG, "idle", true);
  else if (state.npcActions.move) playNpcAction(state, CONFIG, "move", true);
  else if (state.npcActions.in_air) playNpcAction(state, CONFIG, "in_air", true);
}
```

## Step 7: Add NPC movement helpers after `getBodyPosition()`

Immediately after `getBodyPosition(body)`, add these functions:

```js
function getBodyBasis(body) {
  const t = body.getWorldTransform();
  const q = t.getRotation();
  const quat = new THREE.Quaternion(q.x(), q.y(), q.z(), q.w());
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat).normalize();
  return { forward, right };
}

function setBodyFacingDirection(body, dir) {
  const flatDir = dir.clone().setY(0);
  if (flatDir.lengthSq() <= 1e-6) return;
  flatDir.normalize();

  const yaw = Math.atan2(flatDir.x, flatDir.z);
  const t = body.getWorldTransform();
  t.setRotation(new Ammo.btQuaternion(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)));
  body.setWorldTransform(t);
  body.activate();
}

function rotateFlatVector(vec, radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return new THREE.Vector3(
    vec.x * cos - vec.z * sin,
    0,
    vec.x * sin + vec.z * cos
  );
}

function castObstacleRay(state, start, direction, distance, ignorePtrs = []) {
  const dir = direction.clone().setY(0);
  if (dir.lengthSq() <= 1e-6) return { blocked: false, distance };
  dir.normalize();

  const end = start.clone().add(dir.multiplyScalar(distance));
  const btStart = new Ammo.btVector3(start.x, start.y, start.z);
  const btEnd = new Ammo.btVector3(end.x, end.y, end.z);
  const cb = new Ammo.ClosestRayResultCallback(btStart, btEnd);
  state.physicsWorld.rayTest(btStart, btEnd, cb);

  let blocked = false;
  let hitDistance = distance;

  if (cb.hasHit()) {
    const hitObject = cb.get_m_collisionObject ? cb.get_m_collisionObject() : null;
    const hitPtr = hitObject ? Ammo.getPointer(hitObject) : 0;
    if (!ignorePtrs.includes(hitPtr)) {
      blocked = true;
      const hitPoint = cb.get_m_hitPointWorld();
      const dx = hitPoint.x() - start.x;
      const dy = hitPoint.y() - start.y;
      const dz = hitPoint.z() - start.z;
      hitDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  }

  Ammo.destroy(btStart);
  Ammo.destroy(btEnd);
  Ammo.destroy(cb);
  return { blocked, distance: hitDistance };
}

function isBodyGroundedRay(state, body, height, radius, threshold = 2) {
  const transform = new Ammo.btTransform();
  body.getMotionState().getWorldTransform(transform);
  const origin = transform.getOrigin();

  const rayStart = new THREE.Vector3(
    origin.x(),
    origin.y() - height / 2 + radius - 0.1,
    origin.z()
  );
  const rayEnd = rayStart.clone().add(new THREE.Vector3(0, -threshold, 0));

  const btStart = new Ammo.btVector3(rayStart.x, rayStart.y, rayStart.z);
  const btEnd = new Ammo.btVector3(rayEnd.x, rayEnd.y, rayEnd.z);
  const cb = new Ammo.ClosestRayResultCallback(btStart, btEnd);
  state.physicsWorld.rayTest(btStart, btEnd, cb);

  const hit = cb.hasHit();
  Ammo.destroy(btStart);
  Ammo.destroy(btEnd);
  Ammo.destroy(cb);
  Ammo.destroy(transform);
  return hit;
}
```

## Step 8: Add `playNpcAction()` after `playPlayerAction()`

Immediately after `playPlayerAction(state, CONFIG, name, immediate = false)`, add this function:

```js
function playNpcAction(state, CONFIG, name, immediate = false) {
  const next = state.npcActions[name];
  if (!next) return;
  if (state.npcCurrentAction === next) return;

  next.reset();
  next.play();

  if (state.npcCurrentAction && !immediate) {
    state.npcCurrentAction.crossFadeTo(next, CONFIG.NPC_FADE_SECONDS ?? CONFIG.FADE_SECONDS, false);
  } else if (state.npcCurrentAction && immediate) {
    state.npcCurrentAction.stop();
  }

  state.npcCurrentAction = next;
  state.npcCurrentState = name;
}
```

## Step 9: Add `updateNPC()` before `updatePlayerContacts()`

Immediately before `updatePlayerContacts(state, CONFIG)`, add this function:

```js
function updateNPC(state, CONFIG, dt) {
  if (!state.npc || !state.Player) return;

  const npcPos = getBodyPosition(state.npc);
  const playerPos = getBodyPosition(state.Player);
  if (!npcPos || !playerPos) return;

  const toPlayer = playerPos.clone().sub(npcPos).setY(0);
  const distance = toPlayer.length();
  const stopDistance = CONFIG.NPC_FOLLOW_STOP_DISTANCE ?? 18;
  const npcHeight = getNpcHeight(CONFIG);
  const npcRadius = getNpcRadius(CONFIG);

  state.npcGrounded = isBodyGroundedRay(state, state.npc, npcHeight, npcRadius, 2);

  const lv = state.npc.getLinearVelocity();
  const current = new THREE.Vector3(lv.x(), 0, lv.z());

  if (distance <= stopDistance || distance <= 1e-6) {
    const brake = (CONFIG.NPC_BRAKE ?? CONFIG.PLAYER_BRAKE) * dt;
    if (current.length() > brake && brake > 0) current.addScaledVector(current.clone().normalize(), -brake);
    else current.set(0, 0, 0);
    state.npc.setLinearVelocity(new Ammo.btVector3(current.x, lv.y(), current.z));
    state.npc.activate();
    return;
  }

  const targetDir = toPlayer.normalize();
  const rayStart = npcPos.clone().add(new THREE.Vector3(0, npcHeight * 0.3, 0));
  const rayDistance = CONFIG.NPC_AVOID_RAY_DISTANCE ?? 14;
  const avoidAngle = THREE.MathUtils.degToRad(CONFIG.NPC_AVOID_ANGLE_DEG ?? 35);
  const ignorePtrs = [state.npcPtr, state.playerPtr];

  const centerRay = castObstacleRay(state, rayStart, targetDir, rayDistance, ignorePtrs);
  const leftDir = rotateFlatVector(targetDir, avoidAngle);
  const rightDir = rotateFlatVector(targetDir, -avoidAngle);
  const leftRay = castObstacleRay(state, rayStart, leftDir, rayDistance, ignorePtrs);
  const rightRay = castObstacleRay(state, rayStart, rightDir, rayDistance, ignorePtrs);

  let moveDir = targetDir.clone();
  if (centerRay.blocked) {
    if (!leftRay.blocked && rightRay.blocked) moveDir = leftDir;
    else if (!rightRay.blocked && leftRay.blocked) moveDir = rightDir;
    else if (!leftRay.blocked && !rightRay.blocked) moveDir = (leftRay.distance >= rightRay.distance) ? leftDir : rightDir;
    else moveDir = (leftRay.distance >= rightRay.distance) ? leftDir : rightDir;
  } else {
    const leftWeight = leftRay.blocked ? 0.2 : 1.0;
    const rightWeight = rightRay.blocked ? 0.2 : 1.0;
    moveDir = targetDir.clone()
      .add(leftDir.clone().multiplyScalar(leftWeight * 0.15))
      .add(rightDir.clone().multiplyScalar(rightWeight * 0.15))
      .normalize();
  }

  setBodyFacingDirection(state.npc, moveDir);

  const maxSpeed = CONFIG.NPC_MAX_SPEED ?? (CONFIG.PLAYER_MAX_SPEED * 0.85);
  const accel = (CONFIG.NPC_ACCEL ?? CONFIG.PLAYER_ACCEL) * dt;
  const desired = moveDir.multiplyScalar(maxSpeed);
  const delta = desired.sub(current);
  const deltaLen = delta.length();
  if (deltaLen > accel && deltaLen > 1e-6) delta.multiplyScalar(accel / deltaLen);

  const newVel = current.add(delta);
  const sideDamp = state.npcGrounded
    ? (CONFIG.NPC_SIDE_DAMP_GROUND ?? CONFIG.PLAYER_SIDE_DAMP_GROUND)
    : (CONFIG.NPC_SIDE_DAMP_AIR ?? CONFIG.PLAYER_SIDE_DAMP_AIR);
  const { forward, right } = getBodyBasis(state.npc);
  const f = forward.clone().setY(0).normalize();
  const r = right.clone().setY(0).normalize();
  const fSpd = newVel.dot(f);
  const rSpd = newVel.dot(r);
  const rKeep = Math.exp(-sideDamp * dt);
  newVel.copy(f.multiplyScalar(fSpd).add(r.multiplyScalar(rSpd * rKeep)));

  const speed = newVel.length();
  if (speed > maxSpeed) newVel.multiplyScalar(maxSpeed / speed);

  state.npc.setFriction(CONFIG.NPC_DEFAULT_FRICTION ?? CONFIG.PLAYER_DEFAULT_FRICTION);
  state.npc.setLinearVelocity(new Ammo.btVector3(newVel.x, lv.y(), newVel.z));
  state.npc.activate();
}
```

## Step 10: Add `updateNpcAnimationState()` after `updatePlayerAnimationState()`

Immediately after `updatePlayerAnimationState(state, CONFIG, dt)`, add this function:

```js
function updateNpcAnimationState(state, CONFIG, dt) {
  if (!state.npc || !state.npcMixer) return;

  const lv = state.npc.getLinearVelocity();
  const horizSpeed = Math.sqrt(lv.x() * lv.x() + lv.z() * lv.z());
  state.npcGrounded = isBodyGroundedRay(state, state.npc, getNpcHeight(CONFIG), getNpcRadius(CONFIG), 2);

  let desired = "idle";
  if (!state.npcGrounded) desired = "in_air";
  else if (horizSpeed > (CONFIG.NPC_MOVE_SPEED_THRESHOLD ?? CONFIG.MOVE_SPEED_THRESHOLD)) desired = "move";

  if (desired !== state.npcCurrentState) playNpcAction(state, CONFIG, desired, false);

  const moveAction = state.npcActions.move;
  if (moveAction) {
    moveAction.timeScale = 1;
    state.npcMoveAnimDir = 1;
  }
}
```

## Step 11: Replace `syncVisualsFromPhysics()` with the NPC-aware version

Find the existing `syncVisualsFromPhysics(state, CONFIG)` function in `static/js/lesson3-game_core_kick_crate_points.js` and replace the entire function with this version:

```js
function syncVisualsFromPhysics(state, CONFIG) {
  for (const obj of state.gameObjects) {
    const { body, mesh, visual, visualOffset, visualRotationOffset } = obj;
    const ms = body.getMotionState();
    if (!ms) continue;

    ms.getWorldTransform(state.tmpTransform);
    const origin = state.tmpTransform.getOrigin();
    const rot = state.tmpTransform.getRotation();

    if (mesh) {
      mesh.position.set(origin.x(), origin.y(), origin.z());
      mesh.quaternion.set(rot.x(), rot.y(), rot.z(), rot.w());
    }

    if (obj.axes) {
      obj.axes.position.set(origin.x(), origin.y(), origin.z());
      obj.axes.quaternion.set(rot.x(), rot.y(), rot.z(), rot.w());
    }

    if (visual) {
      const meshQuat = new THREE.Quaternion(rot.x(), rot.y(), rot.z(), rot.w());
      const offsetRotated = visualOffset ? visualOffset.clone().applyQuaternion(meshQuat) : new THREE.Vector3(0, 0, 0);
      visual.position.set(origin.x(), origin.y(), origin.z());
      visual.position.add(offsetRotated);

      if (visualRotationOffset) {
        const finalQuat = meshQuat.clone().multiply(visualRotationOffset);
        visual.quaternion.copy(finalQuat);
      } else {
        visual.quaternion.copy(meshQuat);
      }
    }
  }

  // player visuals
  if (state.Player) {
    state.Player.getMotionState().getWorldTransform(state.tmpTransform);
    const o = state.tmpTransform.getOrigin();
    const r = state.tmpTransform.getRotation();

    const bodyPos = new THREE.Vector3(o.x(), o.y(), o.z());
    const bodyQuat = new THREE.Quaternion(r.x(), r.y(), r.z(), r.w());

    if (state.playerDebugMesh) {
      state.playerDebugMesh.position.copy(bodyPos);
      state.playerDebugMesh.quaternion.copy(bodyQuat);
    }
    if (state.Player.__axes) {
      state.Player.__axes.position.copy(bodyPos);
      state.Player.__axes.quaternion.copy(bodyQuat);
    }
    if (state.playerVisual) {
      state.playerVisual.position.copy(bodyPos).add(CONFIG.PLAYER_MODEL_OFFSET.clone().applyQuaternion(bodyQuat));
      state.playerVisual.quaternion.copy(bodyQuat).multiply(new THREE.Quaternion().setFromEuler(CONFIG.PLAYER_MODEL_ROTATION));
    }
  }

  if (state.npc) {
    state.npc.getMotionState().getWorldTransform(state.tmpTransform);
    const o = state.tmpTransform.getOrigin();
    const r = state.tmpTransform.getRotation();

    const bodyPos = new THREE.Vector3(o.x(), o.y(), o.z());
    const bodyQuat = new THREE.Quaternion(r.x(), r.y(), r.z(), r.w());
    const npcModelOffset = getNpcModelOffset(CONFIG);
    const npcModelRotation = getNpcModelRotation(CONFIG);

    if (state.npcDebugMesh) {
      state.npcDebugMesh.position.copy(bodyPos);
      state.npcDebugMesh.quaternion.copy(bodyQuat);
    }
    if (state.npc.__axes) {
      state.npc.__axes.position.copy(bodyPos);
      state.npc.__axes.quaternion.copy(bodyQuat);
    }
    if (state.npcVisual) {
      state.npcVisual.position.copy(bodyPos).add(npcModelOffset.clone().applyQuaternion(bodyQuat));
      state.npcVisual.quaternion.copy(bodyQuat).multiply(new THREE.Quaternion().setFromEuler(npcModelRotation));
    }
  }
}
```

## Final code checklist

When you finish, `static/js/lesson3-game_core_kick_crate_points.js` should contain these new code pieces:

```js
npc: null,
npcPtr: 0,
npcDebugMesh: null,
npcVisual: null,
npcMixer: null,
npcActions: { idle: null, move: null, in_air: null, climb: null, kick: null },
npcCurrentAction: null,
npcCurrentState: "idle",
npcMoveAnimDir: 1,
npcGrounded: false,
```

```js
await createNPC(state, CONFIG, getNpcStartingPosition(CONFIG));
```

```js
updateNPC(state, CONFIG, dt);
updateNpcAnimationState(state, CONFIG, dt);
if (state.npcMixer) state.npcMixer.update(dt);
```

```js
if (state.npcDebugMesh) state.npcDebugMesh.visible = on;
```

```js
function getNpcFbxPath(CONFIG, key) {
  const specific = CONFIG[`NPC_FBX_${key}`];
  if (specific) return specific;
  return CONFIG[`PLAYER_FBX_${key}`];
}
```

```js
function playNpcAction(state, CONFIG, name, immediate = false) {
  const next = state.npcActions[name];
  if (!next) return;
  if (state.npcCurrentAction === next) return;

  next.reset();
  next.play();

  if (state.npcCurrentAction && !immediate) {
    state.npcCurrentAction.crossFadeTo(next, CONFIG.NPC_FADE_SECONDS ?? CONFIG.FADE_SECONDS, false);
  } else if (state.npcCurrentAction && immediate) {
    state.npcCurrentAction.stop();
  }

  state.npcCurrentAction = next;
  state.npcCurrentState = name;
}
```

```js
function updateNPC(state, CONFIG, dt) {
  if (!state.npc || !state.Player) return;
  // ...
}
```

```js
function updateNpcAnimationState(state, CONFIG, dt) {
  if (!state.npc || !state.npcMixer) return;
  // ...
}
```
