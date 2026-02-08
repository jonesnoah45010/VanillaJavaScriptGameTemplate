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
    playerActions: { idle: null, move: null, in_air: null, climb: null },
    playerCurrentAction: null,
    playerCurrentState: "idle",

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
  };
}

export async function startCore(state, CONFIG) {
  // Executres once at the start of the game
  await Ammo();
  state.tmpTransform = new Ammo.btTransform();

  initThree(state, CONFIG);
  createDebugUI(state, CONFIG);
  initPhysics(state, CONFIG);

  createSkySphere(state);
  createPlane(state, CONFIG);
  createLighting(state);

  createStaticGroundCollider(state, CONFIG);
  spawnEnvironment(state, CONFIG);

  await createPlayer(state, CONFIG, CONFIG.PLAYER_STARTING_POSITION);

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

  // sync visuals
  syncVisualsFromPhysics(state, CONFIG);

  // animations
  updatePlayerAnimationState(state, CONFIG, dt);
  if (state.playerMixer) state.playerMixer.update(dt);

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

function setDebugMode(state, CONFIG, on) {
  CONFIG.DEBUG_MODE = on;
  if (state.debugUiCheckbox) state.debugUiCheckbox.checked = on;

  if (state.playerDebugMesh) state.playerDebugMesh.visible = on;

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

  const [moveClip, inAirClip, climbClip] = await Promise.all([
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_MOVE),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_IN_AIR),
    loadFirstClipFromFBX(fbxLoader, CONFIG.PLAYER_FBX_CLIMB),
  ]);

  if (idleClip)   state.playerActions.idle   = state.playerMixer.clipAction(idleClip);
  if (moveClip)   state.playerActions.move   = state.playerMixer.clipAction(moveClip);
  if (inAirClip)  state.playerActions.in_air = state.playerMixer.clipAction(inAirClip);
  if (climbClip)  state.playerActions.climb  = state.playerMixer.clipAction(climbClip);

  for (const k of ["idle","move","in_air","climb"]) {
    const a = state.playerActions[k];
    if (!a) continue;
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = false;
    a.enabled = true;
    a.timeScale = 1;
  }

  state.moveAnimDir = 1;
  applyMoveAnimDirection(state, 1, true);

  if (state.playerActions.idle) playPlayerAction(state, CONFIG, "idle", true);
  else if (state.playerActions.move) playPlayerAction(state, CONFIG, "move", true);
  else if (state.playerActions.in_air) playPlayerAction(state, CONFIG, "in_air", true);
  else if (state.playerActions.climb) playPlayerAction(state, CONFIG, "climb", true);
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
