class VolcanoArchipelagoMap extends GBGMap {
    constructor() {
        super();

        // First ring
        this.provinces["A1M"] = new Province(this, 0, "A1M");
        this.provinces["B1O"] = new Province(this, 1, "B1O");
        this.provinces["C1N"] = new Province(this, 2, "C1N");
        this.provinces["D1B"] = new Province(this, 3, "D1B");

        for (let i = 0; i < 4; i++)
        {
            let quarterId = GBGCD.sumChar('A', i);

            // Second ring
            for (let j = 0; j < 2; j++)
            {
                let name = `${quarterId}2${GBGCD.sumChar('S', j)}`;
                this.provinces[name] = new Province(this, 4 + i * 2 + j, name);
            }

            // Third ring
            for (let j = 0; j < 4; j++)
            {
                let name = `${quarterId}3${GBGCD.sumChar('V', (j === 0 ? 0 : j + 1))}`;
                this.provinces[name] = new Province(this, 4 + 8 + i * 4 + j, name);
            }

            // Fourth ring
            for (let j = 0; j < 8; j++)
            {
                let name = `${quarterId}4${GBGCD.sumChar('A', j)}`;
                this.provinces[name] = new Province(this, 4 + 8 + 16 + i * 8 + j, name);
            }
        }

        let add = (province, ...provinces) => {
            for (let neighbour of provinces)
                this.provinces[province].addNeighbor(neighbour);
        }

        // First ring
        add("A1M", "A2S", "A2T", "B1O", "D1B");
        add("B1O", "A1M", "B2S", "B2T", "C1N");
        add("C1N", "D1B", "B1O", "C2S", "C2T");
        add("D1B", "D2T", "A1M", "C1N", "D2S");


        // Second ring
        add("A2S", "A3V", "A3X", "A2T", "A1M", "D2T");
        add("A2T", "A3Y", "A3Z", "B2S", "A1M", "A2S");
        add("B2S", "A2T", "B3V", "B3X", "B2T", "B1O");
        add("B2T", "B1O", "B2S", "B3Y", "B3Z", "C2S");
        add("C2S", "C1N", "B2T", "C3V", "C3X", "C2T");
        add("C2T", "D2S", "C1N", "C2S", "C3Y", "C3Z");
        add("D2S", "D2T", "D1B", "C2T", "D3V", "D3X");
        add("D2T", "D3Y", "D3Z", "A2S", "D1B", "D2S");


        // Third ring
        add("A3V", "A3X", "A2S", "D3Z");
        add("A3X", "A3Y", "A2S", "A3V");
        add("A3Y", "A3Z", "A2T", "A3X");
        add("A3Z", "B3V", "A2T", "A3Y");
        add("B3V", "B3X", "B2S", "A3Z");
        add("B3X", "B3Y", "B2S", "B3V");
        add("B3Y", "B3Z", "B2T", "B3X");
        add("B3Z", "C3V", "B2T", "B3Y");
        add("C3V", "C3X", "C2S", "B3Z");
        add("C3X", "C3Y", "C2S", "C3V");
        add("C3Y", "C3Z", "C2T", "C3X");
        add("C3Z", "D3V", "C2T", "C3Y");
        add("D3V", "D3X", "D2S", "C3V");
        add("D3X", "D3Y", "D2S", "D3V");
        add("D3Y", "D3Z", "D2T", "D3X");
        add("D3Z", "A3V", "D2T", "D3Y");


        // Fourth ring
        add("A4A", "D4H", "A3V", "A4B");
        add("A4B", "A4A", "A3V", "A4C");
        add("A4C", "A4B", "A3X", "A4D");
        add("A4D", "A4C", "A3X", "A4E");
        add("A4E", "A4D", "A3Y", "A4F");
        add("A4F", "A4E", "A3Y", "A4G");
        add("A4G", "A4F", "A3Z", "A4H");
        add("A4H", "A4G", "A3Z", "B4A");
        add("B4A", "A4H", "B3V", "B4B");
        add("B4B", "B4A", "B3V", "B4C");
        add("B4C", "B4B", "B3X", "B4D");
        add("B4D", "B4C", "B3X", "B4E");
        add("B4E", "B4D", "B3Y", "B4F");
        add("B4F", "B4E", "B3Y", "B4G");
        add("B4G", "B4F", "B3Z", "B4H");
        add("B4H", "B4G", "B3Z", "C4A");
        add("C4A", "B4H", "C3V", "C4B");
        add("C4B", "C4A", "C3V", "C4C");
        add("C4C", "C4B", "C3X", "C4D");
        add("C4D", "C4C", "C3X", "C4E");
        add("C4E", "C4D", "C3Y", "C4F");
        add("C4F", "C4E", "C3Y", "C4G");
        add("C4G", "C4F", "C3Z", "C4H");
        add("C4H", "C4G", "C3Z", "D4A");
        add("D4A", "C4H", "D3V", "D4B");
        add("D4B", "D4A", "D3V", "D4C");
        add("D4C", "D4B", "D3X", "D4D");
        add("D4D", "D4C", "D3X", "D4E");
        add("D4E", "D4D", "D3Y", "D4F");
        add("D4F", "D4E", "D3Y", "D4G");
        add("D4G", "D4F", "D3Z", "D4H");
        add("D4H", "D4G", "D3Z", "A4A");
    }

    idToName(id) {
        // First ring (4 tiles)
        if (id < 4) return GBGCD.sumChar('A', id) + "1" + (id === 0 ? 'M' : id === 1 ? 'O' : id === 2 ? 'N' : 'B');

        // Second ring (8 tiles)
        if (id < 4 + 8) return `${GBGCD.sumChar('A', (id - 4) / 2)}2${id % 2 === 0 ? 'S' : 'T'}`;

        // Third ring (16 tiles)
        if (id < 4 + 8 + 16) return `${GBGCD.sumChar('A', (id - 4 - 8) / 4)}3${id % 4 === 0 ? 'V' : GBGCD.sumChar('W', id % 4)}`;

        // Fourth ring (32 tiles)
        if (id < 4 + 8 + 16 + 32) return `${GBGCD.sumChar('A', (id - 4 - 8 - 16) / 8)}4${GBGCD.sumChar('A', (id - 28) % 8)}`;
    }
}
