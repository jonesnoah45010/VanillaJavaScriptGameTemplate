# Lesson 1: Add a Kick Animation to `game_core.js`

This lesson shows exactly how to update `static/js/game_core.js` so it behaves like `static/js/lesson1-game_core_kick.js`.

The goal is to add a one-shot kick animation that plays when the player presses `F`, while leaving the rest of the movement and animation system intact.

## Step 1: Put `kick.fbx` in the correct folder and add the config path

Before you change `static/js/game_core.js`, make sure your kick animation file is here:

```text
/static/player_fbx/kick.fbx
```

Then open `templates/basic_game.html` and find this section:

```js
      PLAYER_FBX_IDLE:   "/static/player_fbx/idle.fbx",
      PLAYER_FBX_MOVE:   "/static/player_fbx/move.fbx",
      PLAYER_FBX_IN_AIR: "/static/player_fbx/in_air.fbx",
      PLAYER_FBX_CLIMB:  "/static/player_fbx/climb.fbx",
```

Replace it with:

```js
      PLAYER_FBX_IDLE:   "/static/player_fbx/idle.fbx",
      PLAYER_FBX_MOVE:   "/static/player_fbx/move.fbx",
      PLAYER_FBX_IN_AIR: "/static/player_fbx/in_air.fbx",
      PLAYER_FBX_CLIMB:  "/static/player_fbx/climb.fbx",
      PLAYER_FBX_KICK:   "/static/player_fbx/kick.fbx",
```

After that, continue with the `game_core.js` changes below.

## Step 2: Update the game state in `createGameState()`

In `static/js/game_core.js`, find this input section:

```js
    // input
    keys: {},
    spaceWasDown: false,
```

Replace it with:

```js
    // input
    keys: {},
    spaceWasDown: false,
    kickWasDown: false,
```

Then find this player animation section:

```js
    playerVisual: null,
    playerMixer: null,
    playerActions: { idle: null, move: null, in_air: null, climb: null },
    playerCurrentAction: null,
    playerCurrentState: "idle",
```

Replace it with:

```js
    playerVisual: null,
    playerMixer: null,
    playerActions: { idle: null, move: null, in_air: null, climb: null, kick: null },
    playerCurrentAction: null,
    playerCurrentState: "idle",
    playerKickActive: false,
    playerKickTimer: 0,
```

After this step, the full new state fields you are adding are:

```js
kickWasDown: false
kick: null
playerKickActive: false
playerKickTimer: 0
```

## Step 3: Load the kick animation in `createPlayer()`

In `createPlayer(state, CONFIG, position)`, find this code:

```js
  const [moveClip, inAirClip, climbClip] = await Promise.all([
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_MOVE),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_IN_AIR),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_CLIMB),
  ]);
```

Replace it with:

```js
  const [moveClip, inAirClip, climbClip, kickClip] = await Promise.all([
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_MOVE),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_IN_AIR),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_CLIMB),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_KICK),
  ]);
```

Then find this code:

```js
  if (idleClip)   state.playerActions.idle   = state.playerMixer.clipAction(idleClip);
  if (moveClip)   state.playerActions.move   = state.playerMixer.clipAction(moveClip);
  if (inAirClip)  state.playerActions.in_air = state.playerMixer.clipAction(inAirClip);
  if (climbClip)  state.playerActions.climb  = state.playerMixer.clipAction(climbClip);
```

Replace it with:

```js
  if (idleClip)   state.playerActions.idle   = state.playerMixer.clipAction(idleClip);
  if (moveClip)   state.playerActions.move   = state.playerMixer.clipAction(moveClip);
  if (inAirClip)  state.playerActions.in_air = state.playerMixer.clipAction(inAirClip);
  if (climbClip)  state.playerActions.climb  = state.playerMixer.clipAction(climbClip);
  if (kickClip)   state.playerActions.kick   = state.playerMixer.clipAction(kickClip);
```

Leave this loop as-is:

```js
  for (const k of ["idle","move","in_air","climb"]) {
    const a = state.playerActions[k];
    if (!a) continue;
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = false;
    a.enabled = true;
    a.timeScale = 1;
  }
```

Immediately after that loop, add this new block:

```js
  if (state.playerActions.kick) {
    state.playerActions.kick.setLoop(THREE.LoopOnce, 1);
    state.playerActions.kick.clampWhenFinished = true;
    state.playerActions.kick.enabled = true;
    state.playerActions.kick.timeScale = 1;
  }
```

After this step, the relevant part of `createPlayer()` should look like this:

```js
  const idleClip = (idleObj.animations && idleObj.animations.length > 0) ? idleObj.animations[0] : null;

  const [moveClip, inAirClip, climbClip, kickClip] = await Promise.all([
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_MOVE),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_IN_AIR),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_CLIMB),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_KICK),
  ]);

  if (idleClip)   state.playerActions.idle   = state.playerMixer.clipAction(idleClip);
  if (moveClip)   state.playerActions.move   = state.playerMixer.clipAction(moveClip);
  if (inAirClip)  state.playerActions.in_air = state.playerMixer.clipAction(inAirClip);
  if (climbClip)  state.playerActions.climb  = state.playerMixer.clipAction(climbClip);
  if (kickClip)   state.playerActions.kick   = state.playerMixer.clipAction(kickClip);

  for (const k of ["idle","move","in_air","climb"]) {
    const a = state.playerActions[k];
    if (!a) continue;
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = false;
    a.enabled = true;
    a.timeScale = 1;
  }

  if (state.playerActions.kick) {
    state.playerActions.kick.setLoop(THREE.LoopOnce, 1);
    state.playerActions.kick.clampWhenFinished = true;
    state.playerActions.kick.enabled = true;
    state.playerActions.kick.timeScale = 1;
  }
```

