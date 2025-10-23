// src/scenes/Game.ts
import Phaser from 'phaser';

type TiledProp = { name: string; type?: string; value: any };
const propsToObj = (ps?: TiledProp[]) =>
  (ps || []).reduce((a, p) => ((a[p.name] = p.value), a), {} as Record<string, any>);

const FRAME_W = 64;
const FRAME_H = 64;

const HERO_BASE = 'Assets/Entities/Characters/Body_A/Animations';

const k = {
  idleDown: 'hero_idle_down',
  idleUp: 'hero_idle_up',
  idleSide: 'hero_idle_side',
  walkDown: 'hero_walk_down',
  walkUp: 'hero_walk_up',
  walkSide: 'hero_walk_side',
  runDown: 'hero_run_down',
  runUp: 'hero_run_up',
  runSide: 'hero_run_side',
};

export class Game extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private doorBodies: Phaser.GameObjects.Rectangle[] = [];
  private facing: 'down' | 'up' | 'side' = 'down';

  private current!: {
    map: Phaser.Tilemaps.Tilemap;
    tiles?: Phaser.Tilemaps.Tileset; // optional now
    layers: {
      ground?: Phaser.Tilemaps.TilemapLayer | null;
      decor?: Phaser.Tilemaps.TilemapLayer | null;
      buildings?: Phaser.Tilemaps.TilemapLayer | null;
      walls?: Phaser.Tilemaps.TilemapLayer | null;
    };
    doors: any[];
  };

  private errorText?: Phaser.GameObjects.Text;

  constructor() { super('Game'); }

  private showError(msg: string) {
    console.error('[ARTESIAN ERROR]', msg);
    if (this.errorText) this.errorText.destroy();
    this.errorText = this.add.text(16, 16, msg, {
      fontFamily: 'monospace', fontSize: '14px', color: '#fff', backgroundColor: '#a00'
    }).setScrollFactor(0).setDepth(9999);
  }

  preload() {
    // Loud load errors
    this.load.on('loaderror', (_file: any, key: string, type: string) => {
      this.showError(`Load error: key=${key} type=${type} (check path/case under public/Assets/…)`);
    });

    // --- Maps ---
    this.load.tilemapTiledJSON('artesian',        'Assets/Maps/Artesian/artesian_map.tmj');
    this.load.tilemapTiledJSON('tavern_interior', 'Assets/Maps/Artesian/tavern_interior.tmj');
    this.load.tilemapTiledJSON('bakery_interior', 'Assets/Maps/Artesian/bakery_interior.tmj');
    this.load.tilemapTiledJSON('guild_interior',  'Assets/Maps/Artesian/guild_interior.tmj');
    this.load.tilemapTiledJSON('church_interior', 'Assets/Maps/Artesian/church_interior.tmj');
    this.load.tilemapTiledJSON('mill_interior',   'Assets/Maps/Artesian/mill_interior.tmj');
    // preload()
    this.load.image('mc_house_tileset', 'Assets/Maps/Artesian/mc_house_tileset.png');
    this.load.tilemapTiledJSON('mc_house_interior', 'Assets/Maps/Artesian/mc_house_interior.tmj');

    // Tileset image (the name used below must match <tileset name="…"> in the TMJ/TSX;
    // we’ll actually auto-detect the name, so the image key can be anything)
    this.load.image('artesian_tiles', 'Assets/Maps/Artesian/artesian_tileset.png');

    // --- Hero sheets ---
    const HERO_BASE = 'Assets/Entities/Characters/Body_A/Animations';

    this.load.spritesheet(k.idleDown, `${HERO_BASE}/Idle_Base/Idle_Down-Sheet.png`, { frameWidth: FRAME_W, frameHeight: FRAME_H });
    this.load.spritesheet(k.idleUp,   `${HERO_BASE}/Idle_Base/Idle_Up-Sheet.png`,   { frameWidth: FRAME_W, frameHeight: FRAME_H });
    this.load.spritesheet(k.idleSide, `${HERO_BASE}/Idle_Base/Idle_Side-Sheet.png`, { frameWidth: FRAME_W, frameHeight: FRAME_H });

    this.load.spritesheet(k.walkDown, `${HERO_BASE}/Walk_Base/Walk_Down-Sheet.png`, { frameWidth: FRAME_W, frameHeight: FRAME_H });
    this.load.spritesheet(k.walkUp,   `${HERO_BASE}/Walk_Base/Walk_Up-Sheet.png`,   { frameWidth: FRAME_W, frameHeight: FRAME_H });
    this.load.spritesheet(k.walkSide, `${HERO_BASE}/Walk_Base/Walk_Side-Sheet.png`, { frameWidth: FRAME_W, frameHeight: FRAME_H });

    this.load.spritesheet(k.runDown,  `${HERO_BASE}/Run_Base/Run_Down-Sheet.png`,   { frameWidth: FRAME_W, frameHeight: FRAME_H });
    this.load.spritesheet(k.runUp,    `${HERO_BASE}/Run_Base/Run_Up-Sheet.png`,     { frameWidth: FRAME_W, frameHeight: FRAME_H });
    this.load.spritesheet(k.runSide,  `${HERO_BASE}/Run_Base/Run_Side-Sheet.png`,   { frameWidth: FRAME_W, frameHeight: FRAME_H });
  }
  
  create() {
    // Sanity text so you *always* see the scene is running
    this.add.text(8, 8, 'Scene OK', { color: '#fff' }).setScrollFactor(0).setDepth(9998);

    this.buildMap('artesian');
    this.makeHeroAnims();

    // Hero
    const startX = 31 * 16, startY = 35 * 16;
    this.player = this.physics.add.sprite(startX, startY, k.idleDown, 0).setDepth(10);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(16, 16).setOffset((FRAME_W - 16) / 2, FRAME_H - 16);
    body.setCollideWorldBounds(true);

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    // Colliders (guard nulls to satisfy TS)
    const b = this.current.layers.buildings;
    const w = this.current.layers.walls;
    if (b) this.physics.add.collider(this.player, b);
    if (w) this.physics.add.collider(this.player, w);

    const kb = this.input?.keyboard;
    if (!kb) throw new Error('Phaser Keyboard plugin not available.');
    this.cursors = kb.createCursorKeys();


    this.attachDoorOverlaps();
    this.playIdle('down');

    // If layers missing, prompt to check URLs
    if (!this.current.layers.ground && !this.current.layers.buildings && !this.current.layers.walls) {
      this.showError('No tile layers created. Open devtools → Network and load:\n' +
        'Assets/Maps/Artesian/artesian_map.tmj\nAssets/Maps/Artesian/artesian_tileset.png');
    }
  }

  update() {
    const run = this.cursors.shift?.isDown;
    const speed = run ? 220 : 140;

    let vx = 0, vy = 0;
    if (this.cursors.left?.isDown)  vx = -speed;
    else if (this.cursors.right?.isDown) vx = speed;
    if (this.cursors.up?.isDown)    vy = -speed;
    else if (this.cursors.down?.isDown)  vy = speed;

    this.player.setVelocity(vx, vy);

    if (vx === 0 && vy === 0) { this.playIdle(this.facing); return; }

    if (Math.abs(vx) > Math.abs(vy)) { this.facing = 'side'; this.player.setFlipX(vx < 0); }
    else if (vy > 0) { this.facing = 'down'; this.player.setFlipX(false); }
    else { this.facing = 'up'; this.player.setFlipX(false); }

    run ? this.playRun(this.facing) : this.playWalk(this.facing);
  }

  // ------------ map helpers ------------

  private buildMap(key: string) {
    // Cleanup previous
    if (this.current) {
      Object.values(this.current.layers).forEach(l => l && l.destroy());
      this.doorBodies.forEach(r => r.destroy());
      this.doorBodies = [];
    }

    const map = this.make.tilemap({ key });

    // Auto-detect the tileset name from the map (so it works even if you renamed it in Tiled)
    const tilesetName = map.tilesets[0]?.name ?? 'artesian_tileset';

    const tilesMaybe = map.addTilesetImage(tilesetName, 'artesian_tiles');
    if (!tilesMaybe) {
      this.showError(`Tileset missing: map expects "${tilesetName}" and image key "artesian_tiles".`);
    }
    const tiles = tilesMaybe ?? undefined;

    const ground    = tiles && map.getLayerIndex('Ground')    !== -1 ? map.createLayer('Ground', tiles, 0, 0) : null;
    const decor     = tiles && map.getLayerIndex('Decor')     !== -1 ? map.createLayer('Decor', tiles, 0, 0) : null;
    const buildings = tiles && map.getLayerIndex('Buildings') !== -1 ? map.createLayer('Buildings', tiles, 0, 0) : null;
    const walls     = tiles && map.getLayerIndex('Walls')     !== -1 ? map.createLayer('Walls', tiles, 0, 0) : null;

    if (buildings) buildings.setCollisionByProperty({ collidable: true });
    if (walls)     walls.setCollisionByProperty({ collidable: true });

    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    const doorsLayer = map.getObjectLayer('Doors');

    this.current = {
      map,
      tiles,
      layers: { ground, decor, buildings, walls },
      doors: doorsLayer?.objects || []
    };
  }

  private attachDoorOverlaps() {
    for (const d of this.current.doors) {
      const r = this.add.rectangle(
        d.x + d.width / 2,
        d.y + d.height / 2,
        d.width,
        d.height,
        0x00ff00,
        0
      ) as Phaser.GameObjects.Rectangle;
      this.physics.add.existing(r, true);
      this.physics.add.overlap(this.player, r, () => this.enterDoor(d));
      this.doorBodies.push(r);
    }
  }

  private enterDoor(doorObj: any) {
  const p = propsToObj(doorObj.properties);
  const targetKey = (p.targetMap as string)?.replace('.tmj', '');
  if (!targetKey) return;

  this.buildMap(targetKey);

  // resolve spawn safely
  let sx: number | undefined = p.targetX;
  let sy: number | undefined = p.targetY;

  if (sx == null || sy == null) {
    const spawnName = (p.targetSpawn as string) || 'spawn';
    const spawnLayer = this.current.map.getObjectLayer('Objects');
    const spawnObj = spawnLayer && Array.isArray(spawnLayer.objects)
      ? spawnLayer.objects.find((o: any) => o?.name === spawnName)
      : undefined;

    if (spawnObj && typeof spawnObj.x === 'number' && typeof spawnObj.y === 'number') {
      sx = spawnObj.x; sy = spawnObj.y;
    } else {
      sx = 64; sy = 64; // safe fallback
    }
  }

  this.player.setPosition(sx!, sy!);

  const b = this.current.layers.buildings;
  const w = this.current.layers.walls;
  if (b) this.physics.add.collider(this.player, b);
  if (w) this.physics.add.collider(this.player, w);

  this.attachDoorOverlaps();
  this.playIdle(this.facing);
}


  // ------------ hero animations ------------

  private makeHeroAnims() {
    const mk = (key: string, sheetKey: string, rate = 8) => {
      if (this.anims.exists(key)) return;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(sheetKey, {}),
        frameRate: rate,
        repeat: -1
      });
    };

    mk('idle_down', k.idleDown, 4);
    mk('idle_up',   k.idleUp,   4);
    mk('idle_side', k.idleSide, 4);

    mk('walk_down', k.walkDown, 8);
    mk('walk_up',   k.walkUp,   8);
    mk('walk_side', k.walkSide, 8);

    mk('run_down',  k.runDown, 12);
    mk('run_up',    k.runUp,   12);
    mk('run_side',  k.runSide, 12);
  }

  private playIdle(dir: 'down' | 'up' | 'side') { this.player.play(`idle_${dir}`, true); }
  private playWalk(dir: 'down' | 'up' | 'side') { this.player.play(`walk_${dir}`, true); }
  private playRun(dir: 'down' | 'up' | 'side')  { this.player.play(`run_${dir}`, true); }
}
