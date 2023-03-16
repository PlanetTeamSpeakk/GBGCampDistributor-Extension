// This script is run in its own environment which denies us access to the outside world.
// To circumvent this, we inject a script directly into the DOM. This script will be able
// to access anything a regular script can.

console.log(`Loading GBG Camp Distributor (${chrome.runtime.id})`);
let msgId = 0;
let replyFunctions = {};

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
    let files = ["gbgcd.js", "window.js", "maps/Province.js", "maps/GBGMap.js", "maps/VolcanoArchipelagoMap.js", "maps/WaterfallArchipelagoMap.js"];
    // Ensure files get loaded in order.
    appendNext(files);
})

chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message.target !== "INJECTOR") return;

    let id = msgId++;
    replyFunctions[id] = msg => {
        delete replyFunctions[id];
        reply(msg);
    }
    postMessage({id: id, source: "INJECTOR", target: "FOE", type: message.type, data: message.data});
    return true; // Keep reply method alive
});

addEventListener("message", event => {
    if (event.data.source === "INJECTOR") return; // Ignore messages sent by this script.

    // When we receive a message from a page script, redirect it to the extension page.
    // If this message is a response, send it back via the stored reply function.
    if ("id" in event.data && event.data.id in replyFunctions)
        replyFunctions[event.data.id](event.data.data);

    // Otherwise send it directly to the extension. It'll be processed by the extension's service worker.
    else chrome.runtime.sendMessage(chrome.runtime.id, event.data);
});
