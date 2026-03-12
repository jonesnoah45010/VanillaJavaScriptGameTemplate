// /static/js/game_core.js
import * as THREE from "/static/js/three/three.module.js";
import { FBXLoader } from "/static/js/three/loaders/FBXLoader.js";
import { MTLLoader } from "/static/js/three/MTLLoader.js";
import { OBJLoader } from "/static/js/three/OBJLoader.js";

// ------------------------------------------------------------
// Used by basic_game.html for core game mechanics
// ------------------------------------------------------------
export function createGameState() {
  return {
    // three
    scene: null,
    camera: null,
    renderer: null,

    // ammo
    physicsWorld: null,
    tmpTransform: null,
    dispatcher: null,

    // input
    keys: {},
    spaceWasDown: false,
    kickWasDown: false,

    // debug
    debugUiCheckbox: null,
    debugAxes: [],
    gameObjects: [],
    staticTrimeshDebug: [],

    // player
    Player: null,
    playerPtr: 0,
    playerDebugMesh: null,
    playerVisual: null,
    playerMixer: null,
    playerActions: { idle: null, move: null, in_air: null, climb: null, kick: null },
    playerCurrentAction: null,
    playerCurrentState: "idle",
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

    // player contact state
    playerGrounded: false,
    playerOnWall: false,
    playerWallNormal: new THREE.Vector3(0, 0, 0),

    // climb state
    playerClimbing: false,
    climbExitTimer: 0,
    climbAnimGrace: 0,

    // anim grounding gate
    animInAir: false,
    animAirTimer: 0,

    // camera/pointer-lock
    pointerLocked: false,
    cameraYawInitialized: false,
    cameraYaw: 0,
    cameraPitch: 0,
    cameraDistance: 30,
    playerHeightAboveGround: 0,

    // anim helpers
    lastMoveAxis: 0,
    moveAnimDir: 1,

    // shared loaders
    sharedMtlLoader: new MTLLoader(),
    sharedObjLoader: new OBJLoader(),

    // shared
    clock: new THREE.Clock(),
    textureLoader: new THREE.TextureLoader(),
    score: 0,
    scoreUi: null,
  };
}

export async function startCore(state, CONFIG) {
  // Executres once at the start of the game
  await Ammo();
  state.tmpTransform = new Ammo.btTransform();

  initThree(state, CONFIG);
  createDebugUI(state, CONFIG);
  createScoreUI(state);
  initPhysics(state, CONFIG);

  createSkySphere(state);
  createPlane(state, CONFIG);
  createLighting(state);

  createStaticGroundCollider(state, CONFIG);
  spawnEnvironment(state, CONFIG);

  await createPlayer(state, CONFIG, CONFIG.PLAYER_STARTING_POSITION);
  await createNPC(state, CONFIG, getNpcStartingPosition(CONFIG));

  bindKeys(state);
  setDebugMode(state, CONFIG, CONFIG.DEBUG_MODE);

  // camera defaults
  state.cameraPitch = CONFIG.CAMERA_DEFAULT_PITCH;
  state.cameraDistance = THREE.MathUtils.clamp(
    state.cameraDistance,
    CONFIG.CAMERA_MIN_DISTANCE,
    CONFIG.CAMERA_MAX_DISTANCE
  );
}

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

// ------------------------------------------------------------
// Three.js init + pointer lock camera
// ------------------------------------------------------------
function initThree(state, CONFIG) {
  state.scene = new THREE.Scene();

  state.camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    20000
  );
  state.camera.position.set(0, 55, 100);
  state.camera.lookAt(0, 0, 0);

  state.renderer = new THREE.WebGLRenderer({ antialias: true });
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(state.renderer.domElement);

  const canvas = state.renderer.domElement;
  document.body.style.cursor = "default";

  const requestLock = () => {
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  };

  canvas.addEventListener("click", () => requestLock());

  document.addEventListener("pointerlockchange", () => {
    state.pointerLocked = (document.pointerLockElement === canvas);
    document.body.style.cursor = state.pointerLocked ? "none" : "default";
  });

  document.addEventListener("pointerlockerror", () => {
    state.pointerLocked = false;
    document.body.style.cursor = "default";
  });

  document.addEventListener("mousemove", (e) => {
    if (!state.pointerLocked) return;

    state.cameraYaw   -= e.movementX * CONFIG.MOUSE_YAW_SENSITIVITY;
    state.cameraPitch -= e.movementY * CONFIG.MOUSE_PITCH_SENSITIVITY;
    state.cameraPitch  = THREE.MathUtils.clamp(
      state.cameraPitch,
      getDynamicMinPitch(state, CONFIG),
      CONFIG.CAMERA_MAX_PITCH
    );
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.code === "Escape") {
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    }
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = Math.sign(e.deltaY);
    state.cameraDistance = THREE.MathUtils.clamp(
      state.cameraDistance + delta * 2.0,
      CONFIG.CAMERA_MIN_DISTANCE,
      CONFIG.CAMERA_MAX_DISTANCE
    );
  }, { passive: false });

  window.addEventListener("resize", () => onResize(state));
}

function onResize(state) {
  if (!state.camera || !state.renderer) return;
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}

// ------------------------------------------------------------
// Ammo init
// ------------------------------------------------------------
function initPhysics(state, CONFIG) {
  const config = new Ammo.btDefaultCollisionConfiguration();
  state.dispatcher = new Ammo.btCollisionDispatcher(config);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  state.physicsWorld = new Ammo.btDiscreteDynamicsWorld(
    state.dispatcher,
    broadphase,
    solver,
    config
  );
  state.physicsWorld.setGravity(new Ammo.btVector3(0, CONFIG.GRAVITY, 0));
}

