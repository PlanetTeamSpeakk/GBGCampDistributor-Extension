// Small script that always runs in the background.
// Only used to listen to messages sent to the extension (and more specifically, this worker),
// which currently only includes the camps saved message used to update the badge.

chrome.runtime.onMessage.addListener(message => {
    if (message.target !== "WORKER") return;

    onMessage(message.type, message.data);
});

function onMessage(type, data) {
    switch (type) {
        case "CAMPS_SAVED":
            let saved = data.saved;
            chrome.tabs.query({active: true, currentWindow: true}).then(tabs => {
                if (!tabs.length) return;

                chrome.action.setBadgeBackgroundColor({color: saved ? "limegreen" : "red"}, () =>
                    chrome.action.setBadgeText({
                        text: `${saved}`,
                        tabId: tabs[0].id
                    }));
            });
            break;
        default:
            console.error("Received unknown message type from extension: " + type);
    }
}
