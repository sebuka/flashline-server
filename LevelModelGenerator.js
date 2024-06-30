const LevelValidator = require('./LevelValidator');
const LevelModel = require('./LevelModel');

class LevelModelGenerator {
    generate(difficulty, seed) {
        const startTime = Date.now();
        let isModelValid = false;
        let localseed = seed;
        let model = null;
        model = this.generateModel(difficulty, localseed);
		model.optimalPaths = -1;
        model.seed = seed;
        return model;
    }

    generateModel(difficulty, seed) {
        const random = new Random(seed);

        const gridSize = random.nextInt(difficulty.maxGridSize - difficulty.minGridSize + 1) + difficulty.minGridSize;
        const model = new LevelModel(gridSize);

        let totalCells = gridSize * gridSize;
        let remainingCells = totalCells;
        const walls = Math.min(random.nextInt(difficulty.maxWalls - difficulty.minWalls + 1) + difficulty.minWalls, remainingCells);
        remainingCells -= walls;
        const bridges = Math.min(random.nextInt(difficulty.maxBridges - difficulty.minBridges + 1) + difficulty.minBridges, remainingCells);
        remainingCells -= bridges;
        const points = random.nextInt(difficulty.maxPoints - difficulty.minPoints + 1) + difficulty.minPoints;
        remainingCells -= points;
        const emptyCells = remainingCells;

        const cells = [];
        let colorCount = 1;
        for (let i = 0; i < points; i++) {
            cells.push(colorCount, colorCount);
            colorCount++;
        }

        for (let i = 0; i < walls; i++) cells.push(-2);
        for (let i = 0; i < bridges; i++) cells.push(-1);
        for (let i = 0; i < emptyCells; i++) cells.push(0);
        shuffle(cells, random);

        let index = 0;
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                model.model[i][j] = cells[index++];
            }
        }

        model.points = points;
        model.time = difficulty.optimalTime;
        model.pathsPercentage = difficulty.pathLengthPercentage;

        return model;
    }

    validateModel(model) {
        const validator = new LevelValidator(model);
        return validator.validate();
    }
}

// Utility functions
function shuffle(array, random) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(random.nextFloat() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

class Random {
    constructor(seed) {
        this.seed = seed;
    }

    nextInt(max) {
        const x = Math.sin(this.seed++) * 10000;
        return Math.floor((x - Math.floor(x)) * max);
    }

    nextFloat() {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }
}

module.exports = LevelModelGenerator;