// ------------------------------------------------------------
// Debug UI
// ------------------------------------------------------------
function createDebugUI(state, CONFIG) {
  const ui = document.createElement("div");
  ui.id = "debug-ui";

  ui.innerHTML = `
    <div class="ui-header">
      <div class="title">Controls</div>
      <button id="ui-collapse" type="button" aria-label="Hide controls">Hide</button>
    </div>

    <div class="content">
      <label>
        <input id="debug-toggle" type="checkbox" />
        <span>Debug Colliders</span>
      </label>
      <div class="hint">Toggle hotkey: <b>\`</b></div>

      <div class="section">
        <div class="hint" style="margin-top:0;">Gameplay</div>
        <ul>
          <li><b>W/A/S/D</b> (or <b>↑/←/↓/→</b>): move</li>
          <li><b>Space</b>: jump</li>
          <li><b>W / ↑</b> while on a wall: climb</li>
        </ul>
      </div>

      <div class="section">
        <div class="hint" style="margin-top:0;">Camera</div>
        <ul>
          <li><b>Click</b> on the game: capture mouse (hide cursor)</li>
          <li><b>Mouse</b>: rotate (yaw) + tilt (pitch)</li>
          <li><b>Scroll</b>: zoom in/out</li>
          <li><b>Esc</b>: release mouse (show cursor)</li>
        </ul>
      </div>
    </div>
  `;
  document.body.appendChild(ui);

  state.debugUiCheckbox = ui.querySelector("#debug-toggle");
  state.debugUiCheckbox.checked = CONFIG.DEBUG_MODE;

  state.debugUiCheckbox.addEventListener("change", () => {
    setDebugMode(state, CONFIG, state.debugUiCheckbox.checked);
  });

  state.debugUiCheckbox.tabIndex = -1;
  state.debugUiCheckbox.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); e.stopPropagation(); }
  });
  state.debugUiCheckbox.addEventListener("click", () => state.debugUiCheckbox.blur());

  const collapseBtn = ui.querySelector("#ui-collapse");
  const setCollapsed = (collapsed) => {
    ui.classList.toggle("collapsed", collapsed);
    collapseBtn.textContent = collapsed ? "Show" : "Hide";
    collapseBtn.setAttribute("aria-label", collapsed ? "Show controls" : "Hide controls");
  };
  collapseBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCollapsed(!ui.classList.contains("collapsed"));
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Backquote") {
      setDebugMode(state, CONFIG, !CONFIG.DEBUG_MODE);
      CONFIG.DEBUG_MODE = !CONFIG.DEBUG_MODE;
    }
  });
}

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

function setDebugMode(state, CONFIG, on) {
  CONFIG.DEBUG_MODE = on;
  if (state.debugUiCheckbox) state.debugUiCheckbox.checked = on;

  if (state.playerDebugMesh) state.playerDebugMesh.visible = on;
  if (state.npcDebugMesh) state.npcDebugMesh.visible = on;

  for (const obj of state.gameObjects) {
    if (obj.mesh) obj.mesh.visible = on;
    if (obj.axes) obj.axes.visible = on;
  }
  for (const entry of state.debugAxes) entry.group.visible = on;

  for (const t of state.staticTrimeshDebug) {
    if (t.mesh) t.mesh.visible = on;
    if (t.axes) t.axes.visible = on;
  }
}

function createAxes(state, CONFIG, length = 8) {
  const g = new THREE.Group();
  const x = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), length, 0xff4444);
  const y = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), length, 0x44ff44);
  const z = new THREE.ArrowHelper(new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,0), length, 0x4444ff);
  g.add(x, y, z);
  g.visible = CONFIG.DEBUG_MODE;
  state.scene && state.scene.add(g);
  return g;
}

// ------------------------------------------------------------
// Environment
// ------------------------------------------------------------
function createSkySphere(state) {
  const geo = new THREE.SphereGeometry(10000, 60, 40);
  state.textureLoader.load("/static/textures/blue_sky.jpg", (texture) => {
    const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
    state.scene.add(new THREE.Mesh(geo, mat));
  });
}

function createPlane(state, CONFIG) {
  state.textureLoader.load("/static/textures/grass.jpg", (texture) => {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.PLANE_SIZE, CONFIG.PLANE_SIZE),
      new THREE.MeshStandardMaterial({ map: texture })
    );
    plane.rotation.x = -Math.PI / 2;
    state.scene.add(plane);
  });
}

function createLighting(state) {
  state.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(10, 20, 10);
  state.scene.add(light);
}

function createStaticGroundCollider(state, CONFIG) {
  const shape = new Ammo.btStaticPlaneShape(new Ammo.btVector3(0, 1, 0), 0);
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(0, 0, 0));
  const motionState = new Ammo.btDefaultMotionState(transform);
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(0, motionState, shape, new Ammo.btVector3(0, 0, 0));
  const body = new Ammo.btRigidBody(rbInfo);
  state.physicsWorld.addRigidBody(body);

  // debug mesh (wireframe)
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.PLANE_SIZE, 2, CONFIG.PLANE_SIZE),
    new THREE.MeshBasicMaterial({ wireframe: true })
  );
  mesh.position.set(0, 1, 0);
  mesh.visible = CONFIG.DEBUG_MODE;
  state.scene.add(mesh);

  const axes = createAxes(state, CONFIG, 20);
  state.debugAxes.push({ group: axes, ownerName: "ground" });

  state.gameObjects.push({ name: "ground", body, mesh, axes });
}

