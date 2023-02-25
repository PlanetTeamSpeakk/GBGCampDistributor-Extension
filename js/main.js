const isPopup = window.location.search === "?popup";
const campTarget = 4; // Might end up making this an option, who knows?

$(() => {
    if (isPopup) $("html, body").css({margin: 0});

    $('[data-toggle="tooltip"]').tooltip(); // Initialize all tooltips
    $("#redistribute-btn").on("click", () => updateData(false));

    let popoutBtn = $("#pop-out-btn");
    if (isPopup) popoutBtn.css({display: "none"})
    else popoutBtn.on("click", () => {
        window.open(chrome.runtime.getURL("index.html?popup"),
            "_blank", "popup,width=400,height=620");
        window.close();
    })
});

function sizeToFit() {
    let content = document.getElementById("content");
    let width = content.offsetWidth + 50;
    let height = content.offsetHeight + 60;
    window.resizeTo(width, height);
}

function sendFoEMessage(type, data, callback) {
    // Get the currently active tab and send our message to it.
    chrome.tabs.query({active: true}).then(tabs => tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {target: "INJECTOR", type: type, data: data}, callback);
    }));
}

function updateData(initial) {
    sendFoEMessage("PROCESS_MAP", {initial: initial, campTarget: campTarget}, mapString => {
        if (!mapString) return; // Empty response

        /**
         * @type {{provinces: [{name: string, id: int, neighborNames: [string], ours: boolean, slotCount: number, desiredCount: number, isSpawnSpot: boolean}]}}
         */
        let map = JSON.parse(mapString);

        let table = $("#provinces");
        table.empty(); // Ensure it's empty when we start.

        let row;
        let count = 0;
        for (let province of Object.values(map.provinces)) {
            // Ignore provinces that aren't ours or that don't have to be filled.
            if (!province.ours || province.slotCount === 0) continue;

            if (count % 2 === 0) {
                // Create a new row.
                if (row) table.append(row);
                row = $("<tr>");
            }

            row
                .append($("<td>")
                    .text(province.name))
                .append($("<td>")
                    .append($("<span>")
                        .addClass(province.desiredCount < province.slotCount ? "saved" : "")
                        .text(`${province.desiredCount}/${province.slotCount}`)));
            count++;
        }

        if (count % 2 === 1)
            // Add two empty cells
            row.append($("<td>"))
                .append($("<td>"))

        table.append(row);

        // Map every province to the amount of camps it has according to our distribution.
        let campCounts = Object.values(map.provinces)
            .filter(p => !p.isSpawnSpot && !p.ours)
            .map(p => ({p: p, c: p.neighborNames
                    .map(n => map.provinces[n].desiredCount)
                    .reduce((total, current) => total + current, 0)}));

        /**
         * Updates the over- or undershots
         * @param type {string} Either 'overshot' or 'undershot'
         * @param shots {[]} The actual overshots or undershots.
         */
        function updateShots(type, shots) {
            $(`#${type}`).text(`${shots.length}`);

            bootstrap.Tooltip.getInstance(`#${type}-container`)
                .setContent({".tooltip-inner": joinNicely(shots.map(p => `${p.p.name} (${p.c})`))}); // Update tooltip
        }

        let undershot = campCounts.filter(p => p.c < campTarget);
        updateShots("undershot", undershot);

        let overshot = campCounts.filter(p => p.c > campTarget);
        updateShots("overshot", overshot);

        sizeToFit();
    });
}
updateData(true);

/**
 * Joins an array into a string of the form '..., ..., ... and ...'.
 * @param a {[]}
 * @return {string} The resulting string
 */
function joinNicely(a) {
    let s = "";
    for (let i = 0; i < a.length; i++)
        s += a[i] + (i === a.length - 2 ? " and " : i === a.length - 1 ? "" : ", ");

    return s;
}
