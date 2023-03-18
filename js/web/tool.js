/*
This script manages the FOE Helper tool. This handles injecting the tool into the menu
and displaying and requesting the data.
*/

class GBGCDWindow {
    static settings = {};

    /**
     * Shows this window. Hides the existing one instead if there is already one open.
     */
    static show() {
        // If the window is currently open, close it.
        if ($('#gbgcd').length > 0)
        {
            HTML.CloseOpenBox('gbgcd');
            return;
        }

        HTML.Box({
            id: 'gbgcd',
            title: "GBG Camp Distributor",
            auto_close: true,
            dragdrop: true,
            minimize: true,
            settings: 'GBGCDWindow.showSettings()'
        });

        $("#gbgcdBody")
            .append($(`<table class="foe-table">
                                <thead>
                                    <tr>
                                        <th>Province</th>
                                        <th>Camps</th>
                                        <th>Province</th>
                                        <th>Camps</th>
                                    </tr>
                                </thead>
                                <tbody id="gbgcd__provinces">
                                    <tr>
                                        <td colspan="4"><strong class="no-provinces text-center">No provinces to show here</strong></td>
                                    </tr>
                                </tbody>
                            </table>`))
            .append($(`<div class="dark-bg" style="padding: 5px">
                                <table style="width: 100%">
                                    <tbody>
                                        <tr>
                                            <td>Left to build: <strong id="left-to-build">0</strong></td>
                                            <td>Total saved: <strong id="total-saved" class="success">0</strong></td>
                                        </tr>
                                        <tr>
                                            <td>Overshot: <strong id="overshot">0</strong></td>
                                            <td>Undershot: <strong id="undershot">0</strong></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>`));
        this.updateData();
    }