// Simple obstacle spawner functions
function createBoxDynamic(state, CONFIG, position, size, mass = 0.001, modelOptions = null, name = "BoxDynamic") {
  const shape = new Ammo.btBoxShape(new Ammo.btVector3(size.x / 2, size.y / 2, size.z / 2));
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(position.x, position.y + size.y / 2, position.z));
  const motionState = new Ammo.btDefaultMotionState(transform);
  const localInertia = new Ammo.btVector3(0, 0, 0);
  shape.calculateLocalInertia(mass, localInertia);
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
  const body = new Ammo.btRigidBody(rbInfo);

  body.setRestitution(0.1);
  body.setFriction(1.0);
  body.setRollingFriction(0.3);
  body.setActivationState(Ammo.DISABLE_DEACTIVATION);

  state.physicsWorld.addRigidBody(body);
  body.activate();

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true })
  );
  mesh.position.copy(position);
  mesh.visible = CONFIG.DEBUG_MODE;
  state.scene.add(mesh);

  const axes = createAxes(state, CONFIG, 10);
  state.debugAxes.push({ group: axes, ownerName: name });

  // optional OBJ/MTL “visual”
  if (modelOptions?.objPath && modelOptions?.mtlPath) {
    const offset = modelOptions.offset || new THREE.Vector3(0, 0, 0);
    const scale = modelOptions.scale || new THREE.Vector3(1, 1, 1);
    const rotationEuler = modelOptions.rotation || new THREE.Euler(0, 0, 0);
    const rotationOffsetQuat = new THREE.Quaternion().setFromEuler(rotationEuler);

    state.sharedMtlLoader.load(modelOptions.mtlPath, (materials) => {
      materials.preload();
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.load(modelOptions.objPath, (object) => {
        object.position.copy(position.clone().add(offset));
        object.scale.copy(scale);
        state.scene.add(object);

        state.gameObjects.push({
          name, body, mesh,
          visual: object,
          visualOffset: offset,
          visualRotationOffset: rotationOffsetQuat,
          axes
        });
      });
    });
  } else {
    state.gameObjects.push({ name, body, mesh, axes });
  }
}

// ------------------------------------------------------------
// Capsule obstacle (used for surrounding rock wall)
// ------------------------------------------------------------
function createCapsuleObstacle(state, CONFIG, position, radius, height, mass = 0, modelOptions = null, name = "Capsule") {
  const shape = new Ammo.btCapsuleShape(radius, height - 2 * radius);

  const transform = new Ammo.btTransform();
  transform.setIdentity();
  // Capsule origin is center; your original rocks use y=-30 and should be centered there
  transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));

  const motionState = new Ammo.btDefaultMotionState(transform);

  const localInertia = new Ammo.btVector3(0, 0, 0);
  if (mass > 0) shape.calculateLocalInertia(mass, localInertia);

  const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
  const body = new Ammo.btRigidBody(rbInfo);

  body.setFriction(1.0);
  body.setRestitution(0.1);
  body.setActivationState(Ammo.DISABLE_DEACTIVATION);

  state.physicsWorld.addRigidBody(body);
  body.activate();

  // debug collider mesh
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, height - 2 * radius, 8, 16),
    new THREE.MeshBasicMaterial({ wireframe: true })
  );
  mesh.position.copy(position);
  mesh.visible = CONFIG.DEBUG_MODE;
  state.scene.add(mesh);

  const axes = createAxes(state, CONFIG, 10);
  axes.position.copy(position);
  axes.visible = CONFIG.DEBUG_MODE;

  // optional visual from OBJ/MTL
  if (modelOptions?.objPath && modelOptions?.mtlPath) {
    const offset = modelOptions.offset || new THREE.Vector3(0, 0, 0);
    const scale = modelOptions.scale || new THREE.Vector3(1, 1, 1);
    const rotationEuler = modelOptions.rotation || new THREE.Euler(0, 0, 0);
    const rotationOffsetQuat = new THREE.Quaternion().setFromEuler(rotationEuler);

    state.sharedMtlLoader.load(modelOptions.mtlPath, (materials) => {
      materials.preload();
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);

      objLoader.load(modelOptions.objPath, (object) => {
        object.position.copy(position.clone().add(offset));
        object.scale.copy(scale);
        object.rotation.copy(rotationEuler);
        state.scene.add(object);

        state.gameObjects.push({
          name, body, mesh,
          visual: object,
          visualOffset: offset,
          visualRotationOffset: rotationOffsetQuat,
          axes
        });
      });
    });
  } else {
    state.gameObjects.push({ name, body, mesh, axes });
  }

  return body;
}

