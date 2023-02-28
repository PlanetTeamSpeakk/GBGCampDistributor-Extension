const isPopup = window.location.search === "?popup";
const settings = {
    "show-filled": getSetting("show-filled", v => v === "true") ?? true,
    "camp-target": getSetting("camp-target", parseInt) ?? 4
};
const campTarget = 4; // Might end up making this an option, who knows?
let lastResp;

$(() => {
    if (isPopup) $("html, body").css({margin: 0});

    let settingsBtn = $("#settings-btn");
    bootstrap.Popover.getOrCreateInstance(settingsBtn, {html: true}).setContent({
        ".popover-body": createSettingsPage()
    });

    // Ensure tooltips work in the settings popover
    settingsBtn.on("shown.bs.popover", () => $('[data-bs-toggle="tooltip"]').tooltip());

    $('[data-bs-toggle="tooltip"]').tooltip(); // Initialize all tooltips

    $("#redistribute-btn").on("click", () => requestUpdateData(false));
    $("#clear-built-btn").on("click", () =>
        sendFoEMessage("CLEAR_BUILT_CAMPS", {campTarget: campTarget}, updateData));

    let popoutBtn = $("#pop-out-btn");
    if (isPopup) popoutBtn.css({display: "none"})
    else popoutBtn.on("click", () => {
        window.open(chrome.runtime.getURL("index.html?popup"),
            "_blank", "popup,width=400,height=620");
        window.close();
    })
});

chrome.runtime.onMessage.addListener(message => {
    if (message.target !== "POPUP") return;

    switch (message.type) {
        // If a province's owner is changed, the camps are redistributed.
        // We reflect that change here too (if a popup is open while it happens)
        case "PROVINCE_OWNERSHIP_CHANGE":
            updateData(message.data);
            break;
        default:
            console.error("Received invalid message from extension: " + message.type);
    }
});

function createSettingsPage() {
    return $(`<div id="settings-page" class="vstack gap-2 form-check">`)
        .append($(`<div>`)
            .append($(`<input id="show-filled" class="form-check-input" type="checkbox">`)
                .prop("checked", settings["show-filled"])
                .on("change", function () {
                    setSetting("show-filled", this.checked);
                    resetData();
                }))
            .append($(`
              <label class="form-check-label" for="show-filled" data-bs-toggle="tooltip"
                title="Whether to show provinces that already have the desired amount of camps built.">
                Show filled
              </label>
            `)))
        .append($(`<div>`)
            .append($(`<input id="camp-target" class="form-check-input" type="number" name="Camp Target" min="1" max="5"
                value="${settings["camp-target"]}">`)
                .on("change", function () {
                    setSetting("camp-target", this.value);
                    $("#redistribute-btn").click(); // Redistribute camps with new camp target
                }))
            .append($(`<label class="form-check-label align-middle" for="camp-target" data-bs-toggle="tooltip"
                title="The amount of camps each opposing province should be supported by. 4 by default.">Camp target</label>`)));
}

function sizeToFit() {
    let content = document.getElementById("content");
    let width = content.offsetWidth + 50;
    let height = content.offsetHeight + 60;
    window.resizeTo(width, height);
}

/**
 * Acquires the value of a stored setting.
 * @param name {string} The name of the option
 * @param parser {function} The function used to parse the value from a string
 * @return {*|string} Either the result from the given parser, a string, or undefined.
 */
function getSetting(name, parser) {
    let value = localStorage.getItem("gbgcd_" + name);
    if (!value) return value;

    return parser ? parser(value) : value;
}

/**
 * Stores the value of a setting
 * @param name {string} The name of the setting
 * @param value {*} The value of the setting, will be converted to a string.
 */
function setSetting(name, value) {
    settings[name] = value;
    localStorage.setItem("gbgcd_" + name, `${value}`);
}

function sendFoEMessage(type, data, callback) {
    // Get the currently active tab and send our message to it.
    chrome.tabs.query({active: true}).then(tabs => tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {target: "INJECTOR", type: type, data: data}, callback);
    }));
}

function requestUpdateData(initial) {
    sendFoEMessage("PROCESS_MAP", {initial: initial, campTarget: settings["camp-target"]}, updateData);
}
requestUpdateData(true);

const resetData = () => updateData(lastResp);

function updateData(resp) {
    console.log("Resp:", resp);
    if (!resp || !resp.map) {
        // Empty response (no gbgcd script loaded on receiving end) or no map
        // Show no-data modal
        bootstrap.Modal.getOrCreateInstance("#no-data-modal").show();
        return;
    }
    lastResp = resp;

    /**
     * @type {{provinces: [{name: string, id: int, neighborNames: [string], ours: boolean, slotCount: number, desiredCount: number, isSpawnSpot: boolean}]}}
     */
    let map = JSON.parse(resp.map);

    let table = $("#provinces");
    table.empty(); // Ensure it's empty when we start.

    let row;
    let count = 0;
    for (let province of Object.values(map.provinces)) {
        // Ignore provinces that aren't ours or that don't have to be filled.
        if (!province.ours || province.slotCount === 0 || settings["show-filled"] &&
            province.id in resp.builtCamps && resp.builtCamps[province.id] >= province.desiredCount) continue;

        if (count % 2 === 0) {
            // Create a new row.
            if (row) table.append(row);
            row = $("<tr>");
        }

        let campsColumn = $("<td>")
            .append($("<span>")
                .addClass(province.desiredCount < province.slotCount ? "saved" : "")
                .text(`${province.desiredCount}/${province.slotCount}`));

        if (province.id in resp.builtCamps) {
            let built = resp.builtCamps[province.id];
            campsColumn
                .append(" ")
                .append($("<span>")
                    .addClass("built")
                    .attr("data-toggle", "tooltip")
                    .attr("title", `${built} camp${built === 1 ? "" : "s"} already built`)
                    .text(`(${built})`));
        }

        row
            .append($("<td>")
                .text(province.name))
            .append(campsColumn);
        count++;
    }

    if (count % 2 === 1)
        // Add two empty cells
        row.append($("<td>")).append($("<td>"));

    table.append(row);
    $('[data-toggle="tooltip"]').tooltip(); // Update tooltips

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
}

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
