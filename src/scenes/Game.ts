// src/scenes/Game.ts
import { Scene } from 'phaser';

export class Game extends Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

    constructor() {
        super('Game');
    }

    preload() {
        // --- Load Character Assets ---
        const frameW = 64;
        const frameH = 64;
        this.load.spritesheet('player-down', 'Assets/Entities/Characters/Body_A/Animations/Walk_Base/Walk_Down-Sheet.png', { frameWidth: frameW, frameHeight: frameH });
        this.load.spritesheet('player-up', 'Assets/Entities/Characters/Body_A/Animations/Walk_Base/Walk_Up-Sheet.png', { frameWidth: frameW, frameHeight: frameH });
        this.load.spritesheet('player-side', 'Assets/Entities/Characters/Body_A/Animations/Walk_Base/Walk_Side-Sheet.png', { frameWidth: frameW, frameHeight: frameH });

        // --- Load World Assets ---
        // Load the tileset images. The first name ('structures', 'vegetation') is a nickname we give it.
        // The second is the path to the file.
        this.load.image('structures', 'Assets/Environment/Structures/Buildings/Walls.png');
        this.load.image('floors', 'Assets/Environment/Tilesets/Floors_Tiles.png');
        this.load.image('vegetation', 'Assets/Environment/Props/Static/Vegetation.png');
        
        // Load the map data file you created in Tiled
        this.load.tilemapTiledJSON('artesian-map', 'Assets/Maps/artesian.json');
    }

    create() {
        // --- Create the World ---
        const map = this.make.tilemap({ key: 'artesian-map' });

        // Add the tilesets to the map. The first name MUST match the tileset name you used in Tiled.
        const tilesetStructures = map.addTilesetImage('Walls', 'structures');
        const tilesetFloors = map.addTilesetImage('Floors_Tiles', 'floors');
        const tilesetVegetation = map.addTilesetImage('Vegetation', 'vegetation');

        // Create the layers. The name MUST match the layer name you used in Tiled.
        const groundLayer = map.createLayer('Ground', [tilesetFloors, tilesetVegetation], 0, 0);
        const buildingsLayer = map.createLayer('Buildings', [tilesetStructures], 0, 0);

        // --- Create the Player ---
        // Find the "PlayerStart" object we placed in Tiled
        const spawnPoint = map.findObject('Spawns', obj => obj.name === 'PlayerStart');
        
        // Create the player at that spawn point
        this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, 'player-down');

        // --- Physics and Camera ---
        // Set collisions. Any tile in the 'Buildings' layer will be solid.
        buildingsLayer.setCollisionByExclusion([-1]);
        this.physics.add.collider(this.player, buildingsLayer);

        // Make the camera follow the player
        this.cameras.main.startFollow(this.player, true);
        this.cameras.main.setZoom(2); // Zoom in for a classic RPG feel

        // --- Animations and Controls (same as before) ---
        this.cursors = this.input.keyboard.createCursorKeys();
        // ... (animation creation code from previous step) ...
        this.anims.create({ key: 'down-walk', frames: this.anims.generateFrameNumbers('player-down', { start: 0, end: -1 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'up-walk', frames: this.anims.generateFrameNumbers('player-up', { start: 0, end: -1 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'side-walk', frames: this.anims.generateFrameNumbers('player-side', { start: 0, end: -1 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'idle', frames: [{ key: 'player-down', frame: 0 }], frameRate: 20 });
    }

    update() {
        // ... (update code with player movement is exactly the same as before) ...
        const speed = 200;
        this.player.setVelocity(0);

        if (this.cursors.left.isDown) { this.player.setVelocityX(-speed); this.player.anims.play('side-walk', true); this.player.setFlipX(true); } 
        else if (this.cursors.right.isDown) { this.player.setVelocityX(speed); this.player.anims.play('side-walk', true); this.player.setFlipX(false); } 
        else if (this.cursors.up.isDown) { this.player.setVelocityY(-speed); this.player.anims.play('up-walk', true); } 
        else if (this.cursors.down.isDown) { this.player.setVelocityY(speed); this.player.anims.play('down-walk', true); } 
        else { this.player.anims.play('idle'); }

        if (this.cursors.up.isDown || this.cursors.down.isDown || (!this.cursors.left.isDown && !this.cursors.right.isDown)) { this.player.setFlipX(false); }
    }
}