// ------------------------------------------------------------
// Static trimesh collider from OBJ/MTL (concave-safe static)
// ------------------------------------------------------------
function createStaticTrimeshObstacleFromObjMtl(state, CONFIG, position, modelOptions, name = "StaticTrimesh") {
  const objPath = modelOptions?.objPath;
  const mtlPath = modelOptions?.mtlPath;
  if (!objPath || !mtlPath) {
    console.warn(`[${name}] Missing objPath/mtlPath`);
    return;
  }

  const scale = modelOptions.scale || new THREE.Vector3(1, 1, 1);
  const rotation = modelOptions.rotation || new THREE.Euler(0, 0, 0);
  const offset = modelOptions.offset || new THREE.Vector3(0, 0, 0);

  // Visual position matches your original: position + offset :contentReference[oaicite:3]{index=3}
  const visualPos = position.clone().add(offset);

  state.sharedMtlLoader.load(mtlPath, (materials) => {
    materials.preload();
    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);

    objLoader.load(objPath, (object) => {
      object.name = `${name}_visual`;
      object.position.copy(visualPos);
      object.scale.copy(scale);
      object.rotation.copy(rotation);
      object.updateMatrixWorld(true);
      state.scene.add(object);

      // Build Ammo triangle mesh from the loaded THREE object (world-space triangles)
      const triMesh = new Ammo.btTriangleMesh(true, true);

      const addGeomToTriMesh = (geom) => {
        const pos = geom.attributes.position;
        if (!pos) return;

        const idx = geom.index ? geom.index.array : null;

        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        const c = new THREE.Vector3();

        const readVertex = (i, out) => out.set(pos.getX(i), pos.getY(i), pos.getZ(i));

        if (idx) {
          for (let i = 0; i < idx.length; i += 3) {
            readVertex(idx[i], a);
            readVertex(idx[i + 1], b);
            readVertex(idx[i + 2], c);

            const va = new Ammo.btVector3(a.x, a.y, a.z);
            const vb = new Ammo.btVector3(b.x, b.y, b.z);
            const vc = new Ammo.btVector3(c.x, c.y, c.z);
            triMesh.addTriangle(va, vb, vc, true);
            Ammo.destroy(va); Ammo.destroy(vb); Ammo.destroy(vc);
          }
        } else {
          for (let i = 0; i < pos.count; i += 3) {
            a.set(pos.getX(i), pos.getY(i), pos.getZ(i));
            b.set(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
            c.set(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));

            const va = new Ammo.btVector3(a.x, a.y, a.z);
            const vb = new Ammo.btVector3(b.x, b.y, b.z);
            const vc = new Ammo.btVector3(c.x, c.y, c.z);
            triMesh.addTriangle(va, vb, vc, true);
            Ammo.destroy(va); Ammo.destroy(vb); Ammo.destroy(vc);
          }
        }
      };

      object.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;

        // Clone geometry and bake child's WORLD transform into vertices
        const geom = child.geometry.clone();
        geom.applyMatrix4(child.matrixWorld);
        addGeomToTriMesh(geom);
      });

      const useQuantizedAabbCompression = true;
      const buildBvh = true;
      const shape = new Ammo.btBvhTriangleMeshShape(triMesh, useQuantizedAabbCompression, buildBvh);
      shape.setMargin(0.02);

      // Static body at identity (triangles already in world space)
      const transform = new Ammo.btTransform();
      transform.setIdentity();
      transform.setOrigin(new Ammo.btVector3(0, 0, 0));
      transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));

      const motionState = new Ammo.btDefaultMotionState(transform);
      const rbInfo = new Ammo.btRigidBodyConstructionInfo(0, motionState, shape, new Ammo.btVector3(0, 0, 0));
      const body = new Ammo.btRigidBody(rbInfo);
      state.physicsWorld.addRigidBody(body);

      // Debug wireframe group (debug-only)
      const wfGroup = new THREE.Group();
      object.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;
        const wf = new THREE.WireframeGeometry(child.geometry);
        const wfMat = new THREE.LineBasicMaterial({ color: 0xffffff });
        const wfLines = new THREE.LineSegments(wf, wfMat);
        wfLines.applyMatrix4(child.matrixWorld);
        wfGroup.add(wfLines);
      });
      wfGroup.visible = CONFIG.DEBUG_MODE;
      state.scene.add(wfGroup);

      const axes = createAxes(state, CONFIG, 10);
      axes.position.copy(position);
      axes.visible = CONFIG.DEBUG_MODE;

      state.staticTrimeshDebug.push({ mesh: wfGroup, axes });

      console.log(`[${name}] trimesh collider created`);
    });
  });
}


function spawnEnvironment(state, CONFIG) {
  // Crates (what you already had)
  const crateOpts = {
    objPath: "/static/models/crate/tinker.obj",
    mtlPath: "/static/models/crate/obj.mtl",
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
    offset: new THREE.Vector3(-6, -2.5, -8),
  };

  createBoxDynamic(state, CONFIG, new THREE.Vector3(-90, 0, 25), new THREE.Vector3(5, 5, 5), 1.011, crateOpts, "crate1");
  createBoxDynamic(state, CONFIG, new THREE.Vector3( 90, 0, 25), new THREE.Vector3(5, 5, 5), 1.011, crateOpts, "crate2");

  // -------------------------
  // Buildings (static trimesh)
  // -------------------------
  const skyScraperOpts = {
    objPath: "/static/models/skyScraper/tinker.obj",
    mtlPath: "/static/models/skyScraper/obj.mtl",
    scale: new THREE.Vector3(0.3, 0.3, 0.3),
    rotation: new THREE.Euler(Math.PI / 2, Math.PI, Math.PI),
    offset: new THREE.Vector3(-1, 0, 0),
  };

  const skyScraper2Opts = {
    objPath: "/static/models/skyScraper2/tinker.obj",
    mtlPath: "/static/models/skyScraper2/obj.mtl",
    scale: new THREE.Vector3(1.5, 1.5, 1.5),
    rotation: new THREE.Euler(Math.PI / 2, Math.PI, Math.PI),
    offset: new THREE.Vector3(-1, 0, 0),
  };

  createStaticTrimeshObstacleFromObjMtl(state, CONFIG, new THREE.Vector3(   0, 0, -100), skyScraper2Opts, "skyScraper1");
  createStaticTrimeshObstacleFromObjMtl(state, CONFIG, new THREE.Vector3(-120, 0, -100), skyScraperOpts,  "skyScraper2");
  createStaticTrimeshObstacleFromObjMtl(state, CONFIG, new THREE.Vector3( 120, 0, -100), skyScraperOpts,  "skyScraper3");

  // -------------------------
  // Rock wall border
  // -------------------------
  const rockOpts = {
    objPath: "/static/models/rock/tinker.obj",
    mtlPath: "/static/models/rock/obj.mtl",
    scale: new THREE.Vector3(0.9, 0.9, 0.9),
    rotation: new THREE.Euler(0, Math.PI / 2, Math.PI / 2),
    offset: new THREE.Vector3(-30, 28, -4),
  };

  const addRock = (pos, r = 30, h = 60, name) =>
    createCapsuleObstacle(state, CONFIG, pos, r, h, 0, rockOpts, name);

  let rockCounter = 1000;
  const rockSpacing = 50;

  const half = CONFIG.PLANE_SIZE / 2;

  for (let x = -half; x <= half; x += rockSpacing) {
    addRock(new THREE.Vector3(x, -30,  half), 30, 60, `rock${rockCounter++}`);
    addRock(new THREE.Vector3(x, -30, -half), 30, 60, `rock${rockCounter++}`);
  }
  for (let z = -half + rockSpacing; z < half; z += rockSpacing) {
    addRock(new THREE.Vector3( half, -30, z), 30, 60, `rock${rockCounter++}`);
    addRock(new THREE.Vector3(-half, -30, z), 30, 60, `rock${rockCounter++}`);
  }
}