    static updateData() {
        if (!GBGCD.map) return;

        let table = $("#gbgcd__provinces");
        let boxOpen = table.length > 0;

        table.empty(); // Ensure it's empty when we start.

        let row;
        let count = 0;
        let leftToBuild = 0;
        let totalSaved = 0;
        for (let province of Object.values(GBGCD.map.provinces)) {
            // Ignore provinces that aren't ours or that don't have to be filled.
            if (!province.ours || province.slotCount === 0) continue;

            totalSaved += province.slotCount - province.desiredCount;
            if (!this.settings.showFilled && province.id in GBGCD.builtCamps &&
                GBGCD.builtCamps[province.id] >= province.desiredCount) continue;
            leftToBuild += province.id in GBGCD.builtCamps ? Math.max(0, province.desiredCount -  GBGCD.builtCamps[province.id]) : province.desiredCount;

            // If the window is not open, ignore the rows.
            // We're only really interested in the total amount of
            // camps saved in this case.
            if (!boxOpen) continue;

            if (count % 2 === 0) {
                // Create a new row.
                if (row) table.append(row);
                row = $("<tr>");
            }

            let campsColumn = $("<td>")
                .append($("<span>")
                    .addClass(province.desiredCount < province.slotCount ? "saved" : "")
                    .text(`${province.desiredCount}/${province.slotCount}`));

            if (province.id in GBGCD.builtCamps) {
                let built = GBGCD.builtCamps[province.id];
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

        $("#gbgcd-count")
            .text(`${totalSaved}`)
            .css({display: 'initial'});

        if (!boxOpen) return; // Rest is all box-related

        // If we did not find any provinces to display,
        // display a message we didn't find any instead.
        if (!count) table
            .append($("<tr>")
                .append($(`<td class="text-center" colspan="4">`)
                    .append(`<span class="no-provinces">No provinces to show here</span>`)));
        else {
            if (count % 2 === 1)
                // Add two empty cells
                row.append($("<td>")).append($("<td>"));

            table.append(row);
        }

        // Set total saved and left to build
        $("#total-saved").text(`${totalSaved}`);
        $("#left-to-build").text(`${leftToBuild}`);

        // Map every province to the amount of camps it has according to our distribution.
        let campCounts = Object.values(GBGCD.map.provinces)
            .filter(p => !p.isSpawnSpot && !p.ours)
            .map(p => ({p: p, c: Array.from(p.neighbors)
                    .map(p0 => p0.desiredCount)
                    .reduce((total, current) => total + current, 0)}));

        /**
         * Updates the over- or undershots
         * @param type {string} Either 'overshot' or 'undershot'
         * @param shots {[]} The actual overshots or undershots.
         */
        function updateShots(type, shots) {
            $(`#${type}`)
                .text(`${shots.length}`)
                .parent().attr("title", GBGCDWindow.joinNicely(shots.map(p => `${p.p.name} (${p.c})`)));
        }

        let undershot = campCounts.filter(p => p.c < this.settings.campTarget);
        updateShots("undershot", undershot);

        let overshot = campCounts.filter(p => p.c > this.settings.campTarget);
        updateShots("overshot", overshot);
    }

    /**
     * Hides the red border of the tool button in the menu.
     */
    static enableToolBtn() {
        $("#gbgcd-Btn").removeClass("hud-btn-red");
        $("#gbgcd-Btn-closed").remove();
    }

    static showSettings() {
        // let campTarget = Settings.GetSetting('GBGCD_CampTarget');

        let settingsBox = $('#gbgcdSettingsBox');
        settingsBox.empty();
        settingsBox
            .append($("<p>")
                .append($(`<input id="show-filled" class="form-check-input" type="checkbox">`)
                    .prop("checked", this.settings.showFilled))
                .append($(`
                  <label class="form-check-label" for="show-filled" 
                    title="Whether to show provinces that already have the desired amount of camps built.">
                    Show filled
                  </label>
                `)))

            // Camp target
            .append($(`<p>`)
                .append($(`<input id="camp-target" type="number" name="Camp Target" min="1" max="5">`)
                    .prop("value", this.settings.campTarget))
                .append($(`<label for="camp-target"
                title="The amount of camps each opposing province should be supported by. 4 by default.">Camp target</label>`)))

            // Save button
            .append($("<p>")
                .append($("<button class='btn btn-default' style='width: 100%'>")
                    .on("click", this.saveSettings)
                    .text(i18n('Boxes.Settings.Save'))));

        this.updateData();
    }

    static saveSettings() {
        GBGCDWindow.settings.showFilled = $("#show-filled").is(":checked");
        GBGCDWindow.settings.campTarget = parseInt($("#camp-target").val() ?? "4");

        localStorage.setItem("gbgcdSettings", JSON.stringify(GBGCDWindow.settings));
    }

    /**
     * Joins an array into a string of the form '..., ..., ... and ...'.
     * @param a {[]}
     * @return {string} The resulting string
     */
    static joinNicely(a) {
        let s = "";
        for (let i = 0; i < a.length; i++)
            s += a[i] + (i === a.length - 2 ? " and " : i === a.length - 1 ? "" : ", ");

        return s;
    }
}

// Load settings or set defaults if no saved settings are found.
(function() {
    let settings = localStorage.getItem("gbgcdSettings");

    if (!settings) {
        // No settings present, use default values.
        GBGCDWindow.settings = {showFilled: true, campTarget: 4};
        return;
    }

    GBGCDWindow.settings = JSON.parse(settings);
})();

// Set icon for the tool when the menu loads.
addEventListener("foe-helper#menu_loaded", () => $("#gbgcd-Btn span").first()
    .css("background-image", `url(chrome-extension://${GBGCD.extId}/imgs/48-siege_camp.png)`));

// Add the tool to the menu.
addEventListener("foe-helper#loaded", function() {
    _menu.Items.push("gbgcd");
    _menu.gbgcd_Btn = () => {
        let btn = _menu.MakeButton("gbgcd", "GBG Camp Distributor",
            "<em id='gbgcd-Btn-closed' class='tooltip-error'>Disabled: Visit the GBG map first!<br/></em>" +
            "Distribute camps across the map without wasting resources.", true);

        let btn_sp = $('<span />').on('click', function () {
            if (GBGCD.map) GBGCDWindow.show();
        });

        return btn.append(btn_sp, $('<span id="gbgcd-count" class="hud-counter" style="display: none">0</span>'));
    };
});
