// This file contains the JavaScript for the popup, handling user interactions and displaying information.

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "updateStatus") {
        document.getElementById('status-message').textContent = request.message;
    } else if (request.action === "filterResult") {
        const filterStatus = document.getElementById('filter-status');
        filterStatus.textContent = `Showing ${request.visibleCount} files matching filter`;
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const filterInput = document.getElementById('file-filter');
    const filterStatus = document.getElementById('filter-status');
    const downloadButton = document.getElementById('download-button');
    const statusMessage = document.getElementById('status-message');

    // Initially disable the download button
    downloadButton.disabled = true;

    // Debounce function to prevent too many filter calls while typing
    let debounceTimer;
    const debounce = (callback, time) => {
        window.clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(callback, time);
    };

    filterInput.addEventListener('input', function() {
        const filterValue = filterInput.value.trim();

        if (filterValue.length >= 3) {
            filterStatus.textContent = `Filtering for: "${filterValue}"...`;
            filterStatus.classList.remove('filter-inactive');
            filterStatus.classList.add('filter-active');
            downloadButton.disabled = false;

            // Debounce the filter to avoid too many calls while typing
            debounce(() => {
                // Send the filter to content script as user types
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "filterFiles", 
                        filter: filterValue
                    }, function(response) {
                        if (response && response.visibleCount !== undefined) {
                            filterStatus.textContent = `Showing ${response.visibleCount} files matching "${filterValue}"`;
                        }
                    });
                });
            }, 300); // Wait 300ms after typing stops
        } else {
            filterStatus.textContent = `Please enter at least 3 characters (${filterValue.length}/3)`;
            filterStatus.classList.remove('filter-active');
            filterStatus.classList.add('filter-inactive');
            downloadButton.disabled = true;
            
            // Reset any filtering when characters are removed
            if (filterValue.length === 0) {
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "filterFiles",
                        filter: "" // Empty filter resets all files to visible
                    });
                });
            }
        }
    });

    downloadButton.addEventListener('click', function() {
        const filterValue = filterInput.value.trim();
        if (filterValue.length >= 3) {
            // Send the filter value to your content script
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "startDownload",
                    filter: filterValue
                });
            });
            // Update UI to show download is starting
            statusMessage.textContent = 'Starting download process...';
            initiateDownload(filterValue);
        }
    });
});

// Updated to accept filter parameter
function initiateDownload(filter) {
    const statusMessage = document.getElementById('status-message');
    
    // Step 1: Find files to download
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        statusMessage.textContent = 'Scanning for files to download...';
        
        chrome.tabs.sendMessage(tabs[0].id, {
            action: "findDownloadableFiles",
            filter: filter // Pass the filter to find only matching files
        }, function(response) {
            if (!response || !response.files || response.files.length === 0) {
                statusMessage.textContent = 'No files found to download.';
                return;
            }
            
            let files = response.files;
            // Only process the first 10 files where lastDownloaded == never to avoid overwhelming the server
            files = files.filter(file => file.lastDownloaded === 'never').slice(0, 10);
            statusMessage.textContent = `Found ${files.length} files to download.`;

            // Step 2: Initialize personalization for all files
            setTimeout(() => {
                statusMessage.textContent = `Initializing personalization for ${files.length} files...`;
                chrome.tabs.sendMessage(tabs[0].id, {action: "initializePersonalization", files: files, statusMessage: statusMessage}, 
                function(response) {
                    // Wait 61 seconds for personalization to complete
                    statusMessage.textContent = `Waiting 61 seconds for personalization to complete...`;
                    
                    // Step 3: Set all files to ready state
                    setTimeout(() => {
                        statusMessage.textContent = 'Setting files to ready state...';
                        chrome.tabs.sendMessage(tabs[0].id, {action: "setFilesToReady", files: files}, 
                        function(response) {
                            // Step 4: Download all files
                            setTimeout(() => {
                                statusMessage.textContent = 'Triggering downloads for all files...';
                                chrome.tabs.sendMessage(tabs[0].id, {action: "downloadAllFiles", files: files}, 
                                function(response) {
                                    statusMessage.textContent = `Download process completed for ${files.length} files!`;
                                    
                                    // Store download info in storage
                                    saveDownloadHistory(files);
                                });
                            }, 1000); // Small delay before final click
                        });
                    }, 61000); // 61 seconds wait after personalization
                });
            }, 1000); // Small delay before starting personalization
        });
    });
}

function saveDownloadHistory(files) {
    // Store download timestamps for future reference
    chrome.storage.local.get(['downloadHistory'], function(result) {
        const history = result.downloadHistory || {};
        
        files.forEach(file => {
            history[file.id] = {
                title: file.title,
                lastDownloaded: new Date().toISOString()
            };
        });
        
        chrome.storage.local.set({downloadHistory: history});
    });
}