// ------------------------------------------------------------
// Player (capsule body + FBX visual + animations)
// ------------------------------------------------------------
async function createPlayer(state, CONFIG, position) {
  const shape = new Ammo.btCapsuleShape(
    CONFIG.PLAYER_RADIUS,
    CONFIG.PLAYER_HEIGHT - 2 * CONFIG.PLAYER_RADIUS
  );
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(position.x, position.y + CONFIG.PLAYER_HEIGHT / 2, position.z));

  // Apply starting yaw (same behavior you already implemented) :contentReference[oaicite:5]{index=5}
  const yawRad = THREE.MathUtils.degToRad(CONFIG.PLAYER_STARTING_YAW_DEG);
  const startRot = new Ammo.btQuaternion(0, Math.sin(yawRad / 2), 0, Math.cos(yawRad / 2));
  transform.setRotation(startRot);

  const motionState = new Ammo.btDefaultMotionState(transform);
  const localInertia = new Ammo.btVector3(0, 0, 0);
  shape.calculateLocalInertia(CONFIG.PLAYER_MASS, localInertia);

  const rbInfo = new Ammo.btRigidBodyConstructionInfo(CONFIG.PLAYER_MASS, motionState, shape, localInertia);
  const body = new Ammo.btRigidBody(rbInfo);

  body.setRestitution(0);
  body.setFriction(CONFIG.PLAYER_DEFAULT_FRICTION);
  body.setDamping(0.2, 0.98);
  body.setAngularFactor(new Ammo.btVector3(0, 0, 0));
  body.setActivationState(Ammo.DISABLE_DEACTIVATION);

  state.physicsWorld.addRigidBody(body);
  state.Player = body;
  state.playerPtr = Ammo.getPointer(body);

  // debug capsule mesh
  state.playerDebugMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(CONFIG.PLAYER_RADIUS, CONFIG.PLAYER_HEIGHT - 2 * CONFIG.PLAYER_RADIUS, 8, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
  );
  state.playerDebugMesh.visible = CONFIG.DEBUG_MODE;
  state.scene.add(state.playerDebugMesh);

  const playerAxes = createAxes(state, CONFIG, 12);
  state.debugAxes.push({ group: playerAxes, ownerName: "player" });
  state.Player.__axes = playerAxes;

  // FBX visual + anims
  const fbxLoader = new FBXLoader();

  const idleObj = await loadFBX(fbxLoader, CONFIG.PLAYER_FBX_IDLE);
  idleObj.scale.copy(CONFIG.PLAYER_MODEL_SCALE);
  idleObj.rotation.copy(CONFIG.PLAYER_MODEL_ROTATION);
  idleObj.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = false;
      c.receiveShadow = false;
      if (c.material) c.material.transparent = false;
    }
  });

  state.scene.add(idleObj);
  state.playerVisual = idleObj;
  state.playerMixer = new THREE.AnimationMixer(state.playerVisual);

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

  state.moveAnimDir = 1;
  applyMoveAnimDirection(state, 1, true);

  if (state.playerActions.idle) playPlayerAction(state, CONFIG, "idle", true);
  else if (state.playerActions.move) playPlayerAction(state, CONFIG, "move", true);
  else if (state.playerActions.in_air) playPlayerAction(state, CONFIG, "in_air", true);
  else if (state.playerActions.climb) playPlayerAction(state, CONFIG, "climb", true);
}

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

function loadFBX(loader, path) {
  return new Promise((resolve, reject) => loader.load(path, resolve, undefined, reject));
}

async function loadFirstClipFromFBX(loader, path) {
  const obj = await loadFBX(loader, path);
  if (obj.animations && obj.animations.length > 0) return obj.animations[0];
  console.warn(`No animations found in: ${path}`);
  return null;
}

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

function getBodyPosition(body) {
  if (!body) return null;
  const transform = new Ammo.btTransform();
  body.getMotionState().getWorldTransform(transform);
  const origin = transform.getOrigin();
  const position = new THREE.Vector3(origin.x(), origin.y(), origin.z());
  Ammo.destroy(transform);
  return position;
}

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
    if (obj.crateDestroyStarted) continue;

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

