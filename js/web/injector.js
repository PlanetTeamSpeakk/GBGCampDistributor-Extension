// This script is run in its own environment which denies us access to the outside world.
// To circumvent this, we inject a script directly into the DOM. This script will be able
// to access anything a regular script can.

console.log(`Loading GBG Camp Distributor (${chrome.runtime.id})`);
addEventListener("gbgcd#mainloaded", () => postMessage({source: "INJECTOR", target: "FOE", type: "ID", data: chrome.runtime.id}));

addEventListener("load", () => {
    function appendNext(files) {
        let file = files.shift();

        let s = document.createElement("script");
        s.src = chrome.runtime.getURL("js/web/" + file);

        if (files.length) s.onload = () => appendNext(files);

        (document.head || document.documentElement).appendChild(s);
    }

    // Inject our files in the DOM.
    let files = ["gbgcd.js", "tool.js", "maps/Province.js", "maps/GBGMap.js", "maps/VolcanoArchipelagoMap.js", "maps/WaterfallArchipelagoMap.js"];
    // Ensure files get loaded in order.
    appendNext(files);
})
