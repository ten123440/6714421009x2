import * as THREE from 'three';
import { GameState, ControlSettings, DEFAULT_CONTROLS, GameStats } from '../types';

// Custom shader for 2D sprites allowing independent sprite-sheet frames and flashing colors (red/white)
const spriteVertexShader = `
  varying vec2 vUv;
  uniform vec2 uOffset;
  uniform vec2 uRepeat;
  void main() {
    vUv = uv * uRepeat + uOffset;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const spriteFragmentShader = `
  uniform sampler2D uMap;
  uniform vec3 uFlashColor;
  uniform float uFlashIntensity;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 texColor = texture2D(uMap, vUv);
    if (texColor.a < 0.15) discard;
    vec3 finalColor = mix(texColor.rgb, uFlashColor, uFlashIntensity);
    gl_FragColor = vec4(finalColor, texColor.a * uOpacity);
  }
`;

interface Entity {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  width: number;
  height: number;
  colCount: number;
  rowCount: number;
  col: number;
  row: number;
  flipX: boolean;
  animTimer: number;
  animSpeed: number;
}

interface Enemy extends Entity {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  hp: number; // starts at 2. 1st hit -> knockback, 2nd hit -> die
  state: 'walk' | 'attack' | 'dead';
  flashTimer: number;
  flashColor: THREE.Color;
  flashIntensity: number;
  knockbackX: number;
  knockbackZ: number;
  knockbackTimer: number;
  attackCooldown: number;
  deathAnimTimer: number;
}

interface Potion {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  x: number;
  z: number;
  bobTimer: number;
}

interface Boss extends Entity {
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  state: 'idle' | 'dashing' | 'charging' | 'shooting' | 'dead';
  stateTimer: number;
  targetX: number;
  targetZ: number;
  flashTimer: number;
  flashIntensity: number;
  scalePhase: number; // for squash & stretch warning
  attackCooldown: number;
}

interface Fireball {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  height: number;
  progress: number; // 0 to 1
  speed: number;
  indicatorMesh: THREE.Mesh;
}

interface Particle {
  mesh: THREE.Points | THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

export class GameEngine {
  private container: HTMLDivElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock!: THREE.Clock;
  private animationFrameId: number | null = null;

  // Game Settings
  private controls: ControlSettings = DEFAULT_CONTROLS;
  private onStatsChange: (stats: GameStats) => void;
  private onStateChange: (state: GameState) => void;

  // Assets
  private textureLoader = new THREE.TextureLoader();
  private textures: { [key: string]: THREE.Texture } = {};

  // Game Entities
  private playerMesh!: THREE.Mesh;
  private playerMaterial!: THREE.ShaderMaterial;
  private playerX = 0;
  private playerZ = 0;
  private playerHP = 5;
  private playerScore = 0;
  private playerKills = 0;
  private playerVx = 0;
  private playerVz = 0;
  private playerState: 'idle' | 'walk' | 'attack' | 'dance' = 'idle';
  private playerCol = 0;
  private playerRow = 0; // 0: idle, 1: walk, 2: attack, 3: dance
  private playerFlipX = false;
  private playerAnimTimer = 0;
  private playerAnimSpeed = 0.15;
  private playerAttackTimer = 0;
  private playerDanceTimer = 0;
  private playerHitDelay = 0; // invulnerability frames

  // Skill
  private skillCooldown = 0;
  private skillMaxCooldown = 8; // 8 seconds
  private ringMesh!: THREE.Mesh;
  private ringVisible = false;
  private ringScale = 0;

  // Collections
  private enemies: Enemy[] = [];
  private potions: Potion[] = [];
  private fireballs: Fireball[] = [];
  private particles: Particle[] = [];
  private boss: Boss | null = null;
  private warpPortal: THREE.Mesh | null = null;

  // Spawning & Timers
  private enemySpawnTimer = 0;
  private bossSpawned = false;
  private endingTriggered = false;

  // Input states
  private activeKeys: { [key: string]: boolean } = {};

  // Camera settings
  private cameraOffset = new THREE.Vector3(0, 12, 14);
  private screenShake = 0;

  // For ending sequence NPC
  private npcMesh: THREE.Mesh | null = null;
  private npcMaterial: THREE.ShaderMaterial | null = null;
  private npcX = 10;
  private npcZ = 10;
  private npcAnimTimer = 0;
  private npcCol = 0;
  private npcRow = 0;

  constructor(
    container: HTMLDivElement,
    onStatsChange: (stats: GameStats) => void,
    onStateChange: (state: GameState) => void
  ) {
    this.container = container;
    this.onStatsChange = onStatsChange;
    this.onStateChange = onStateChange;

    this.initThree();
    this.loadAssets();
  }

  private initThree() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0f1d);
    this.scene.fog = new THREE.FogExp2(0x0c0f1d, 0.015);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 12, 14);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    // Clear old elements
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 25, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 40;
    const d = 25;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x00ffff, 1, 20);
    pointLight.position.set(0, 2, 0);
    this.scene.add(pointLight);

    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private loadAssets() {
    const assetsList = {
      player: 'https://raw.githubusercontent.com/banyapon/banyapon.github.io/refs/heads/main/studio/images/player.png',
      ground: 'https://res.cloudinary.com/dsucg33fv/image/upload/v1782439980/ground_d1kjrx.png',
      potion: 'https://raw.githubusercontent.com/banyapon/banyapon.github.io/refs/heads/main/studio/images/potion.png',
      enemy: 'https://raw.githubusercontent.com/banyapon/banyapon.github.io/refs/heads/main/studio/images/enemy.png',
      boss: 'https://res.cloudinary.com/dsucg33fv/image/upload/v1782709455/boss_e8jti1.png',
      npc: 'https://res.cloudinary.com/dsucg33fv/image/upload/v1782439980/npc1_pdraha.png'
    };

    let loadedCount = 0;
    const totalAssets = Object.keys(assetsList).length;

    Object.entries(assetsList).forEach(([key, url]) => {
      this.textureLoader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.NearestFilter;
          texture.magFilter = THREE.NearestFilter;
          this.textures[key] = texture;
          loadedCount++;
          if (loadedCount === totalAssets) {
            this.buildWorld();
          }
        },
        undefined,
        (err) => {
          console.error(`Failed to load texture ${key}:`, err);
          // Create canvas fallbacks if textures fail to download in restricted envs
          this.textures[key] = this.createFallbackTexture(key);
          loadedCount++;
          if (loadedCount === totalAssets) {
            this.buildWorld();
          }
        }
      );
    });
  }

  private createFallbackTexture(name: string): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = name === 'ground' ? '#1c3d1c' : name === 'player' ? '#00ffff' : name === 'enemy' ? '#ff0033' : name === 'boss' ? '#aa00ff' : '#ffcc00';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.fillText(name.toUpperCase(), 30, 130);
    const text = new THREE.CanvasTexture(canvas);
    text.minFilter = THREE.NearestFilter;
    text.magFilter = THREE.NearestFilter;
    return text;
  }

  private buildWorld() {
    // 1. Ground Plane size 50 with ground.png tiling small
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundTex = this.textures['ground'].clone();
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(16, 16); // Small tiling

    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid helper or boundary lights to enrich atmosphere
    const grid = new THREE.GridHelper(60, 30, 0x00ffff, 0x224455);
    grid.position.y = 0.01;
    this.scene.add(grid);

    // 2. Build Player Plane
    const playerGeo = new THREE.PlaneGeometry(3, 3);
    const playerTex = this.textures['player'].clone();

    this.playerMaterial = new THREE.ShaderMaterial({
      vertexShader: spriteVertexShader,
      fragmentShader: spriteFragmentShader,
      uniforms: {
        uMap: { value: playerTex },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uRepeat: { value: new THREE.Vector2(0.25, 0.25) },
        uFlashColor: { value: new THREE.Color(1, 1, 1) },
        uFlashIntensity: { value: 0.0 },
        uOpacity: { value: 1.0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });

    this.playerMesh = new THREE.Mesh(playerGeo, this.playerMaterial);
    this.playerMesh.position.set(0, 1.5, 0);
    this.playerMesh.castShadow = true;
    this.scene.add(this.playerMesh);

    // Skill Ring Mesh (Ring around player)
    const ringGeo = new THREE.RingGeometry(0.1, 4, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.ringMesh.position.set(0, 0.1, 0);
    this.scene.add(this.ringMesh);

    // Spawn 8 initial items randomly
    for (let i = 0; i < 8; i++) {
      this.spawnPotion();
    }

    // Start Core Loop
    this.clock.getDelta(); // reset timer
    this.animate();

    // Notify React of stats
    this.updateStats();
  }

  // API to update settings from React options
  public setControlSettings(settings: ControlSettings) {
    this.controls = settings;
  }

  // API to trigger player actions from virtual/touch joystick/buttons
  public triggerPlayerAttack() {
    if (this.playerState === 'attack' || this.playerHP <= 0 || this.endingTriggered) return;
    this.playerState = 'attack';
    this.playerAttackTimer = 0;
    this.playerCol = 0;
    this.playerRow = 2; // Row 3: Attack (0-indexed row 2)
    this.playerAnimSpeed = 0.07; // Much faster speed for punch
    this.screenShake = 0.15;

    // Play attack spark particles
    const angle = this.playerFlipX ? Math.PI : 0;
    this.createHitParticles(
      this.playerX + (this.playerFlipX ? -1.5 : 1.5),
      1.5,
      this.playerZ,
      0x00ffff
    );

    // Hit box calculations
    const attackRange = 2.8;
    const hitAngle = this.playerFlipX ? -1 : 1;
    const hitBoxCenter = {
      x: this.playerX + hitAngle * 1.5,
      z: this.playerZ,
      r: attackRange,
    };

    // Check enemies hit
    this.enemies.forEach((enemy) => {
      if (enemy.state === 'dead') return;
      const dx = enemy.x - hitBoxCenter.x;
      const dz = enemy.z - hitBoxCenter.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < hitBoxCenter.r) {
        this.hitEnemy(enemy, hitAngle * 4, 0);
      }
    });

    // Check boss hit
    if (this.boss && this.boss.state !== 'dead') {
      const dx = this.boss.x - hitBoxCenter.x;
      const dz = this.boss.z - hitBoxCenter.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < hitBoxCenter.r + 1.5) {
        this.hitBoss(3);
      }
    }
  }

  public triggerPlayerSkill() {
    if (this.skillCooldown > 0 || this.playerHP <= 0 || this.endingTriggered) return;

    this.skillCooldown = this.skillMaxCooldown;
    this.ringVisible = true;
    this.ringScale = 0.1;
    this.ringMesh.scale.set(1, 1, 1);
    this.ringMesh.position.set(this.playerX, 0.1, this.playerZ);
    if (Array.isArray(this.ringMesh.material)) {
      this.ringMesh.material.forEach((m) => {
        m.opacity = 0.8;
      });
    } else if (this.ringMesh.material) {
      this.ringMesh.material.opacity = 0.8;
    }

    this.playerState = 'dance';
    this.playerDanceTimer = 0.8; // dance for 0.8 seconds
    this.playerRow = 3; // Dance animation row
    this.playerCol = 0;

    this.screenShake = 0.5;

    // Blast particles
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      this.createHitParticles(this.playerX, 0.2, this.playerZ, 0x00ffff, {
        vx: Math.cos(angle) * 8,
        vy: 2 + Math.random() * 3,
        vz: Math.sin(angle) * 8,
      });
    }

    // Damage all nearby enemies
    const skillRadius = 7;
    this.enemies.forEach((enemy) => {
      if (enemy.state === 'dead') return;
      const dx = enemy.x - this.playerX;
      const dz = enemy.z - this.playerZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < skillRadius) {
        // Push enemy back strongly and kill/damage
        const angle = Math.atan2(dz, dx);
        this.hitEnemy(enemy, Math.cos(angle) * 12, Math.sin(angle) * 12);
      }
    });

    if (this.boss && this.boss.state !== 'dead') {
      const dx = this.boss.x - this.playerX;
      const dz = this.boss.z - this.playerZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < skillRadius + 2) {
        this.hitBoss(5);
      }
    }
  }

  // Trigger ending sequence (transition engine to cutscene state)
  public triggerEndingCutscene() {
    if (this.endingTriggered) return;
    this.endingTriggered = true;
    this.enemies.forEach(e => this.scene.remove(e.mesh));
    this.enemies = [];
    this.fireballs.forEach(f => {
      this.scene.remove(f.mesh);
      this.scene.remove(f.indicatorMesh);
    });
    this.fireballs = [];

    // Clear boss if exists
    if (this.boss) {
      this.scene.remove(this.boss.mesh);
      this.boss = null;
    }

    // Clear portal
    if (this.warpPortal) {
      this.scene.remove(this.warpPortal);
      this.warpPortal = null;
    }

    // Position player
    this.playerX = -4;
    this.playerZ = 0;
    this.playerMesh.position.set(-4, 1.5, 0);
    this.playerFlipX = false;
    this.playerState = 'idle';
    this.playerRow = 0;
    this.playerCol = 0;

    // Spawn NPC walking towards player
    const npcGeo = new THREE.PlaneGeometry(3, 3);
    let npcTex: THREE.Texture;
    if (this.textures['npc']) {
      npcTex = this.textures['npc'].clone();
    } else {
      npcTex = this.createFallbackTexture('npc');
    }

    this.npcMaterial = new THREE.ShaderMaterial({
      vertexShader: spriteVertexShader,
      fragmentShader: spriteFragmentShader,
      uniforms: {
        uMap: { value: npcTex },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uRepeat: { value: new THREE.Vector2(0.25, 0.5) }, // 4 frames x 2 rows
        uFlashColor: { value: new THREE.Color(1, 1, 1) },
        uFlashIntensity: { value: 0.0 },
        uOpacity: { value: 1.0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });

    this.npcMesh = new THREE.Mesh(npcGeo, this.npcMaterial);
    this.npcMesh.position.set(10, 1.5, 0);
    this.npcMesh.castShadow = true;
    this.scene.add(this.npcMesh);

    this.npcX = 10;
    this.npcZ = 0;
    this.npcRow = 1; // Walk row (Row 2, index 1)
    this.npcCol = 0;

    // Notify React state transition to ENDING
    setTimeout(() => {
      this.onStateChange(GameState.ENDING);
    }, 500);
  }

  // Set sprite UV mapping uniforms
  private updateSpriteUV(entity: Entity) {
    const colSize = 1.0 / entity.colCount;
    const rowSize = 1.0 / entity.rowCount;

    const repeatX = entity.flipX ? -colSize : colSize;
    const offsetX = entity.flipX ? (entity.col + 1) * colSize : entity.col * colSize;

    // Correcting Y offset according to row index (texture coordinates bottom-up)
    const repeatY = rowSize;
    const offsetY = (entity.rowCount - 1 - entity.row) * rowSize;

    entity.material.uniforms.uRepeat.value.set(repeatX, repeatY);
    entity.material.uniforms.uOffset.value.set(offsetX, offsetY);
  }

  // Spawning potion power-ups
  private spawnPotion() {
    const potionGeo = new THREE.PlaneGeometry(1.5, 1.5);
    const potionTex = this.textures['potion'].clone();

    const potMat = new THREE.ShaderMaterial({
      vertexShader: spriteVertexShader,
      fragmentShader: spriteFragmentShader,
      uniforms: {
        uMap: { value: potionTex },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uRepeat: { value: new THREE.Vector2(1.0, 1.0) }, // single frame 256x256
        uFlashColor: { value: new THREE.Color(0, 1, 1) },
        uFlashIntensity: { value: 0.0 },
        uOpacity: { value: 1.0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(potionGeo, potMat);
    // Spreading potion on Ground 50
    const rx = (Math.random() - 0.5) * 45;
    const rz = (Math.random() - 0.5) * 45;
    mesh.position.set(rx, 0.8, rz);
    mesh.castShadow = true;
    this.scene.add(mesh);

    this.potions.push({
      mesh,
      material: potMat,
      x: rx,
      z: rz,
      bobTimer: Math.random() * Math.PI,
    });
  }

  // Spawning enemies from all directions
  private spawnEnemy() {
    if (this.enemies.length > 25 || this.endingTriggered) return;

    const enemyGeo = new THREE.PlaneGeometry(2.5, 2.5);
    const enemyTex = this.textures['enemy'].clone();

    const enemyMat = new THREE.ShaderMaterial({
      vertexShader: spriteVertexShader,
      fragmentShader: spriteFragmentShader,
      uniforms: {
        uMap: { value: enemyTex },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uRepeat: { value: new THREE.Vector2(0.25, 0.5) }, // 4 columns, 2 rows
        uFlashColor: { value: new THREE.Color(1, 0, 0) },
        uFlashIntensity: { value: 0.0 },
        uOpacity: { value: 1.0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(enemyGeo, enemyMat);

    // Spawn outside of screen viewport (e.g. at radius 20-25 around player)
    const angle = Math.random() * Math.PI * 2;
    const radius = 22 + Math.random() * 5;
    const ex = this.playerX + Math.cos(angle) * radius;
    const ez = this.playerZ + Math.sin(angle) * radius;

    mesh.position.set(ex, 1.25, ez);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const enemy: Enemy = {
      id: Math.random().toString(36).substr(2, 9),
      mesh,
      material: enemyMat,
      width: 2.5,
      height: 2.5,
      colCount: 4,
      rowCount: 2,
      col: 0,
      row: 1, // Row 2 is Walk (index 1), Row 1 is Idle (index 0)
      flipX: Math.random() > 0.5,
      animTimer: 0,
      animSpeed: 0.15 + Math.random() * 0.05,
      x: ex,
      z: ez,
      vx: 0,
      vz: 0,
      hp: 2, // 2 hits
      state: 'walk',
      flashTimer: 0,
      flashColor: new THREE.Color(1, 0, 0),
      flashIntensity: 0,
      knockbackX: 0,
      knockbackZ: 0,
      knockbackTimer: 0,
      attackCooldown: 1 + Math.random() * 2,
      deathAnimTimer: 0,
    };

    this.enemies.push(enemy);
    this.updateSpriteUV(enemy);
  }

  // Spawning Boss
  private spawnBoss() {
    if (this.bossSpawned) return;
    this.bossSpawned = true;

    const bossGeo = new THREE.PlaneGeometry(5.5, 5.5);
    const bossTex = this.textures['boss'].clone();

    const bossMat = new THREE.ShaderMaterial({
      vertexShader: spriteVertexShader,
      fragmentShader: spriteFragmentShader,
      uniforms: {
        uMap: { value: bossTex },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uRepeat: { value: new THREE.Vector2(0.25, 0.5) }, // 4 columns, 2 rows
        uFlashColor: { value: new THREE.Color(1, 0, 0) },
        uFlashIntensity: { value: 0.0 },
        uOpacity: { value: 1.0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(bossGeo, bossMat);
    mesh.position.set(0, 3, -15);
    mesh.castShadow = true;
    this.scene.add(mesh);

    this.boss = {
      mesh,
      material: bossMat,
      width: 5.5,
      height: 5.5,
      colCount: 4,
      rowCount: 2,
      col: 0,
      row: 0, // Row 1: Idle, Row 2: Attack/Charge
      flipX: false,
      animTimer: 0,
      animSpeed: 0.12,
      x: 0,
      z: -15,
      hp: 25, // Boss has 25 health
      maxHp: 25,
      state: 'idle',
      stateTimer: 2.0,
      targetX: 0,
      targetZ: 0,
      flashTimer: 0,
      flashIntensity: 0,
      scalePhase: 0,
      attackCooldown: 3.0,
    };

    this.updateSpriteUV(this.boss);
    this.updateStats();

    // Visual effect of portal/darkness when spawning
    for (let i = 0; i < 30; i++) {
      this.createHitParticles(0, 3, -15, 0xff00aa, {
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        vz: (Math.random() - 0.5) * 10,
      });
    }
  }

  // Hit enemy mechanic
  private hitEnemy(enemy: Enemy, kx: number, kz: number) {
    enemy.hp--;
    this.createHitParticles(enemy.x, 1.5, enemy.z, 0xffaa00);

    if (enemy.hp === 1) {
      // 1st hit -> Knockback + Flash White-Red
      enemy.knockbackX = kx;
      enemy.knockbackZ = kz;
      enemy.knockbackTimer = 0.4; // 0.4 seconds knockback
      enemy.flashTimer = 0.4;
      enemy.flashColor.setHex(0xffffff);
      enemy.flashIntensity = 0.9;
    } else if (enemy.hp <= 0) {
      // 2nd hit -> Defeated. Flashes white rapidly, flies out/disappears
      enemy.state = 'dead';
      enemy.knockbackX = kx * 1.5;
      enemy.knockbackZ = kz * 1.5;
      enemy.knockbackTimer = 0.5;
      enemy.flashTimer = 0.6;
      enemy.flashColor.setHex(0xffffff);
      enemy.flashIntensity = 1.0;
      enemy.deathAnimTimer = 0.6;

      this.playerKills++;
      this.playerScore += 100;
      this.updateStats();

      // Check for Boss Spawn threshold
      if (this.playerKills >= 10 && !this.bossSpawned) {
        this.spawnBoss();
      }
    }
  }

  private hitBoss(damage: number) {
    if (!this.boss || this.boss.state === 'dead') return;

    this.boss.hp -= damage;
    this.boss.flashTimer = 0.3;
    this.boss.flashIntensity = 0.9;
    this.createHitParticles(this.boss.x, 3.0, this.boss.z, 0xff00ff);

    if (this.boss.hp <= 0) {
      this.boss.state = 'dead';
      this.boss.flashTimer = 2.0;
      this.boss.flashIntensity = 1.0;

      // Boss death firework particles
      for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const vel = 3 + Math.random() * 8;
        this.createHitParticles(this.boss.x, 3.0, this.boss.z, 0xff5500, {
          vx: Math.cos(angle) * vel,
          vy: (Math.random() - 0.2) * 8,
          vz: Math.sin(angle) * vel,
        });
      }

      this.playerScore += 2000;
      this.updateStats();

      // Spawn Warp Portal
      this.spawnWarpPortal();
    } else {
      this.updateStats();
    }
  }

  private spawnWarpPortal() {
    const portalGeo = new THREE.TorusGeometry(2, 0.3, 16, 100);
    const portalMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      wireframe: true,
    });
    this.warpPortal = new THREE.Mesh(portalGeo, portalMat);
    // Align warp portal on the X-Y plane standing up
    if (this.boss) {
      this.warpPortal.position.set(this.boss.x, 2, this.boss.z);
    } else {
      this.warpPortal.position.set(0, 2, 0);
    }
    this.scene.add(this.warpPortal);
  }

  // Create Spark Particles on hit
  private createHitParticles(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    customVel?: { vx: number; vy: number; vz: number }
  ) {
    const particleCount = 12;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = x + (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = y + (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: colorHex,
      size: 0.3,
      transparent: true,
      opacity: 0.9,
    });

    const pMesh = new THREE.Points(geometry, material);
    this.scene.add(pMesh);

    const parts: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const vx = customVel ? customVel.vx : (Math.random() - 0.5) * 5;
      const vy = customVel ? customVel.vy : (Math.random() * 4 + 1);
      const vz = customVel ? customVel.vz : (Math.random() - 0.5) * 5;

      parts.push({
        mesh: pMesh,
        vx,
        vy,
        vz,
        life: 0.5,
        maxLife: 0.5,
      });
    }

    this.particles.push(...parts);

    // Clean up mesh from scene after its life
    setTimeout(() => {
      this.scene.remove(pMesh);
    }, 600);
  }

  // Boss launches fireballs
  private launchBossFireball() {
    if (!this.boss) return;

    // Target a spot around the player
    const targetX = this.playerX + (Math.random() - 0.5) * 6;
    const targetZ = this.playerZ + (Math.random() - 0.5) * 6;

    // Create Ground Warning Indicator (Ring that grows)
    const indGeo = new THREE.RingGeometry(0.01, 1.8, 24);
    indGeo.rotateX(-Math.PI / 2);
    const indMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.2,
    });
    const indicatorMesh = new THREE.Mesh(indGeo, indMat);
    indicatorMesh.position.set(targetX, 0.05, targetZ);
    this.scene.add(indicatorMesh);

    // Create Fireball Sphere Mesh
    const ballGeo = new THREE.SphereGeometry(0.6, 8, 8);
    const ballMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.position.set(this.boss.x, 15, this.boss.z); // starts high up
    this.scene.add(ballMesh);

    const fireball: Fireball = {
      mesh: ballMesh,
      x: this.boss.x,
      z: this.boss.z,
      targetX,
      targetZ,
      height: 15,
      progress: 0,
      speed: 0.45 + Math.random() * 0.1, // lands in ~2 seconds
      indicatorMesh,
    };

    this.fireballs.push(fireball);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.activeKeys[e.code] = true;

    // Handle single action hotkeys to match specifications (P, O)
    if (e.code === this.controls.attack) {
      this.triggerPlayerAttack();
    }
    if (e.code === this.controls.skill) {
      this.triggerPlayerSkill();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.activeKeys[e.code] = false;
  };

  private onWindowResize = () => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  };

  private updateStats() {
    this.onStatsChange({
      hp: this.playerHP,
      maxHp: 5,
      score: this.playerScore,
      kills: this.playerKills,
      skillCooldown: this.skillCooldown,
      skillMaxCooldown: this.skillMaxCooldown,
      bossDefeated: this.boss !== null && this.boss.state === 'dead',
    });
  }

  // CORE UPDATE LOOP
  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1); // cap to prevent leaps

    // Update camera screen shake decay
    if (this.screenShake > 0) {
      this.screenShake -= delta * 1.5;
    }

    if (this.playerHP <= 0) {
      // Game Over state handling
      this.playerHP = 0;
      this.updateStats();
      this.onStateChange(GameState.GAMEOVER);
      this.cancelLoop();
      return;
    }

    // Process gameplay logic
    if (!this.endingTriggered) {
      this.updatePlayerMovement(delta);
      this.updateEnemies(delta);
      this.updatePotions(delta);
      this.updateBoss(delta);
      this.updateFireballs(delta);
      this.updateSkillRing(delta);
      this.updateParticles(delta);

      // Check boundary constraints
      this.constrainPlayerBoundary();
    } else {
      // Ending sequence cutscene updates
      this.updateEndingCutscene(delta);
    }

    // Smooth Billboard rotations (always face the camera parallel plane)
    this.alignBillboards();

    // Camera following smoothly with optional screen shake
    this.updateCameraFollow(delta);

    // Render step
    this.renderer.render(this.scene, this.camera);
  };

  private updatePlayerMovement(delta: number) {
    // If attacking or dancing, restrict movement
    if (this.playerState === 'attack') {
      this.playerAttackTimer += delta;
      // attack frames update
      this.playerAnimTimer += delta;
      if (this.playerAnimTimer >= this.playerAnimSpeed) {
        this.playerAnimTimer = 0;
        this.playerCol = (this.playerCol + 1) % 4;
      }

      if (this.playerAttackTimer >= 0.3) {
        // Attack finishes
        this.playerState = 'idle';
        this.playerCol = 0;
        this.playerRow = 0; // Back to idle row
        this.playerAnimSpeed = 0.15;
      }
      this.playerVx *= 0.8;
      this.playerVz *= 0.8;

      this.updateSpriteUV({
        mesh: this.playerMesh,
        material: this.playerMaterial,
        width: 3,
        height: 3,
        colCount: 4,
        rowCount: 4,
        col: this.playerCol,
        row: this.playerRow,
        flipX: this.playerFlipX,
        animTimer: 0,
        animSpeed: 0,
      });
      return;
    }

    if (this.playerState === 'dance') {
      this.playerDanceTimer -= delta;
      this.playerAnimTimer += delta;
      if (this.playerAnimTimer >= 0.1) {
        this.playerAnimTimer = 0;
        this.playerCol = (this.playerCol + 1) % 4;
      }

      if (this.playerDanceTimer <= 0) {
        this.playerState = 'idle';
        this.playerCol = 0;
        this.playerRow = 0;
      }
      this.playerVx *= 0.8;
      this.playerVz *= 0.8;

      this.updateSpriteUV({
        mesh: this.playerMesh,
        material: this.playerMaterial,
        width: 3,
        height: 3,
        colCount: 4,
        rowCount: 4,
        col: this.playerCol,
        row: this.playerRow,
        flipX: this.playerFlipX,
        animTimer: 0,
        animSpeed: 0,
      });
      return;
    }

    // Decaying hitDelay
    if (this.playerHitDelay > 0) {
      this.playerHitDelay -= delta;
      // Flickering visibility
      this.playerMaterial.uniforms.uOpacity.value = Math.sin(Date.now() * 0.05) > 0 ? 0.4 : 1.0;
    } else {
      this.playerMaterial.uniforms.uOpacity.value = 1.0;
    }

    // Cooldown
    if (this.skillCooldown > 0) {
      this.skillCooldown = Math.max(0, this.skillCooldown - delta);
      this.updateStats();
    }

    // Keyboard 8-direction inputs
    let dx = 0;
    let dz = 0;

    if (this.activeKeys[this.controls.moveUp] || this.activeKeys['ArrowUp']) dz -= 1;
    if (this.activeKeys[this.controls.moveDown] || this.activeKeys['ArrowDown']) dz += 1;
    if (this.activeKeys[this.controls.moveLeft] || this.activeKeys['ArrowLeft']) dx -= 1;
    if (this.activeKeys[this.controls.moveRight] || this.activeKeys['ArrowRight']) dx += 1;

    // Normalizing diagonals for same speed
    if (dx !== 0 && dz !== 0) {
      dx *= 0.7071;
      dz *= 0.7071;
    }

    const speed = 7.5;
    this.playerVx = dx * speed;
    this.playerVz = dz * speed;

    this.playerX += this.playerVx * delta;
    this.playerZ += this.playerVz * delta;

    this.playerMesh.position.set(this.playerX, 1.5, this.playerZ);

    // Flipping sprite sheet horizontal facing
    if (dx < 0) {
      this.playerFlipX = true;
    } else if (dx > 0) {
      this.playerFlipX = false;
    }

    // Update animations
    if (dx !== 0 || dz !== 0) {
      this.playerState = 'walk';
      this.playerRow = 1; // row index 1: walk
      this.playerAnimTimer += delta;

      if (this.playerAnimTimer >= this.playerAnimSpeed) {
        this.playerAnimTimer = 0;
        this.playerCol = (this.playerCol + 1) % 4;
      }

      // running dust particles
      if (Math.random() < 0.15) {
        this.createHitParticles(this.playerX, 0.1, this.playerZ, 0x556677, {
          vx: -this.playerVx * 0.2 + (Math.random() - 0.5) * 1,
          vy: Math.random() * 1.5,
          vz: -this.playerVz * 0.2 + (Math.random() - 0.5) * 1,
        });
      }
    } else {
      this.playerState = 'idle';
      this.playerRow = 0; // Row index 0: idle
      this.playerAnimTimer += delta;
      if (this.playerAnimTimer >= 0.2) {
        this.playerAnimTimer = 0;
        this.playerCol = (this.playerCol + 1) % 4;
      }
    }

    this.updateSpriteUV({
      mesh: this.playerMesh,
      material: this.playerMaterial,
      width: 3,
      height: 3,
      colCount: 4,
      rowCount: 4,
      col: this.playerCol,
      row: this.playerRow,
      flipX: this.playerFlipX,
      animTimer: 0,
      animSpeed: 0,
    });
  }

  private constrainPlayerBoundary() {
    const bound = 28;
    if (this.playerX < -bound) this.playerX = -bound;
    if (this.playerX > bound) this.playerX = bound;
    if (this.playerZ < -bound) this.playerZ = -bound;
    if (this.playerZ > bound) this.playerZ = bound;
  }

  private updateEnemies(delta: number) {
    this.enemySpawnTimer += delta;
    // Spawn system from prompt 4: spawns every 1 to 3 seconds
    const spawnRate = this.bossSpawned ? 2.5 : 1.5;
    if (this.enemySpawnTimer >= spawnRate) {
      this.enemySpawnTimer = 0;
      this.spawnEnemy();
    }

    this.enemies.forEach((enemy, index) => {
      // Damage flash decay
      if (enemy.flashTimer > 0) {
        enemy.flashTimer -= delta;
        enemy.material.uniforms.uFlashIntensity.value = enemy.flashTimer / 0.4;
        enemy.material.uniforms.uFlashColor.value.copy(enemy.flashColor);
      } else {
        enemy.material.uniforms.uFlashIntensity.value = 0;
      }

      // Handle Death sequence
      if (enemy.state === 'dead') {
        enemy.deathAnimTimer -= delta;

        // Fly out animation
        enemy.x += enemy.knockbackX * delta;
        enemy.z += enemy.knockbackZ * delta;
        enemy.mesh.position.set(enemy.x, 1.25 + (1.0 - enemy.deathAnimTimer) * 5, enemy.z);

        // rapid white flash
        enemy.material.uniforms.uFlashColor.value.setHex(0xffffff);
        enemy.material.uniforms.uFlashIntensity.value = Math.sin(Date.now() * 0.1) > 0 ? 1.0 : 0.0;

        if (enemy.deathAnimTimer <= 0) {
          this.scene.remove(enemy.mesh);
          this.enemies.splice(index, 1);
        }
        return;
      }

      // Handle knockback
      if (enemy.knockbackTimer > 0) {
        enemy.knockbackTimer -= delta;
        enemy.x += enemy.knockbackX * delta;
        enemy.z += enemy.knockbackZ * delta;
        enemy.mesh.position.set(enemy.x, 1.25, enemy.z);
        return; // stop standard moving during knockback
      }

      // Move toward player
      const dx = this.playerX - enemy.x;
      const dz = this.playerZ - enemy.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // AI Logic:
      if (distance < 2.0) {
        // Close enough to attack
        enemy.state = 'attack';
        enemy.col = 0;
        enemy.row = 0; // idle frame for attack
        enemy.vx = 0;
        enemy.vz = 0;

        enemy.attackCooldown -= delta;
        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = 1.5; // reset attack cooldown

          // Flash RED to warn of attack
          enemy.flashTimer = 0.3;
          enemy.flashColor.setHex(0xff0000);
          enemy.flashIntensity = 1.0;

          // Hurt player if not in hit delay
          if (this.playerHitDelay <= 0) {
            this.playerHP--;
            this.playerHitDelay = 1.2; // invulnerability delay
            this.screenShake = 0.4;
            this.updateStats();

            // Hit particles on player
            this.createHitParticles(this.playerX, 1.5, this.playerZ, 0xff0000);
          }
        }
      } else {
        // Move towards player
        enemy.state = 'walk';
        const moveSpeed = 3.5;
        enemy.vx = (dx / distance) * moveSpeed;
        enemy.vz = (dz / distance) * moveSpeed;

        enemy.x += enemy.vx * delta;
        enemy.z += enemy.vz * delta;
        enemy.mesh.position.set(enemy.x, 1.25, enemy.z);

        // Update animation frames
        enemy.animTimer += delta;
        if (enemy.animTimer >= enemy.animSpeed) {
          enemy.animTimer = 0;
          enemy.col = (enemy.col + 1) % 4;
        }
        enemy.row = 1; // Row 2 walk (index 1)
      }

      // Face direction of relative player position (flip sprite horizontally)
      // enemy.png default is facing right, so if player is to left (dx < 0), flip horizontally.
      enemy.flipX = dx < 0;

      this.updateSpriteUV(enemy);
    });
  }

  private updatePotions(delta: number) {
    this.potions.forEach((potion, index) => {
      potion.bobTimer += delta * 4;
      potion.mesh.position.y = 0.8 + Math.sin(potion.bobTimer) * 0.15;
      potion.mesh.rotation.y += delta * 1.5;

      // Check collision with Player
      const dx = this.playerX - potion.x;
      const dz = this.playerZ - potion.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < 1.8) {
        // Recover HP up to 5
        if (this.playerHP < 5) {
          this.playerHP = Math.min(5, this.playerHP + 1);
        }
        this.playerScore += 50;
        this.updateStats();

        // Healing green sparkles
        for (let i = 0; i < 15; i++) {
          this.createHitParticles(this.playerX, 1.2, this.playerZ, 0x00ff00, {
            vx: (Math.random() - 0.5) * 4,
            vy: Math.random() * 3 + 2,
            vz: (Math.random() - 0.5) * 4,
          });
        }

        // Clean up potion
        this.scene.remove(potion.mesh);
        this.potions.splice(index, 1);

        // Re-spawn another potion in 5 seconds elsewhere
        setTimeout(() => {
          if (!this.endingTriggered) this.spawnPotion();
        }, 5000);
      }
    });
  }

  private updateBoss(delta: number) {
    if (!this.boss) return;

    const boss = this.boss;

    // Decay damage flash
    if (boss.flashTimer > 0) {
      boss.flashTimer -= delta;
      boss.material.uniforms.uFlashIntensity.value = boss.flashTimer / 0.3;
      boss.material.uniforms.uFlashColor.value.setHex(0xffffff);
    } else {
      boss.material.uniforms.uFlashIntensity.value = 0;
    }

    if (boss.state === 'dead') {
      // Spinning & shrinking into black hole when dead
      boss.mesh.rotation.z += delta * 10;
      boss.mesh.scale.multiplyScalar(Math.max(0.01, 1 - delta * 2));
      boss.material.uniforms.uOpacity.value = Math.max(0.0, boss.material.uniforms.uOpacity.value - delta);
      return;
    }

    boss.stateTimer -= delta;

    // Handle state transformations
    if (boss.stateTimer <= 0) {
      // Select next pattern randomly: idle, dashing, charging (squash warning) then shooting
      const r = Math.random();
      if (r < 0.3) {
        boss.state = 'idle';
        boss.stateTimer = 1.0 + Math.random() * 1.5;
        boss.col = 0;
        boss.row = 0; // idle animation row
      } else if (r < 0.6) {
        // Dash near/far
        boss.state = 'dashing';
        boss.stateTimer = 1.2;
        boss.row = 1; // dash row (Row 2, index 1)
        // target point around player
        const range = 10 + Math.random() * 8;
        const angle = Math.random() * Math.PI * 2;
        boss.targetX = this.playerX + Math.cos(angle) * range;
        boss.targetZ = this.playerZ + Math.sin(angle) * range;
        // Bound constraints
        boss.targetX = Math.max(-25, Math.min(25, boss.targetX));
        boss.targetZ = Math.max(-25, Math.min(25, boss.targetZ));
      } else {
        // Pre-attack Warning (Grow & Shrink / Squash & Stretch)
        boss.state = 'charging';
        boss.stateTimer = 1.5; // Warning step lasts 1.5s
        boss.scalePhase = 0;
        boss.row = 1; // charging animations
      }
    }

    // Execute state actions
    if (boss.state === 'idle') {
      // Bob up and down gently in flight
      boss.mesh.position.y = 3.5 + Math.sin(Date.now() * 0.003) * 0.3;

      // Simple animation
      boss.animTimer += delta;
      if (boss.animTimer >= boss.animSpeed) {
        boss.animTimer = 0;
        boss.col = (boss.col + 1) % 4;
      }
    } else if (boss.state === 'dashing') {
      // Move swiftly toward target coordinate
      const dx = boss.targetX - boss.x;
      const dz = boss.targetZ - boss.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.5) {
        const speed = 15;
        boss.x += (dx / dist) * speed * delta;
        boss.z += (dz / dist) * speed * delta;
        boss.mesh.position.set(boss.x, 3.5, boss.z);
      }

      boss.animTimer += delta;
      if (boss.animTimer >= 0.08) {
        boss.animTimer = 0;
        boss.col = (boss.col + 1) % 4;
      }
    } else if (boss.state === 'charging') {
      // Squash & Stretch visual scaling animation
      boss.scalePhase += delta * 12;
      // Squash & stretch formulas
      const stretchY = 1.0 + Math.sin(boss.scalePhase) * 0.25;
      const squashX = 1.0 - Math.sin(boss.scalePhase) * 0.15;
      boss.mesh.scale.set(squashX, stretchY, 1);

      // Warning color tint
      boss.material.uniforms.uFlashColor.value.setHex(0xff3300);
      boss.material.uniforms.uFlashIntensity.value = Math.sin(Date.now() * 0.02) * 0.4 + 0.4;

      if (boss.stateTimer <= 0) {
        // Fireball barrage!
        boss.state = 'shooting';
        boss.stateTimer = 1.0;
        boss.mesh.scale.set(1, 1, 1);
        boss.material.uniforms.uFlashIntensity.value = 0;

        // Shoot 3 Fireballs in sequence
        this.launchBossFireball();
        setTimeout(() => this.launchBossFireball(), 300);
        setTimeout(() => this.launchBossFireball(), 600);
      }
    } else if (boss.state === 'shooting') {
      // Recoil fly-back
      boss.mesh.position.y = 3.5 + Math.sin(Date.now() * 0.005) * 0.1;
    }

    // Facing direction (relative to player position)
    boss.flipX = this.playerX < boss.x;

    this.updateSpriteUV(boss);
  }

  private updateFireballs(delta: number) {
    this.fireballs.forEach((fb, index) => {
      fb.progress += delta * fb.speed;

      // Quadratic bezier parabola path for high flying arc
      const currentX = THREE.MathUtils.lerp(fb.x, fb.targetX, fb.progress);
      const currentZ = THREE.MathUtils.lerp(fb.z, fb.targetZ, fb.progress);
      // Parabolic arc for Y height: max height 10
      const currentY = fb.height * (1.0 - fb.progress) + 4.0 * fb.progress * (1.0 - fb.progress) * 8.0;

      fb.mesh.position.set(currentX, Math.max(0.5, currentY), currentZ);

      // Scale up warning ring on ground
      const scale = fb.progress;
      fb.indicatorMesh.scale.set(scale, scale, 1);
      // turn darker red
      if (Array.isArray(fb.indicatorMesh.material)) {
        fb.indicatorMesh.material.forEach((m) => {
          m.opacity = 0.2 + fb.progress * 0.5;
        });
      } else if (fb.indicatorMesh.material) {
        fb.indicatorMesh.material.opacity = 0.2 + fb.progress * 0.5;
      }

      // Check landing
      if (fb.progress >= 1.0) {
        // LANDS! Explosive splash particles
        this.createHitParticles(fb.targetX, 0.2, fb.targetZ, 0xff3300, {
          vx: (Math.random() - 0.5) * 8,
          vy: Math.random() * 5 + 3,
          vz: (Math.random() - 0.5) * 8,
        });

        // Damage Player if inside 2.2 radius indicator
        const dx = this.playerX - fb.targetX;
        const dz = this.playerZ - fb.targetZ;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < 2.2 && !this.endingTriggered) {
          if (this.playerHitDelay <= 0) {
            this.playerHP--;
            this.playerHitDelay = 1.2;
            this.screenShake = 0.5;
            this.updateStats();
            this.createHitParticles(this.playerX, 1.5, this.playerZ, 0xff0000);
          }
        }

        // Clean up fireball & warning ring
        this.scene.remove(fb.mesh);
        this.scene.remove(fb.indicatorMesh);
        this.fireballs.splice(index, 1);
      }
    });
  }

  private updateSkillRing(delta: number) {
    if (!this.ringVisible) return;

    this.ringScale += delta * 15.0; // expand fast
    this.ringMesh.scale.set(this.ringScale, this.ringScale, 1);

    if (Array.isArray(this.ringMesh.material)) {
      this.ringMesh.material.forEach((m) => {
        m.opacity = Math.max(0, 0.8 - this.ringScale * 0.12);
      });
    } else if (this.ringMesh.material) {
      this.ringMesh.material.opacity = Math.max(0, 0.8 - this.ringScale * 0.12);
    }

    if (this.ringScale >= 8) {
      this.ringVisible = false;
    }
  }

  private updateParticles(delta: number) {
    // Basic gravity / velocity simulation for buffer particles
    this.particles.forEach((p, idx) => {
      p.life -= delta;
      if (p.life <= 0) {
        this.particles.splice(idx, 1);
        return;
      }

      // Physics integration (velocity & simple grav)
      p.vy -= 9.8 * delta;

      // Update actual position in ThreeJS mesh attributes
      const geom = p.mesh.geometry as THREE.BufferGeometry;
      const positions = geom.attributes.position.array as Float32Array;

      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += p.vx * delta;
        positions[i + 1] += p.vy * delta;
        positions[i + 2] += p.vz * delta;
        // Bounce ground collision
        if (positions[i + 1] < 0.1) {
          positions[i + 1] = 0.1;
          p.vy = -p.vy * 0.4; // bounce
        }
      }
      geom.attributes.position.needsUpdate = true;
    });
  }

  private updateCameraFollow(delta: number) {
    const targetCamX = this.playerX + this.cameraOffset.x;
    const targetCamY = this.cameraOffset.y;
    const targetCamZ = this.playerZ + this.cameraOffset.z;

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, delta * 3.5);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, delta * 3.5);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamZ, delta * 3.5);

    // Apply Screen Shake
    if (this.screenShake > 0) {
      const shakeAmt = this.screenShake * 0.6;
      this.camera.position.x += (Math.random() - 0.5) * shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * shakeAmt;
      this.camera.position.z += (Math.random() - 0.5) * shakeAmt;
    }

    const lookTarget = new THREE.Vector3(this.playerX, 0.5, this.playerZ);
    this.camera.lookAt(lookTarget);
  }

  private alignBillboards() {
    const camRotation = this.camera.rotation;

    // All active 2.5D planar sprites must align to screen parallel
    if (this.playerMesh) {
      this.playerMesh.rotation.copy(camRotation);
    }

    this.enemies.forEach((enemy) => {
      enemy.mesh.rotation.copy(camRotation);
    });

    this.potions.forEach((potion) => {
      potion.mesh.rotation.copy(camRotation);
    });

    if (this.boss) {
      this.boss.mesh.rotation.copy(camRotation);
    }

    if (this.npcMesh) {
      this.npcMesh.rotation.copy(camRotation);
    }

    // Warp Portal rotates
    if (this.warpPortal) {
      this.warpPortal.rotation.y += 0.02;
      this.warpPortal.rotation.x += 0.01;

      // If player touches portal -> end game cutscene trigger!
      const dx = this.playerX - this.warpPortal.position.x;
      const dz = this.playerZ - this.warpPortal.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 2.0 && !this.endingTriggered) {
        this.triggerEndingCutscene();
      }
    }
  }

  private updateEndingCutscene(delta: number) {
    if (!this.npcMesh || !this.npcMaterial) return;

    // NPC walks towards the player (who is at X=-4, Z=0). NPC starts at X=10, walks to X=2
    if (this.npcX > 2.0) {
      this.npcRow = 1; // Walk row
      this.npcX -= delta * 2.8; // move smoothly
      this.npcMesh.position.set(this.npcX, 1.5, this.npcZ);

      this.npcAnimTimer += delta;
      if (this.npcAnimTimer >= 0.12) {
        this.npcAnimTimer = 0;
        this.npcCol = (this.npcCol + 1) % 4;
      }
    } else {
      // Reached dialogue position
      this.npcRow = 0; // Standing row
      this.npcCol = 0; // static idle frame
    }

    // Player faces right, NPC faces left (default npc is facing right? npc.png from Cloudinary has default facing right, so we can flip NPC to face left to talk to player)
    this.playerFlipX = false; // Player faces right
    this.npcMesh.scale.x = -1; // Flip NPC horizontally to face left towards Player

    this.updateSpriteUV({
      mesh: this.npcMesh,
      material: this.npcMaterial,
      width: 3,
      height: 3,
      colCount: 4,
      rowCount: 2,
      col: this.npcCol,
      row: this.npcRow,
      flipX: false, // handeled by scale.x flip
      animTimer: 0,
      animSpeed: 0,
    });
  }

  public cancelLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