function applyMoveAnimDirection(state, dir, force = false) {
  const action = state.playerActions.move;
  if (!action) return;

  const clampedDir = (dir < 0) ? -1 : 1;
  if (!force && clampedDir === state.moveAnimDir) return;

  const clip = action.getClip ? action.getClip() : null;
  const dur = clip ? clip.duration : 0;

  action.timeScale = clampedDir;

  if (dur > 0) {
    const eps = 1e-4;
    action.time = (clampedDir < 0) ? Math.max(dur - eps, 0) : eps;
  }

  state.moveAnimDir = clampedDir;
}

// ------------------------------------------------------------
// Input + movement
// ------------------------------------------------------------
function bindKeys(state) {
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") e.preventDefault();
    state.keys[e.code] = true;
  });
  window.addEventListener("keyup", (e) => {
    state.keys[e.code] = false;
  });
}

function handleInput(state, CONFIG, dt) {
  if (!state.Player) return;

  if (state.climbExitTimer > 0) state.climbExitTimer = Math.max(0, state.climbExitTimer - dt);
  if (state.climbAnimGrace > 0) state.climbAnimGrace = Math.max(0, state.climbAnimGrace - dt);

  const forwardKey = state.keys["ArrowUp"]   || state.keys["KeyW"];
  const backKey    = state.keys["ArrowDown"] || state.keys["KeyS"];
  const leftKey    = state.keys["ArrowLeft"] || state.keys["KeyA"];
  const rightKey   = state.keys["ArrowRight"]|| state.keys["KeyD"];

  if (leftKey)  turn(state, CONFIG,  CONFIG.TURN_SPEED, dt);
  if (rightKey) turn(state, CONFIG, -CONFIG.TURN_SPEED, dt);

  let moveAxis = 0;
  if (forwardKey) moveAxis += 1;
  if (backKey) moveAxis -= 1;
  state.lastMoveAxis = moveAxis;

  const grounded = isGrounded(state, CONFIG);

  // Climb gating (keep expanding with your probe-based animation latch if desired)
  const wallOkPhysics = state.playerOnWall && (state.playerWallNormal.length() >= CONFIG.WALL_CLIMB_MIN_NORMAL);
  const canAttemptClimb = (!grounded && moveAxis > 0 && state.climbExitTimer <= 0);

  if (state.playerClimbing) {
    if (grounded || moveAxis <= 0) {
      state.playerClimbing = false;
      state.climbAnimGrace = 0;
    } else if (canAttemptClimb && wallOkPhysics) {
      state.playerClimbing = true;
      state.climbAnimGrace = CONFIG.CLIMB_ANIM_GRACE_SECONDS;
    } else {
      if (state.climbAnimGrace <= 0) state.playerClimbing = false;
    }
  } else {
    if (canAttemptClimb && wallOkPhysics) {
      state.playerClimbing = true;
      state.climbAnimGrace = CONFIG.CLIMB_ANIM_GRACE_SECONDS;
    }
  }

  if (!state.playerClimbing) applyCharacterMovement(state, CONFIG, moveAxis, dt);
  else applyWallClimb(state, CONFIG);

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

function isGrounded(state, CONFIG) {
  return state.playerGrounded || isGroundedRay(state, CONFIG, 2);
}

function isGroundedRay(state, CONFIG, threshold = 2) {
  const transform = new Ammo.btTransform();
  state.Player.getMotionState().getWorldTransform(transform);
  const origin = transform.getOrigin();

  const rayStart = new THREE.Vector3(
    origin.x(),
    origin.y() - CONFIG.PLAYER_HEIGHT / 2 + CONFIG.PLAYER_RADIUS - 0.1,
    origin.z()
  );
  const rayEnd = rayStart.clone().add(new THREE.Vector3(0, -threshold, 0));

  const btStart = new Ammo.btVector3(rayStart.x, rayStart.y, rayStart.z);
  const btEnd   = new Ammo.btVector3(rayEnd.x,   rayEnd.y,   rayEnd.z);
  const cb = new Ammo.ClosestRayResultCallback(btStart, btEnd);
  state.physicsWorld.rayTest(btStart, btEnd, cb);

  const hit = cb.hasHit();
  Ammo.destroy(btStart); Ammo.destroy(btEnd); Ammo.destroy(cb);
  Ammo.destroy(transform);
  return hit;
}

function jump(state, CONFIG) {
  const lv = state.Player.getLinearVelocity();
  state.Player.setLinearVelocity(new Ammo.btVector3(lv.x(), CONFIG.PLAYER_JUMP_IMPULSE, lv.z()));
  state.Player.activate();
}

function applyWallClimb(state, CONFIG) {
  const stick = state.playerWallNormal.clone().multiplyScalar(-CONFIG.WALL_CLIMB_STICK_SPEED);
  state.Player.setFriction(CONFIG.WALL_SLIDE_FRICTION);
  state.Player.setLinearVelocity(new Ammo.btVector3(stick.x, CONFIG.WALL_CLIMB_SPEED, stick.z));
  state.Player.activate();
}

function wallJumpOff(state, CONFIG) {
  const away = state.playerWallNormal.clone().multiplyScalar(8.0);
  state.Player.setLinearVelocity(new Ammo.btVector3(away.x, CONFIG.PLAYER_JUMP_IMPULSE, away.z));
  state.Player.activate();

  state.playerClimbing = false;
  state.climbAnimGrace = 0;
  state.climbExitTimer = CONFIG.WALL_CLIMB_EXIT_COOLDOWN;
}

function getPlayerBasis(state) {
  const t = state.Player.getWorldTransform();
  const q = t.getRotation();
  const quat = new THREE.Quaternion(q.x(), q.y(), q.z(), q.w());
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat).normalize();
  const right   = new THREE.Vector3(1, 0, 0).applyQuaternion(quat).normalize();
  return { forward, right };
}

