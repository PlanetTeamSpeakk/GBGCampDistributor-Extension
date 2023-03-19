const GBGCD = (function () {   // Detach from global scope
    // Server time
    FoEproxy.addHandler("TimeService", "updateTime", data => GBGCD.time = data.responseData.time);

    // Battleground
    FoEproxy.addHandler("GuildBattlegroundService", "getBattleground", data => {
        if (!GBGCD.guild) return; // Ensure we have our guild.

        GBGCD.map = parseBattlegrounds(data.responseData);

        if (GBGCD.map) GBGCDWindow.enableToolBtn();
        GBGCDWindow.updateData();
    });

    // Guild data
    FoEproxy.addHandler("StartupService", "getData", data => {
        let userData = data["responseData"]["user_data"];
        GBGCD.guild = {
            name: userData["clan_name"],
            id: userData["clan_id"]
        };
    });

    // Built camps storage
    FoEproxy.addHandler("GuildBattlegroundBuildingService", "getBuildings", data => {
        let province = data.responseData.provinceId || 0;
        let pName = GBGCD.map.idToName(province);
        if (!GBGCD.map.provinces[pName].ours) return;

        let built = data.responseData.placedBuildings
            .filter(building => building.id === "siege_camp")
            .length;

        if (GBGCD.builtCamps[province] === built) return;
        GBGCD.builtCamps[province] = built;

        if (!GBGCD.map) return;

        // Redistribute the camps if this tile already has more camps
        // than we bargained for.
        if (built > GBGCD.map.provinces[pName].desiredCount)
            GBGCD.redistribute();

        GBGCDWindow.updateData();

        // Auto-open window if the user goes to the buildings tab.
        if (!$("#gbgcd").length)
            GBGCDWindow.show(true);
    });

    // Province ownership changes (province conquered/lost)
    FoEproxy.addWsHandler("GuildBattlegroundService", "getAction", data => {
        if (!GBGCD.map) return;

        let action = data.responseData.action;
        let provinceId = data.responseData.provinceId || 0;

        if (action === "building_placed" && data.responseData.buildingId === "siege_camp") {
            if (!GBGCD.builtCamps[provinceId]) GBGCD.builtCamps[provinceId] = 0;
            GBGCD.builtCamps[provinceId]++;

            // If the amount of built camps has exceeded the desired amount, see if we can redistribute them.
            // Otherwise, keep the current distribution. This prevents the desired camps being shuffled
            // around while building the camps this extension suggests.
            if (GBGCD.map.provinces[GBGCD.map.idToName(provinceId)].desiredCount < GBGCD.builtCamps[provinceId])
                distributeCamps(GBGCD.map, GBGCDWindow.settings.campTarget);

            GBGCDWindow.updateData();
            return;
        }

        // Ignore actions other than province conquered or lost
        if (action !== "province_conquered" && action !== "province_lost") return;

        GBGCD.map.provinces[GBGCD.map.idToName(provinceId)].ours = action === "province_conquered";

        distributeCamps(GBGCD.map, GBGCDWindow.settings.campTarget);
        GBGCDWindow.updateData();
    });

    // Process messages received by the extension.
    addEventListener("message", event => {
        if (event.data.target !== "FOE") return; // Ignore messages sent by us.

        onMessage(event.data.type, event.data.data);
    });

    /**
     * Used to process messages.
     * @param type {string} The type of the message
     * @param data {object} The data associated with the message
     */
    function onMessage(type, data) {
        // noinspection FallThroughInSwitchStatementJS // This is intended
        switch (type) {
            case "ID":
                GBGCD.extId = data;

                // Add window css
                $("head").append(`<link rel='stylesheet' type='text/css' href='chrome-extension://${data}/css/window.css'/>`);
                return;
            default:
                console.error("[GBGCD] Received unknown message type from extension: " + type);
                break;
        }
    }

    // Define shuffle method for arrays.
    Object.defineProperty(Array.prototype, "shuffle", {
        value: function () {
            return this
                .map(v => ({v: v, r: Math.random()}))
                .sort((v1, v2) => v1.r - v2.r)
                .map(({v}) => v);
        }
    });

    /**
     * Parses the battleground from a request and distributes camps.
     * @param resp {{string: any}}
     */
    function parseBattlegrounds(resp) {
        // Acquire our guild's participant id.
        let pid;
        for (let participant of resp.battlegroundParticipants)
            if (participant.clan.id === GBGCD.guild.id) {
                pid = participant.participantId;
                break;
            }

        if (!pid) return;

        let mapData = resp.map;
        let map;
        switch (mapData.id) {
            case "volcano_archipelago":
                map = new VolcanoArchipelagoMap();
                break;
            case "waterfall_archipelago":
                map = new WaterfallArchipelagoMap();
                break;
            default:
                console.warn("Unsupported map! " + mapData.id);
                return;
        }

        for (let province of mapData.provinces) {
            let id = province.id || 0; // First province is missing id key;
            let name = map.idToName(id);

            let isSpawnSpot = "isSpawnSpot" in province && province.isSpawnSpot;
            map.provinces[name].init(isSpawnSpot ? 0 : // Spawn spots have no camps
                province["totalBuildingSlots"] || 0, province["ownerId"] === pid, isSpawnSpot);
        }

        // Distribute camps if this is the first time the map is loaded.
        distributeCamps(map, GBGCDWindow.settings.campTarget);
        return map;
    }

    /**
     * Distributes camps across the entire map ensuring that every
     * opposing province has at least the given amount of camps
     * surrounding it if possible.
     * @param map {GBGMap} The map to distribute camps on
     * @param campTarget {number} The amount of camps each province
     * should be supported by.
     */
    function distributeCamps(map, campTarget) {
        for (let p of Object.values(map.provinces))
            p.desiredCount = GBGCD.builtCamps[p.id] || 0; // Reset map first

        for (let p of Object.values(map.provinces).shuffle()) {
            if (p.ours || p.isSpawnSpot) continue; // Don't take provinces we can't hit into account.

            let ours = Array.from(p.neighbors).filter(n => n.ours); // Neighboring provinces that are ours
            let totalCC = ours // The total amount of slots this province's neighbors have.
                .map(n => n.slotCount)
                .reduce((i1, i2) => i1 + i2, 0);

            // We cannot achieve the desired amount of camps.
            // Simply give each neighboring province the maximum amount of camps it can hold.
            if (totalCC <= campTarget) {
                for (let neighbour of ours)
                    neighbour.desiredCount = neighbour.slotCount;
                continue;
            }

            // Calculate how many camps we need to reach the target of 4.
            // Take the camps we've already placed into account as well.
            let campsLeft = ours
                .map(op => op.desiredCount)
                .reduce((total, current) => total - current, campTarget);

            // Order by desired count ascending, so we add camps to tiles
            // with the least amount of slots filled first.
            ours = ours.sort((p1, p2) => p1.desiredCount < p2.desiredCount ? -1 : p1.desiredCount > p2.desiredCount ? 1 : 0);

            while (campsLeft > 0)
                for (let neighbor of ours) {
                    // If this province can't hold any more camps, continue to the next.
                    if (neighbor.slotCount === neighbor.desiredCount) continue;

                    campsLeft -= 1;
                    neighbor.desiredCount += 1;

                    if (campsLeft === 0) break;
                }
        }
    }

    class GBGCD {
        /**
         * Information on our guild. If not set, the user likely is not in a guild.
         * Contains name and id.
         * @type {{id: number, name: string}}
         */
        static guild;
        /**
         * The last time received from the server. Should be some epoch time.
         * Received pretty often (basically with every json request).
         * @type {number}
         */
        static time;
        /**
         * The parsed map, <code>null</code> until set.
         * @type {?GBGMap}
         */
        static map;
        /**
         * An object mapping province ids to camps built on that province.
         * A province is only contained in this object if the amount of camps
         * built there is known. I.e. the user has visited the Buildings menu
         * of the province.
         * @type {{int: int}}
         */
        static builtCamps = {};

        /**
         * Sums a char and some other variable
         * @param char {string} A string containing a single character
         * @param i {number} The number to add
         * @return The character formed from summing the char code of the given char and the given number.
         */
        static sumChar(char, i) {
            return String.fromCharCode(char.charCodeAt(0) + i);
        }

        /**
         * Redistributes camps on the map with the given camp target.
         * @param campTarget {number} The amount of camps every province should be supported by.
         */
        static redistribute(campTarget = undefined) {
            if (campTarget === undefined) campTarget = GBGCDWindow.settings.campTarget;

            distributeCamps(this.map, campTarget);
            GBGCDWindow.updateData();
        }
    }
    return GBGCD;
})();

dispatchEvent(new Event("gbgcd#mainloaded"));
