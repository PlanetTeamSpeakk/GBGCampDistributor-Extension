// This file is the main script of the popup window of the extension.
// It handles communication with the game page and displaying the results.

const isPopup = window.location.search === "?popup";
const settings = {
    "show-filled": getSetting("show-filled", v => v === "true") ?? true,
    "camp-target": getSetting("camp-target", parseInt) ?? 4
};
const campTarget = 4; // Might end up making this an option, who knows?
let lastResp;

// General initialisation of the page.
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
    if (isPopup) {
        popoutBtn.css({display: "none"})
        sizeToFit();
    } else popoutBtn.on("click", () => {
        window.open(chrome.runtime.getURL("index.html?popup"),
            "_blank", "popup,width=400,height=620");
        window.close();
    })
});

// Listen for messages sent to popups.
chrome.runtime.onMessage.addListener(message => {
    if (message.target !== "POPUP") return;

    switch (message.type) {
        // If the map is loaded (that is the user goes to the GBG map in-game)
        // display the data on this popup (if one was open).
        case "MAP_LOADED":
        // If a province's owner is changed, the camps are redistributed.
        // We reflect that change here too (if a popup is open while it happens)
        case "PROVINCE_OWNERSHIP_CHANGE":
            updateData(message.data);
            break;
        default:
            console.error("Received invalid message from extension: " + message.type);
    }
});

/**
 * Creates the settings page shown when the settings button is clicked.
 * Incorporates the current values for each setting.
 * @return {*|jQuery}
 */
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

/**
 * Sizes the window to fit the content.
 * Only used for popped out popups.
 */
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

/**
 * Sends a message to the currently active tab.
 * If no window has an active tab where the injector is loaded (so no FOE tab),
 * the callback is called with no data.
 *
 * For each active tab (so for each active window as every window has 1 active tab),
 * the callback is called once.
 * The extension will likely break if there are two windows with FOE as active tab,
 * but that's a very unlikely situation.
 * @param type {string} The type of the message
 * @param data {{}} The data to send along with it
 * @param callback {function} The function to call when a response is received. Will
 * always be called either with or without data and at least once per message.
 */
function sendFoEMessage(type, data, callback) {
    // Get the currently active tab and send our message to it.
    chrome.tabs.query({active: true}).then(tabs => tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {target: "INJECTOR", type: type, data: data}, callback);
    }));
}

/**
 * Sends a message to any active tab asking for the processed map.
 * If there is an active tab with a processed map, the upddateData function is called.
 * @param initial {boolean} Whether this call is for the initial data. If true, the
 * camps will not be redistributed on the receiving end before replying.
 */
function requestUpdateData(initial) {
    sendFoEMessage("PROCESS_MAP", {initial: initial, campTarget: settings["camp-target"]}, updateData);
}
requestUpdateData(true);


/**
 * The value of the currently scheduled no-data modal display call.
 * May be <code>undefined</code> if there isn't one defined yet.
 * @type {number|undefined}
 */
let scheduledNDM;

/**
 * For the popout feature to work, the requested tab when sending a message must not
 * be just the active window as the active window is likely the popup window.
 * This means that the message may be sent multiple times which means multiple responses
 * will be received (this is practically guaranteed if the window is popped out).
 * This means that although this response may not be the one we're looking for, we
 * might receive the one we are looking for in just a moment.
 * Thus, we schedule the no-data modal to appear in 50 ms and if within that time, we do
 * receive the response we're looking for, we cancel it.
 *
 * Schedules the no-data modal to display within 50 ms. Can be cancelled using scheduledNDM.
 * @see scheduledNDM
 */
function scheduleNoDataModal() {
    if (scheduledNDM) return;
    scheduledNDM = setTimeout(displayNoDataModal, 50);
}

/**
 * Actually displays the no-data modal. Also resets scheduledNDM.
 * @see scheduleNoDataModal
 * @see scheduledNDM
 */
function displayNoDataModal() {
    scheduledNDM = undefined;
    // Show no-data modal
    bootstrap.Modal.getOrCreateInstance("#no-data-modal").show();
}

/**
 * Updates the data using the last received response.
 * Primarily used to apply setting changes without changing
 * the data.
 */
const resetData = () => updateData(lastResp);

/**
 * Updates the data on the page.
 * @param resp {{map: string, builtCamps: {number: number}}} The response received from the tab.
 */
function updateData(resp) {
    if (!resp || !resp.map) {
        // Empty response (no gbgcd script loaded on receiving end or no map)
        scheduleNoDataModal();
        return;
    }

    // Clear scheduled no-data modal display if one was scheduled as we received
    // our data.
    if (scheduledNDM) clearTimeout(scheduledNDM);
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
        if (!province.ours || province.slotCount === 0 || !settings["show-filled"] &&
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

        let tooltip = bootstrap.Tooltip.getInstance(`#${type}-container`);

        // Update tooltip
        if (shots.length) {
            tooltip.enable();
            tooltip.setContent({".tooltip-inner": joinNicely(shots.map(p => `${p.p.name} (${p.c})`))});
        } else tooltip.disable();
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
