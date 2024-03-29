/*
This script manages the FOE Helper tool. This handles injecting the tool into the menu
and displaying and requesting the data.
*/

class GBGCDWindow {
    /**
     *
     * @type {{showFilled: boolean, campTarget: number, showBadge: boolean, autoOpen: boolean, sortMethod: number}}
     */
    static settings = {showFilled: true, campTarget: 4, showBadge: true, autoOpen: true, sortMethod: 1};

    /**
     * Shows this window. Hides the existing one instead if there is already one open.
     */
    static show(auto = false) {
        if (auto && !this.settings.autoOpen) return;

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
            .append($(`<small class="visit-first">For the best results, visit the buildings menu of each province first.</small>`))
            .append($(`<h4 class="text-center">Camps to build:</h4>`))
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
                                            <td><span>Left to build: <strong id="left-to-build">0</strong></span></td>
                                            <td class="text-right"><span>Total saved: <strong id="total-saved">0</strong></span></td>
                                        </tr>
                                        <tr>
                                            <td><span>Overshot: <strong id="overshot">0</strong></span></td>
                                            <td class="text-right"><span>Undershot: <strong id="undershot">0</strong></span></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>`)
                .append($("<div class='mx-auto h-stack mt-2'>")
                    .append($(`<button class="btn btn-default" title="Redistribute the camps across the board">Redistribute</button>`)
                        .on("click", () => GBGCD.redistribute(this.settings.campTarget)))
                    .append($(`<button class="btn btn-default btn-delete" title="Clear all known built camps">Clear built camps</button>`)
                        .on("click", () => GBGCD.redistribute(this.settings.campTarget)))))
            .parent().css({width: "250px"});
        this.updateData();
    }

    static updateData() {
        if (!GBGCD.map) return;

        let table = $("#gbgcd__provinces");
        let boxOpen = table.length > 0;

        table.empty(); // Ensure it's empty when we start.

        // Create a sort method based on the sort method selected by the user.
        let sm = this.settings.sortMethod;
        let sortMethod = sm === 0 ? (p1, p2) => p1.name.localeCompare(p2.name) :
            sm === 1 ? (p1, p2) => p1.id > p2.id ? 1 : p1.id < p2.id ? -1 : 0 :
                (p1, p2) => {
                    // If the regions of these two provinces are not the same,
                    // use whatever value represents
                    let sortRegion = p1.name.substring(0, 1).localeCompare(p2.name.substring(0, 1));
                    if (sortRegion !== 0) return sortRegion;

                    return p1.id > p2.id ? 1 : p1.id < p2.id ? -1 : 0;
                };

        let row;
        let count = 0;
        let leftToBuild = 0;
        let totalSaved = 0;
        for (let province of Object.values(GBGCD.map.provinces).sort(sortMethod)) {
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
                    .append($(`<span class="built" title="${built} camp${built === 1 ? "" : "s"} already built">(${built})</span>`));
            }

            row
                .append($("<td>")
                    .text(province.name))
                .append(campsColumn);
            count++;
        }

        $("#gbgcd-count")
            .text(`${totalSaved}`)
            .css({display: this.settings.showBadge ? "initial" : "none"});

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
        $("#total-saved")
            .attr("class", totalSaved === 0 ? "" : "saved")
            .text(`${totalSaved}`);
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
        $('#gbgcdSettingsBox')
            .empty()
            // Show badge
            .append($("<p>")
                .append($(`<input id="gbgcd__show-badge" type="checkbox">`)
                    .prop("checked", this.settings.showBadge))
                .append($(`
                  <label for="gbgcd__show-badge" 
                    title="Whether to show the badge that displays the amount of camps saved in the menu.">
                    Show badge
                  </label>
                `)))

            // Auto-open
            .append($("<p>")
                .append($(`<input id="gbgcd__auto-open" type="checkbox">`)
                    .prop("checked", this.settings.autoOpen))
                .append($(`
                  <label for="gbgcd__auto-open" 
                    title="Whether to automatically open this tool when going to the buildings page of any province you own.">
                    Auto-open
                  </label>
                `)))

            // Show filled
            .append($("<p>")
                .append($(`<input id="gbgcd__show-filled" type="checkbox">`)
                    .prop("checked", this.settings.showFilled))
                .append($(`
                  <label for="gbgcd__show-filled" 
                    title="Whether to show provinces that already have the desired amount of camps built.">
                    Show filled
                  </label>
                `)))

            // Camp target
            .append($(`<p>`)
                .append($(`<input id="gbgcd__camp-target" type="number" name="Camp Target" min="1" max="5">`)
                    .prop("value", this.settings.campTarget))
                .append($(`<label for="gbgcd__camp-target"
                title="The amount of camps each opposing province should be supported by. 4 by default.">Camp target</label>`)))

            // Sort mode
            .append($("<p>")
                .append($(`<div class="dropdown">`)
                    .append($(`<input type="checkbox" class="dropdown-checkbox" id="gbgcd__sort-toggle">`)) // Required to toggle the dropdown
                    .append($(`<label class="dropdown-label game-cursor" for="gbgcd__sort-toggle">Sort</label>`))
                    .append($(`<span class="arrow"></span>`)) // Arrow to display dropdown status
                    .append($(`
                        <ul id="gbgcd__sort-dropdown">
                            <li>
                                <label>
                                    <input type="radio" name="sort"/>
                                    By Name
                                </label>
                            </li>
                            <li>
                                <label>
                                    <input type="radio" name="sort"/>
                                    By Ring
                                </label>
                            </li>
                            <li>
                                <label>
                                    <input type="radio" name="sort"/>
                                    By Region
                                </label>
                            </li>
                        </ul>
                    `))))

            // Save button
            .append($("<p>")
                .append($("<button class='btn btn-default' style='width: 100%'>")
                    .on("click", this.saveSettings)
                    .text(i18n('Boxes.Settings.Save'))));

        // Set selected sort method
        $(`#gbgcd__sort-dropdown input:radio[name="sort"]`)
            .eq(this.settings.sortMethod)
            .prop("checked", true);

        this.updateData();
    }

