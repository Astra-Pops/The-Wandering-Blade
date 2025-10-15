import { Scene } from 'phaser';

export class Game extends Scene {

    constructor() {
        super('Game');
    }

    create() {
        this.add.text(512, 384, 'The project is working!', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);
    }
}