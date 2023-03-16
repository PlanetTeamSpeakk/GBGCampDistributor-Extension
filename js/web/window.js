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
            .append($(`<div class="dark-bg" style="padding: 5px">`)
                .append($("<table style='width: 100%'>")
                    .append($("<tbody>")
                        .append($("<tr>")
                            .append($("<td>")
                                .text("Left to build: ")
                                .append($("<strong id='left-to-build'>0</strong>")))
                            .append($("<td>")
                                .addClass("text-right")
                                .text("Total saved: ")
                                .append($("<strong id='total-saved' class='success'>0</strong>"))))

                        .append($("<tr>")
                            .append($("<td>")
                                .text("Overshot: ")
                                .append($("<strong id='overshot'>0</strong>")))
                            .append($("<td>")
                                .addClass("text-right")
                                .text("Undershot: ")
                                .append($("<strong id='undershot'>0</strong>")))))));
    }

    /**
     * Hides the red border of the tool button in the menu.
     */
    static enableToolBtn() {
        $("#gbgcd-Btn").removeClass("hud-btn-red");
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
    }

    static saveSettings() {
        GBGCDWindow.settings.showFilled = $("#show-filled").is(":checked");
        GBGCDWindow.settings.campTarget = parseInt($("#camp-target").val() ?? "4");

        localStorage.setItem("gbgcdSettings", JSON.stringify(GBGCDWindow.settings));
    }
}

(function() {
    let settings = localStorage.getItem("gbgcdSettings");

    if (!settings) {
        GBGCDWindow.settings = {showFilled: true, campTarget: 4};
        return;
    }

    GBGCDWindow.settings = JSON.parse(settings);
})();

// Set icon for the tool when the menu loads.
addEventListener("foe-helper#menu_loaded", () => $("#gbgcd-Btn span").first()
    .css("background-image", `url(chrome-extension://${GBGCD.extId}/imgs/48-siege_camp.png)`));
