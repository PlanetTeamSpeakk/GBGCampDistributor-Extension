const GBGCD = (function () {   // Detach from global scope
    let campTarget = 4;
    let builtCamps = {};

    // Server time
    FoEproxy.addHandler("TimeService", "updateTime", data => GBGCD.time = data.responseData.time);

    // Battleground
    FoEproxy.addHandler("GuildBattlegroundService", "getBattleground", data => {
        if (!GBGCD.guild) return; // Ensure we have our guild.

        GBGCD.map = parseBattlegrounds(data.responseData);
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
        let built = data.responseData.placedBuildings
            .filter(building => building.id === "siege_camp")
            .length;

        if (builtCamps[province] === built) return;
        builtCamps[province] = built;

        if (GBGCD.map) distributeCamps(GBGCD.map, campTarget);
    });

    // Province ownership changes (province conquered/lost)
    FoEproxy.addWsHandler("GuildBattlegroundService", "getAction", data => {
        if (!GBGCD.map) return;

        let action = data.responseData.action;
        let provinceId = data.responseData.provinceId || 0;
        GBGCD.map.provinces[GBGCD.map.idToName(provinceId)].ours = action === "province_conquered";

        distributeCamps(GBGCD.map, campTarget);
        GBGCD.postInjectorMessage({
            target: "POPUP", // If no popup is open, this message will be ignored.
            type: "PROVINCE_OWNERSHIP_CHANGE",
            data: {
                map: GBGCD.map ? GBGCD.map.stringify() : undefined,
                builtCamps: builtCamps
            }
        });
    });

    addEventListener("message", event => {
        if (event.data.target !== "FOE") return; // Ignore messages sent by us.

        let resp = onMessage(event.data.type, event.data.data);
        if (!resp) return;

        // Send response
        GBGCD.postInjectorMessage({
            id: event.data.id,
            data: resp
        });
    });

    /**
     * Used to process messages.
     * @param type {string} The type of the message
     * @param data {object} The data associated with the message
     * @return {(undefined|{})} A possible response message, may also return nothing.
     */
    function onMessage(type, data) {
        // noinspection FallThroughInSwitchStatementJS // This is intended
        switch (type) {
            case "REQUEST_GUILD":
                return GBGCD.guild;
            case "CLEAR_BUILT_CAMPS":
                builtCamps = {};
            case "PROCESS_MAP":
                if (!data.initial || data.campTarget !== campTarget) {
                    campTarget = data.campTarget;
                    distributeCamps(GBGCD.map, campTarget); // Redistribute camps when the extension asks to recalculate.
                }
                return {
                    map: GBGCD.map ? GBGCD.map.stringify() : undefined,
                    builtCamps: builtCamps
                };
            default:
                console.error("[GBGCD] Received unknown message type from extension: " + type);
                break;
        }
    }

    // Define shuffle method for arrays.
    Array.prototype.shuffle = function () {
        return this
            .map(v => ({v: v, r: Math.random()}))
            .sort((v1, v2) => v1.r - v2.r)
            .map(({v}) => v);
    };

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

        distributeCamps(map, campTarget);
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
            p.desiredCount = builtCamps[p.id] || 0; // Reset map first

        for (let p of Object.values(map.provinces).shuffle()) {
            if (p.ours || p.isSpawnSpot) continue;

            let ours = Array.from(p.neighbors).filter(n => n.ours);
            let totalCC = ours
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

        updateBadge(map);
    }

    /**
     * Updates the badge info after camps have been distributed.
     */
    function updateBadge(map) {
        let res = Object.values(map.provinces)
            .filter(prov => prov.ours && prov.slotCount > 0)
            .sort((prov1, prov2) => prov1.id < prov2.id ? -1 : prov1.id > prov2.id ? 1 : 0);

        let saved = res
            .map(prov => prov.slotCount - prov.desiredCount)
            .reduce((total, current) => total + current, 0);

        // Set badge info
        GBGCD.postInjectorMessage({
            target: "WORKER",
            type: "CAMPS_SAVED",
            data: {
                saved: saved
            }
        });
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
         * Sums a char and some other variable
         * @param char {string} A string containing a single character
         * @param i {number} The number to add
         * @return The character formed from summing the char code of the given char and the given number.
         */
        static sumChar(char, i) {
            return String.fromCharCode(char.charCodeAt(0) + i);
        }

        /**
         * Posts a message to the window. Usually meant to be received by the injector
         * which can then redirect it to other parts of the extension.
         * @param msg The message to send.
         */
        static postInjectorMessage(msg) {
            msg.source = "FOE";
            postMessage(msg);
        }
    }
    return GBGCD;
})();
