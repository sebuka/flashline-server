class LevelModel {
    constructor(size) {
        this.size = size;
        this.model = Array.from({ length: size }, () => Array(size).fill(0));
        this.seed = 0;
        this.optimalPaths = 0;
        this.time = 0;
        this.pathsPercentage = 0.0;
        this.points = 0;
    }

    static fromJson(jsonString) {
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    toJson() {
        try {
            return JSON.stringify(this);
        } catch (e) {
            console.error(e);
            return null;
        }
    }
}

module.exports = LevelModel;
