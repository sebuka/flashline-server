class Difficulty {
  constructor(name, minGridSize, maxGridSize, minWalls, maxWalls, minBridges, maxBridges, minPoints, maxPoints, optimalTime, pathLengthPercentage) {
    this.name = name;
    this.minGridSize = minGridSize;
    this.maxGridSize = maxGridSize;
    this.minWalls = minWalls;
    this.maxWalls = maxWalls;
    this.minBridges = minBridges;
    this.maxBridges = maxBridges;
    this.minPoints = minPoints;
    this.maxPoints = maxPoints;
    this.optimalTime = optimalTime;
    this.pathLengthPercentage = pathLengthPercentage;
  }
}

const DifficultyLevels = {
  EASY: new Difficulty("Легкий", 3, 5, 1, 2, 0, 1, 5, 7, 30, 0.5),
  MEDIUM: new Difficulty("Средний", 5, 10, 2, 5, 1, 2, 5, 6, 60, 0.8),
  HARD: new Difficulty("Трудный", 10, 15, 5, 10, 2, 4, 12, 15,120, 1.0)
};

module.exports = DifficultyLevels;