    static saveSettings() {
        let isChecked = id => $("#gbgcd__" + id).is(":checked")

        let s = GBGCDWindow.settings;
        s.showBadge = isChecked("show-badge");
        s.autoOpen = isChecked("auto-open");
        s.showFilled = isChecked("show-filled");
        s.campTarget = parseInt($("#gbgcd__camp-target").val() ?? "4");

        // Save index of selected sort method radiobutton.
        let sortBtns = $(`#gbgcd__sort-dropdown input:radio[name="sort"]`);
        s.sortMethod = sortBtns.index(sortBtns.filter(":checked"));

        localStorage.setItem("gbgcdSettings", JSON.stringify(s));
        GBGCDWindow.updateData();

        $("#gbgcdSettingsBox").remove();
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

    // If settings are stored, load those. Otherwise, use defaults.
    if (!settings) return;

    let old = GBGCDWindow.settings;
    GBGCDWindow.settings = JSON.parse(settings);

    // If any new options were added since last save,
    // load the defaults for those.
    for (let opt in old)
        if (GBGCDWindow.settings[opt] === undefined)
            GBGCDWindow.settings[opt] = old[opt];
})();

// Set icon for the tool when the menu loads.
addEventListener("foe-helper#menu_loaded", () => $("#gbgcd-Btn span").first()
    .css("background-image", `url(chrome-extension://${GBGCD.extId}/imgs/48-siege_camp.png)`));

// Add the tool to the menu.
addEventListener("foe-helper#loaded", function() {
    _menu.Items.push("gbgcd");
    _menu.gbgcd_Btn = () => {
        // If the player does not have the GBG Officer permission in their guild,
        // remove this tool as it's of no use to them.
        if ((ExtGuildPermission & GuildMemberStat.GuildPermission_GBGOfficer) !== GuildMemberStat.GuildPermission_GBGOfficer) {
            delete _menu.Items[_menu.Items.indexOf("gbgcd")];
            return;
        }

        let btn = _menu.MakeButton("gbgcd", "GBG Camp Distributor",
            "<em id='gbgcd-Btn-closed' class='tooltip-error'>Disabled: Visit the GBG map first!<br/></em>" +
            "Distribute camps across the map without wasting resources.", true);

        let btn_sp = $('<span />').on('click', function () {
            if (GBGCD.map) GBGCDWindow.show();
        });

        return btn.append(btn_sp, $('<span id="gbgcd-count" class="hud-counter" style="display: none">0</span>'));
    };
});
