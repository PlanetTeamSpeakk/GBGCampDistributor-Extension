class WaterfallArchipelagoMap extends GBGMap {
    constructor() {
        super()

        // First ring
        this.provinces["X1X"] = new Province(this, 0, "X1X");

        for (let i = 0; i < 6; i++)
        {
            let quarterId = GBGCD.sumChar('A', i);

            // Second ring
            let name = `${quarterId}2A`;
            this.provinces[name] = new Province(this, i + 1, name);

            // Third ring
            for (let j = 0; j < 2; j++)
            {
                let name = `${quarterId}3${j === 0 ? 'A' : 'B'}`;
                this.provinces[name] = new Province(this, 1 + 6 + i * 2 + j, name);
            }

            // Fourth ring
            for (let j = 0; j < 3; j++)
            {
                let name = `${quarterId}4${GBGCD.sumChar('A', j)}`;
                this.provinces[name] = new Province(this, 1 + 6 + 12 + i * 3 + j, name);
            }

            // Fifth ring
            for (let j = 0; j < 4; j++)
            {
                let name = `${quarterId}5${GBGCD.sumChar('A', j)}`;
                this.provinces[name] = new Province(this, 1 + 6 + 12 + 18 + i * 4 + j, name);
            }
        }

        let add = (province, ...provinces) => {
            for (let neighbour of provinces)
                this.provinces[province].addNeighbor(neighbour);
        }

        // First ring
        add("X1X", "A2A", "B2A", "C2A", "D2A", "E2A", "F2A");


        // Second ring
        for (let i = 0; i < 6; i++) {
            let ch = GBGCD.sumChar('A', i);
            let prevCh = GBGCD.sumChar('A', (i + 5) % 6);

            add(ch + "2A", ch + "3A", ch + "3B", GBGCD.sumChar('A', (i + 1) % 6) + "2A", "X1X",
                 prevCh + "2A", prevCh + "3B");
        }


        // Third ring
        add("A3A", "A4A", "A4B", "A3B", "A2A", "F3B", "F4C");
        add("A3B", "A4C", "B3A", "B2A", "A2A", "A3A", "A4B");
        add("B3A", "B4A", "B4B", "B3B", "B2A", "A3B", "A4C");
        add("B3B", "B4C", "C3A", "C2A", "B2A", "B3A", "B4B");
        add("C3A", "C4A", "C4B", "C3B", "C2A", "B3B", "B4C");
        add("C3B", "C4C", "D3A", "D2A", "C2A", "C3A", "C4B");
        add("D3A", "D4A", "D4B", "D3B", "D2A", "C3B", "C4C");
        add("D3B", "D4C", "E3A", "E2A", "D2A", "D3A", "D4B");
        add("E3A", "E4A", "E4B", "E3B", "E2A", "D3B", "D4C");
        add("E3B", "E4C", "F3A", "F2A", "E2A", "E3A", "E4B");
        add("F3A", "F4A", "F4B", "F3B", "F2A", "E3B", "E4C");
        add("F3B", "F4C", "A3A", "A2A", "F2A", "F3A", "F4B");


        // Fourth ring
        add("A4A", "A5A", "A5B", "A4B", "A3A", "F4C", "F5D");
        add("A4B", "A5B", "A5C", "A4C", "A3B", "A3A", "A4A");
        add("A4C", "A5D", "B4A", "B3A", "A3B", "A4B", "A5C");
        add("B4A", "B5A", "B5B", "B4B", "B3A", "A4C", "A5D");
        add("B4B", "B5B", "B5C", "B4C", "B3B", "B3A", "B4A");
        add("B4C", "B5D", "C4A", "C3A", "B3B", "B4B", "B5C");
        add("C4A", "C5A", "C5B", "C4B", "C3A", "B4C", "B5D");
        add("C4B", "C5B", "C5C", "C4C", "C3B", "C3A", "C4A");
        add("C4C", "C5D", "D5A", "D4A", "D3A", "C3B", "C4B");
        add("D4A", "D5A", "D5B", "D4B", "D3A", "C4C", "C5D");
        add("D4B", "D5C", "D4C", "D3B", "D3A", "D4A", "D5B");
        add("D4C", "D5D", "E4A", "E3A", "D3B", "D4B", "D5C");
        add("E4A", "E5A", "E5B", "E4B", "E3A", "D4C", "D5D");
        add("E4B", "E5C", "E4C", "E3B", "E3A", "E4A", "E5B");
        add("E4C", "E5D", "F4A", "F3A", "E3B", "E4B", "E5C");
        add("F4A", "F5A", "F5B", "F4B", "F3A", "E4C", "E5D");
        add("F4B", "F5C", "F4C", "F3B", "F3A", "F4A", "F5B");
        add("F4C", "F5D", "A4A", "A3A", "F3B", "F4B", "F5C");

        // Fifth ring
        add("A5A", "F5D", "A4A", "A5B");
        add("A5B", "A5A", "A4A", "A4B", "A5C");
        add("A5C", "A5B", "A4B", "A4C", "A5D");
        add("A5D", "A5C", "A4C", "B4A", "B5A");
        add("B5A", "A5D", "B4A", "B5B");
        add("B5B", "B5A", "B4A", "B4B", "B5C");
        add("B5C", "B5B", "B4B", "B4C", "B5D");
        add("B5D", "B5C", "B4C", "C4A", "C5A");
        add("C5A", "B5D", "C4A", "C5B");
        add("C5B", "C5A", "C4A", "C4B", "C5C");
        add("C5C", "C5B", "C4B", "C4C", "C5D");
        add("C5D", "C5C", "C4C", "D4A", "D5A");
        add("D5A", "C5D", "D4A", "D5B");
        add("D5B", "D5A", "D4A", "D4B", "D5C");
        add("D5C", "D5B", "D4B", "D4C", "D5D");
        add("D5D", "D5C", "D4C", "E4A", "E5A");
        add("E5A", "D5D", "E4A", "E5B");
        add("E5B", "E5A", "E4A", "E4B", "E5C");
        add("E5C", "E5B", "E4B", "E4C", "E5D");
        add("E5D", "E5C", "E4C", "F4A", "F5A");
        add("F5A", "E5D", "F4A", "F5B");
        add("F5B", "F5A", "F4A", "F4B", "F5C");
        add("F5C", "F5B", "F4B", "F4C", "F5D");
        add("F5D", "F5C", "F4C", "A4A", "A5A");
    }

    idToName(id) {
        // First ring (1 tile)
        if (id < 1) return "X1X";

        // Second ring (6 tiles)
        if (id < 1 + 6) return `${GBGCD.sumChar('A', id - 1)}2A`;

        // Third ring (12 tiles)
        if (id < 1 + 6 + 12) return `${GBGCD.sumChar('A', (id - 1 - 6) / 2)}3${id % 2 === 1 ? 'A' : 'B'}`;

        // Fourth ring (18 tiles)
        if (id < 1 + 6 + 12 + 18) return `${GBGCD.sumChar('A', (id - 1 - 6 - 12) / 3)}4${GBGCD.sumChar('A', (id - 1) % 3)}`;

        // Fifth ring (24 tiles)
        if (id < 1 + 6 + 12 + 18 + 24) return `${GBGCD.sumChar('A', (id - 1 - 6 - 12 - 18) / 4)}5${GBGCD.sumChar('A', (id - 1) % 4)}`;
    }
}
