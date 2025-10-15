import { AUTO, Game } from 'phaser';
import { Game as MainGame } from './scenes/Game';

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#028af8',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: {
                y: 0,
                x: 0
            },
        },
    },
    scene: [
        MainGame
    ]
};

export default new Game(config);