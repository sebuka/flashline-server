class LevelValidator {
    constructor(model) {
        this.n = model.size;
        const sz = this.n * this.n;
        this.s = 0;
        this.t = 4 * sz + 1;
        this.mcmf = new MCMF(4 * sz + 2, this.s, this.t);
        this.grid = model.model;
    }

    isValid(x, y) {
        return x >= 0 && y >= 0 && x < this.n && y < this.n;
    }

    validate() {
        const colors = {};
        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                const type = this.grid[i][j];
                if (type > 0) {
                    if (!colors[type]) {
                        this.mcmf.addEdge(this.s, j * this.n + i + 1, 1, 0);
                    } else {
                        this.mcmf.addEdge(j * this.n + i + 1 + this.n * this.n, this.t, 1, 0);
                    }
                    colors[type] = true;
                }
            }
        }

        const h = Array.from({ length: this.n }, () => Array(this.n).fill(-1));
        const v = Array.from({ length: this.n }, () => Array(this.n).fill(-1));

        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                if (this.grid[i][j] === -1) {
                    h[i][j] = i * this.n + j + 1;
                    this.mcmf.addEdge(h[i][j], h[i][j] + this.n * this.n, 1, 0);
                    v[i][j] = i * this.n + j + 1 + 2 * this.n * this.n;
                    this.mcmf.addEdge(v[i][j], v[i][j] + this.n * this.n, 1, 0);
                } else if (this.grid[i][j] !== -2) {
                    h[i][j] = v[i][j] = i * this.n + j + 1;
                    this.mcmf.addEdge(h[i][j], h[i][j] + this.n * this.n, 1, 0);
                }
            }
        }

        const dx = [-1, 0, 0, 1];
        const dy = [0, -1, 1, 0];
        const check = [false, true, true, false];

        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                if (this.grid[i][j] === -2) continue;
                for (let k = 0; k < 4; k++) {
                    const x = i + dx[k], y = j + dy[k];
                    if (this.isValid(x, y) && this.grid[x][y] !== -2) {
                        if (check[k]) {
                            this.mcmf.addEdge(h[i][j] + this.n * this.n, h[x][y], 1, 1);
                        } else {
                            this.mcmf.addEdge(v[i][j] + this.n * this.n, v[x][y], 1, 1);
                        }
                    }
                }
            }
        }

        const need = Object.keys(colors).length;
        const result = this.mcmf.maxFlow();
        if (result.flow !== need) {
            return -1;
        } else {
            return result.cost / 2;
        }
    }
}

class MCMF {
    constructor(n, s, t) {
        this.n = n;
        this.s = s;
        this.t = t;
        this.edge = [];
        this.g = Array.from({ length: n }, () => []);
        this.d = new Array(n).fill(Number.MAX_SAFE_INTEGER);
        this.p = new Array(n).fill(0);
        this.par = new Array(n).fill(-1);
    }

    addEdge(u, v, c, cost) {
        this.g[u].push(this.edge.length);
        this.edge.push(new Edge(v, c, 0, cost));
        this.g[v].push(this.edge.length);
        this.edge.push(new Edge(u, 0, 0, -cost));
    }

    flex() {
        this.d.fill(Number.MAX_SAFE_INTEGER);
        this.par.fill(-1);
        const queue = new Set();
        this.d[this.s] = 0;
        queue.add({ d: this.d[this.s], u: this.s });
        while (queue.size) {
            const { d, u } = [...queue].reduce((a, b) => (a.d < b.d ? a : b));
            queue.delete({ d, u });
            for (const i of this.g[u]) {
                const e = this.edge[i];
                const w = e.cost + this.p[u] - this.p[e.v];
                if (e.c - e.f > 0 && this.d[u] + w < this.d[e.v]) {
                    queue.delete({ d: this.d[e.v], u: e.v });
                    this.d[e.v] = this.d[u] + w;
                    this.par[e.v] = i;
                    queue.add({ d: this.d[e.v], u: e.v });
                }
            }
        }
        for (let i = 0; i < this.n; i++) {
            if (this.d[i] < Number.MAX_SAFE_INTEGER) {
                this.d[i] += this.p[i] - this.p[this.s];
            }
        }
        for (let i = 0; i < this.n; i++) {
            if (this.d[i] < Number.MAX_SAFE_INTEGER) {
                this.p[i] = this.d[i];
            }
        }
        return this.d[this.t] !== Number.MAX_SAFE_INTEGER;
    }

    sendFlow(u, cur, cost) {
        if (this.par[u] === -1) return cur;
        const i = this.par[u];
        const e = this.edge[i];
        const bck = this.edge[i ^ 1];
        const f = this.sendFlow(bck.v, Math.min(cur, e.c - e.f), cost);
        e.f += f;
        bck.f -= f;
        cost[0] += f * e.cost;
        return f;
    }

    maxFlow() {
        this.d.fill(Number.MAX_SAFE_INTEGER);
        this.p.fill(0);
        this.d[this.s] = 0;
        let relax = true;
        for (let flex = 0; flex < this.n && relax; flex++) {
            relax = false;
            for (let u = 0; u < this.n; u++) {
                for (const i of this.g[u]) {
                    const e = this.edge[i];
                    if (this.d[u] + e.cost < this.d[e.v]) {
                        this.d[e.v] = this.d[u] + e.cost;
                        relax = true;
                    }
                }
            }
        }
        for (let i = 0; i < this.n; i++) {
            if (this.d[i] < Number.MAX_SAFE_INTEGER) {
                this.p[i] = this.d[i];
            }
        }
        let flow = 0, cost = 0;
        while (this.flex()) flow += this.sendFlow(this.t, Number.MAX_SAFE_INTEGER, [cost]);
        const ft = this.edge.map(e => e.f);
        return { flow, cost };
    }
}

class Edge {
    constructor(v, c, f, cost) {
        this.v = v;
        this.c = c;
        this.f = f;
        this.cost = cost;
    }
}

module.exports = LevelValidator;