function applyCharacterMovement(state, CONFIG, moveAxis, dt) {
  if (!CONFIG.PLAYER_MOVE_MIDAIR && !isGrounded(state, CONFIG)) moveAxis = 0;

  const lv = state.Player.getLinearVelocity();
  const current = new THREE.Vector3(lv.x(), 0, lv.z());

  const { forward, right } = getPlayerBasis(state);
  const desired = forward.clone().multiplyScalar(CONFIG.PLAYER_MAX_SPEED * moveAxis);

  const grounded = isGrounded(state, CONFIG);
  const wallSliding = (!grounded && state.playerOnWall && moveAxis !== 0);

  // wall slide constraints
  if (wallSliding && state.playerWallNormal.lengthSq() > 1e-6) {
    const into = desired.dot(state.playerWallNormal);
    if (into > 0) desired.addScaledVector(state.playerWallNormal, -into);
  }

  const accel = grounded ? CONFIG.PLAYER_ACCEL : CONFIG.PLAYER_AIR_ACCEL * CONFIG.PLAYER_MID_AIR_DAMPEN;
  const brake = grounded ? CONFIG.PLAYER_BRAKE : CONFIG.PLAYER_AIR_BRAKE;

  const target = (moveAxis !== 0) ? desired : new THREE.Vector3(0, 0, 0);
  const rate = (moveAxis !== 0) ? accel : brake;

  const maxDelta = rate * dt;
  const delta = target.clone().sub(current);
  const deltaLen = delta.length();
  if (deltaLen > maxDelta && deltaLen > 1e-6) delta.multiplyScalar(maxDelta / deltaLen);

  const newVel = current.clone().add(delta);

  // strafe damp
  if (CONFIG.PLAYER_USE_STRAFE_DAMP) {
    const sideDamp = grounded ? CONFIG.PLAYER_SIDE_DAMP_GROUND : CONFIG.PLAYER_SIDE_DAMP_AIR;
    const f = forward.clone().setY(0).normalize();
    const r = right.clone().setY(0).normalize();

    const fSpd = newVel.dot(f);
    const rSpd = newVel.dot(r);
    const rKeep = Math.exp(-sideDamp * dt);
    const rSpdDamped = rSpd * rKeep;

    newVel.copy(f.multiplyScalar(fSpd).add(r.multiplyScalar(rSpdDamped)));
  }

  const spd = newVel.length();
  if (spd > CONFIG.PLAYER_MAX_SPEED) newVel.multiplyScalar(CONFIG.PLAYER_MAX_SPEED / spd);

  let vy = lv.y();
  if (wallSliding && state.playerWallNormal.lengthSq() > 1e-6) {
    if (vy < CONFIG.WALL_SLIDE_MAX_FALL_SPEED) vy = CONFIG.WALL_SLIDE_MAX_FALL_SPEED;
    const into2 = newVel.dot(state.playerWallNormal);
    if (into2 > 0) newVel.addScaledVector(state.playerWallNormal, -into2);
    state.Player.setFriction(CONFIG.WALL_SLIDE_FRICTION);
  } else {
    state.Player.setFriction(CONFIG.PLAYER_DEFAULT_FRICTION);
  }

  state.Player.setLinearVelocity(new Ammo.btVector3(newVel.x, vy, newVel.z));
  state.Player.activate();
}

function turn(state, CONFIG, delta, dt) {
  const t = state.Player.getWorldTransform();
  const rot = t.getRotation();
  const dq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), delta * dt);
  const q = new THREE.Quaternion(rot.x(), rot.y(), rot.z(), rot.w()).multiply(dq);
  t.setRotation(new Ammo.btQuaternion(q.x, q.y, q.z, q.w));
  state.Player.setWorldTransform(t);
  state.Player.activate();
}

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

// ------------------------------------------------------------
// Contacts (grounded / wall)
// ------------------------------------------------------------
function updatePlayerContacts(state, CONFIG) {
  state.playerGrounded = false;
  state.playerOnWall = false;
  state.playerWallNormal.set(0, 0, 0);

  if (!state.Player || !state.dispatcher || !state.playerPtr) return;

  const t = state.Player.getWorldTransform();
  const o = t.getOrigin();
  const centerY = o.y();
  const bottomY = centerY - (CONFIG.PLAYER_HEIGHT / 2);
  const groundBandTopY = bottomY + (CONFIG.PLAYER_HEIGHT * CONFIG.GROUND_BAND_FRACTION);

  const numManifolds = state.dispatcher.getNumManifolds();

  for (let i = 0; i < numManifolds; i++) {
    const manifold = state.dispatcher.getManifoldByIndexInternal(i);
    const body0 = manifold.getBody0();
    const body1 = manifold.getBody1();

    const ptr0 = Ammo.getPointer(body0);
    const ptr1 = Ammo.getPointer(body1);

    const isPlayer0 = (ptr0 === state.playerPtr);
    const isPlayer1 = (ptr1 === state.playerPtr);
    if (!isPlayer0 && !isPlayer1) continue;

    const numContacts = manifold.getNumContacts();
    for (let j = 0; j < numContacts; j++) {
      const pt = manifold.getContactPoint(j);
      if (pt.getDistance() >= 0) continue;

      const nB = pt.get_m_normalWorldOnB();
      let nx = nB.x(), ny = nB.y(), nz = nB.z();
      if (isPlayer1) { nx = -nx; ny = -ny; nz = -nz; }

      const pA = pt.get_m_positionWorldOnA();
      const pB = pt.get_m_positionWorldOnB();
      const pPlayer = isPlayer0 ? pA : pB;
      const py = pPlayer.y();

      if (py <= (groundBandTopY + 0.05) && ny > CONFIG.GROUND_NORMAL_MIN_Y) {
        state.playerGrounded = true;
      }

      const horizLenSq = (nx * nx + nz * nz);
      if (horizLenSq > 1e-5 && Math.abs(ny) <= CONFIG.WALL_NORMAL_MAX_Y) {
        state.playerOnWall = true;
        const len = Math.sqrt(horizLenSq);
        state.playerWallNormal.x += (nx / len);
        state.playerWallNormal.z += (nz / len);
      }
    }
  }

  if (state.playerOnWall) {
    state.playerWallNormal.y = 0;
    const l = state.playerWallNormal.length();
    if (l > 1e-6) state.playerWallNormal.multiplyScalar(1 / l);
  }

  if (state.playerGrounded) {
    state.playerClimbing = false;
    state.climbAnimGrace = 0;
  }
}

