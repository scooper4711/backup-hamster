// Background script for Backup Hamster extension

// Listen for installation
chrome.runtime.onInstalled.addListener(function() {
    console.log("Backup Hamster installed!");
    
    // Initialize storage if needed
    chrome.storage.local.get(['downloadHistory'], function(result) {
        if (!result.downloadHistory) {
            chrome.storage.local.set({downloadHistory: {}});
        }
    });
});

// Add icon badge when on Paizo assets page
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url.includes('paizo.com/paizo/account/assets')) {
        chrome.action.setBadgeText({ text: "ON", tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: "#4CAF50", tabId: tabId });
    } else {
        chrome.action.setBadgeText({ text: "", tabId: tabId });
    }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "downloadComplete") {
        // Could be used to track downloads or show notifications
        console.log(`Download completed for: ${request.fileTitle}`);
    }
    return true;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'downloadFiles') {
        // Logic to initiate file download
        downloadFiles(request.files);
        sendResponse({ status: 'Downloading files...' });
    }
});

function downloadFiles(files) {
    files.forEach(file => {
        chrome.downloads.download({
            url: file.url,
            filename: file.name,
            saveAs: false
        });
    });
}
