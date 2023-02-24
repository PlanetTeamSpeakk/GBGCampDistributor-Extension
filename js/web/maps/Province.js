class Province {
    constructor(map, id, name) {
        this.map = map;
        this.id = id;
        this.name = name;

        this.neighborNames = new Set();
        this.slotCount = 0;
        this.ours = false;
        this.isSpawnSpot = false;
        this.desiredCount = 0;
    }

    get neighbors() {
        return new Set(Array.from(this.neighborNames).map(pname => this.map.provinces[pname]));
    }

    init(slotCount, ours, isSpawnSpot) {
        this.slotCount = slotCount;
        this.ours = ours;
        this.isSpawnSpot = isSpawnSpot;
    }

    addNeighbor(province) {
        this.neighborNames.add(province);
        this.map.provinces[province].neighborNames.add(this.name);
    }
}