// ------------------------------------------------------------
// Animation state switching (simplified; add your multi-ray gating if desired)
// ------------------------------------------------------------
function updatePlayerAnimationState(state, CONFIG, dt) {
  if (!state.Player || !state.playerMixer) return;

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

  // if climbing, don't switch to in_air
  if (state.playerClimbing || state.climbAnimGrace > 0) {
    state.animInAir = false;
    state.animAirTimer = 0;
    if (state.playerCurrentState !== "climb") playPlayerAction(state, CONFIG, "climb", false);
    return;
  }

  // basic: physics grounded drives anim gate
  if (isGrounded(state, CONFIG)) {
    state.animInAir = false;
    state.animAirTimer = 0;
  } else {
    state.animAirTimer += dt;
    if (!state.animInAir && state.animAirTimer >= CONFIG.ANIM_AIR_MIN_TIME) state.animInAir = true;
  }

  const lv = state.Player.getLinearVelocity();
  const horizSpeed = Math.sqrt(lv.x() * lv.x() + lv.z() * lv.z());

  let desired = "idle";
  if (state.animInAir) desired = "in_air";
  else if (horizSpeed > CONFIG.MOVE_SPEED_THRESHOLD) desired = "move";

  if (desired !== state.playerCurrentState) playPlayerAction(state, CONFIG, desired, false);

  if (desired === "move") {
    const dir = (state.lastMoveAxis < 0) ? -1 : 1;
    applyMoveAnimDirection(state, dir, false);
  } else {
    if (state.moveAnimDir !== 1) applyMoveAnimDirection(state, 1, false);
  }
}

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

// ------------------------------------------------------------
// Sync visuals from physics (same model as your current file)
// ------------------------------------------------------------
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
}

// ------------------------------------------------------------
// Camera follow
// ------------------------------------------------------------
function getDynamicMinPitch(state, CONFIG) {
  return (state.playerHeightAboveGround > CONFIG.CAMERA_BELOW_PLAYER_ENABLE_HEIGHT)
    ? CONFIG.CAMERA_MIN_PITCH_BELOW
    : CONFIG.CAMERA_MIN_PITCH;
}

function updateCamera(state, CONFIG) {
  if (!state.Player) return;

  const ms = state.Player.getMotionState();
  if (!ms) return;

  ms.getWorldTransform(state.tmpTransform);
  const o = state.tmpTransform.getOrigin();

  const targetPos = new THREE.Vector3(o.x(), o.y(), o.z());
  state.playerHeightAboveGround = targetPos.y - CONFIG.GROUND_PLANE_Y;

  // Initialize yaw/distance once
  if (!state.cameraYawInitialized) {
    const toCam = new THREE.Vector3().subVectors(state.camera.position, targetPos);
    state.cameraDistance = THREE.MathUtils.clamp(toCam.length(), CONFIG.CAMERA_MIN_DISTANCE, CONFIG.CAMERA_MAX_DISTANCE);
    state.cameraYaw = Math.atan2(toCam.x, toCam.z);

    const horizLen = Math.sqrt(toCam.x * toCam.x + toCam.z * toCam.z) || 1e-6;
    state.cameraPitch = Math.atan2(toCam.y, horizLen);
    state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch, getDynamicMinPitch(state, CONFIG), CONFIG.CAMERA_MAX_PITCH);

    state.cameraYawInitialized = true;
  }

  state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch, getDynamicMinPitch(state, CONFIG), CONFIG.CAMERA_MAX_PITCH);

  const horiz = state.cameraDistance * Math.cos(state.cameraPitch);
  const yOff  = state.cameraDistance * Math.sin(state.cameraPitch);
  const xOff  = horiz * Math.sin(state.cameraYaw);
  const zOff  = horiz * Math.cos(state.cameraYaw);

  const desiredPos = new THREE.Vector3(
    targetPos.x + xOff,
    targetPos.y + yOff + (CONFIG.CAMERA_VERTICAL_OFFSET * 0.15),
    targetPos.z + zOff
  );

  state.camera.position.lerp(desiredPos, 0.15);

  const lookAtPos = targetPos.clone().add(new THREE.Vector3(0, CONFIG.CAMERA_VERTICAL_OFFSET * 0.35, 0));
  state.camera.lookAt(lookAtPos);
}
