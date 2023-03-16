const GBGCD = (function () {   // Detach from global scope
    let campTarget = 4;

    // Server time
    FoEproxy.addHandler("TimeService", "updateTime", data => GBGCD.time = data.responseData.time);

    // Battleground
    FoEproxy.addHandler("GuildBattlegroundService", "getBattleground", data => {
        if (!GBGCD.guild) return; // Ensure we have our guild.
        let wasRed = !GBGCD.map;

        GBGCD.map = parseBattlegrounds(data.responseData);
        GBGCD.postInjectorMessage({
            target: "POPUP", // If no popup is open, this message will be ignored.
            type: "MAP_LOADED",
            data: {
                map: GBGCD.map ? GBGCD.map.stringify() : undefined,
                builtCamps: GBGCD.builtCamps
            }
        });

        if (wasRed && GBGCD.map) GBGCDWindow.enableToolBtn();
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

        if (GBGCD.builtCamps[province] === built) return;
        GBGCD.builtCamps[province] = built;

        if (!GBGCD.map) return;

        distributeCamps(GBGCD.map, campTarget);
        sendMapUpdate();
    });

    // Province ownership changes (province conquered/lost)
    FoEproxy.addWsHandler("GuildBattlegroundService", "getAction", data => {
        if (!GBGCD.map) return;

        let action = data.responseData.action;
        let provinceId = data.responseData.provinceId || 0;

        if (action === "building_placed" && data.responseData.buildingId === "siege_camp") {
            if (!GBGCD.builtCamps[provinceId]) GBGCD.builtCamps[provinceId] = 0;
            GBGCD.builtCamps[provinceId]++;

            distributeCamps(GBGCD.map, campTarget);
            sendMapUpdate();
            return;
        }

        // Ignore actions other than province conquered or lost
        if (action !== "province_conquered" && action !== "province_lost") return;

        GBGCD.map.provinces[GBGCD.map.idToName(provinceId)].ours = action === "province_conquered";

        distributeCamps(GBGCD.map, campTarget);
        sendMapUpdate();
    });

    // Process messages received by the extension.
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
            case "ID":
                GBGCD.extId = data;

                // Add window css
                $("head").append(`<link rel='stylesheet' type='text/css' href='chrome-extension://${data}/css/web/window.css'/>`);
                return;
            case "REQUEST_GUILD":
                return GBGCD.guild;
            case "CLEAR_BUILT_CAMPS":
                GBGCD.builtCamps = {};
            case "PROCESS_MAP":
                if ((!data.initial || data.campTarget !== campTarget) && GBGCD.map) {
                    campTarget = data.campTarget;
                    distributeCamps(GBGCD.map, campTarget); // Redistribute camps when the extension asks to recalculate.
                }
                return {
                    map: GBGCD.map ? GBGCD.map.stringify() : undefined,
                    builtCamps: GBGCD.builtCamps
                };
            default:
                console.error("[GBGCD] Received unknown message type from extension: " + type);
                break;
        }
    }

    function sendMapUpdate() {
        GBGCD.postInjectorMessage({
            target: "POPUP", // If no popup is open, this message will be ignored.
            type: "MAP_UPDATED",
            data: {
                map: GBGCD.map ? GBGCD.map.stringify() : undefined,
                builtCamps: GBGCD.builtCamps
            }
        });
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

        updateBadge(map);
    }

    /**
     * Updates the badge info after camps have been distributed.
     * @param map {GBGMap} The map the camps have been distributed on
     */
    function updateBadge(map) {
        let saved = Object.values(map.provinces) // Calculate the amount of camps we've saved.
            .filter(prov => prov.ours && prov.slotCount > 0)
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
         * An object mapping province ids to camps built on that province.
         * A province is only contained in this object if the amount of camps
         * built there is known. I.e. the user has visited the Buildings menu
         * of the province.
         * @type {{int: int}}
         */
        static builtCamps;

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

dispatchEvent(new Event("gbgcd#mainloaded"));