## Step 4: Add `triggerKick(state, CONFIG)` after `playPlayerAction()`

Find this function:

```js
function playPlayerAction(state, CONFIG, name, immediate = false) {
  const next = state.playerActions[name];
  if (!next) return;
  if (state.playerCurrentAction === next) return;

  next.reset();
  next.play();

  if (state.playerCurrentAction && !immediate) {
    state.playerCurrentAction.crossFadeTo(next, CONFIG.FADE_SECONDS, false);
  } else if (state.playerCurrentAction && immediate) {
    state.playerCurrentAction.stop();
  }

  state.playerCurrentAction = next;
  state.playerCurrentState = name;
}
```

Keep that function, and immediately after it add this new function:

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

After this step, the section should look like this:

```js
function playPlayerAction(state, CONFIG, name, immediate = false) {
  const next = state.playerActions[name];
  if (!next) return;
  if (state.playerCurrentAction === next) return;

  next.reset();
  next.play();

  if (state.playerCurrentAction && !immediate) {
    state.playerCurrentAction.crossFadeTo(next, CONFIG.FADE_SECONDS, false);
  } else if (state.playerCurrentAction && immediate) {
    state.playerCurrentAction.stop();
  }

  state.playerCurrentAction = next;
  state.playerCurrentState = name;
}

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

## Step 5: Add the `F` key trigger in `handleInput()`

In `handleInput(state, CONFIG, dt)`, find this ending:

```js
  const spaceDown = !!state.keys["Space"];
  if (spaceDown && !state.spaceWasDown) {
    if (state.playerClimbing) wallJumpOff(state, CONFIG);
    else if (grounded) jump(state, CONFIG);
  }
  state.spaceWasDown = spaceDown;
}
```

Replace it with:

```js
  const spaceDown = !!state.keys["Space"];
  if (spaceDown && !state.spaceWasDown) {
    if (state.playerClimbing) wallJumpOff(state, CONFIG);
    else if (grounded) jump(state, CONFIG);
  }
  state.spaceWasDown = spaceDown;

  const kickDown = !!state.keys["KeyF"];
  if (kickDown && !state.kickWasDown) triggerKick(state, CONFIG);
  state.kickWasDown = kickDown;
}
```

That is the only change needed inside `handleInput()`.

## Step 6: Let the kick animation temporarily override the normal animation state machine

In `updatePlayerAnimationState(state, CONFIG, dt)`, find the beginning of the function:

```js
function updatePlayerAnimationState(state, CONFIG, dt) {
  if (!state.Player || !state.playerMixer) return;

  // if climbing, don't switch to in_air
  if (state.playerClimbing || state.climbAnimGrace > 0) {
    state.animInAir = false;
    state.animAirTimer = 0;
    if (state.playerCurrentState !== "climb") playPlayerAction(state, CONFIG, "climb", false);
    return;
  }
```

Replace it with:

```js
function updatePlayerAnimationState(state, CONFIG, dt) {
  if (!state.Player || !state.playerMixer) return;

  if (state.playerKickActive) {
    state.playerKickTimer = Math.max(0, state.playerKickTimer - dt);
    if (state.playerCurrentState !== "kick") playPlayerAction(state, CONFIG, "kick", false);
    if (state.playerKickTimer > 0) return;
    state.playerKickActive = false;
  }

  // if climbing, don't switch to in_air
  if (state.playerClimbing || state.climbAnimGrace > 0) {
    state.animInAir = false;
    state.animAirTimer = 0;
    if (state.playerCurrentState !== "climb") playPlayerAction(state, CONFIG, "climb", false);
    return;
  }
```

Nothing else in `updatePlayerAnimationState()` needs to change.

## Final code checklist

When you finish, `static/js/game_core.js` should contain all of these new code pieces:

```js
kickWasDown: false
```

```js
playerActions: { idle: null, move: null, in_air: null, climb: null, kick: null }
```

```js
playerKickActive: false,
playerKickTimer: 0,
```

```js
const [moveClip, inAirClip, climbClip, kickClip] = await Promise.all([
  loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_MOVE),
  loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_IN_AIR),
  loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_CLIMB),
  loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_KICK),
]);
```

```js
if (kickClip)   state.playerActions.kick   = state.playerMixer.clipAction(kickClip);
```

```js
if (state.playerActions.kick) {
  state.playerActions.kick.setLoop(THREE.LoopOnce, 1);
  state.playerActions.kick.clampWhenFinished = true;
  state.playerActions.kick.enabled = true;
  state.playerActions.kick.timeScale = 1;
}
```

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

```js
const kickDown = !!state.keys["KeyF"];
if (kickDown && !state.kickWasDown) triggerKick(state, CONFIG);
state.kickWasDown = kickDown;
```

```js
if (state.playerKickActive) {
  state.playerKickTimer = Math.max(0, state.playerKickTimer - dt);
  if (state.playerCurrentState !== "kick") playPlayerAction(state, CONFIG, "kick", false);
  if (state.playerKickTimer > 0) return;
  state.playerKickActive = false;
}
```
