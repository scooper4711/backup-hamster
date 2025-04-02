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

    // On popup load, restore last filter
    chrome.storage.local.get(['lastFilter'], function(result) {
        if (result.lastFilter) {
            filterInput.value = result.lastFilter;
            // Trigger the filter
            filterInput.dispatchEvent(new Event('input'));
        }
    });

    filterInput.addEventListener('input', function() {
        const filterValue = filterInput.value.trim();
        chrome.storage.local.set({lastFilter: filterValue});

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
        const delaySeconds = parseInt(document.getElementById('delay-seconds').value, 10) || 5;
        
        if (filterValue.length >= 3) {
            // Update UI to show download is starting
            statusMessage.textContent = 'Starting download process...';
            
            // Call initiateDownload with both filter and delay parameters
            initiateDownload(filterValue, delaySeconds);
        }
    });
});

// Updated to accept both filter and delaySeconds parameters
function initiateDownload(filter, delaySeconds = 5) {
    // Start the download process with step 1
    findFiles(filter, delaySeconds);
}

// Step 1: Find files to download
function findFiles(filter, delaySeconds) {
    updateStatus('Scanning for files to download...');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            action: "findDownloadableFiles",
            filter: filter
        }, function(response) {
            if (!response || !response.files || response.files.length === 0) {
                updateStatus('No files found to download.');
                return;
            }
            
            const files = response.files;
            updateStatus(`Found ${files.length} files to download.`);
            
            // Move to step 2 after a brief delay
            setTimeout(() => {
                startPersonalization(files, delaySeconds);
            }, 1000);
        });
    });
}

// Step 2: Initialize personalization for all files
function startPersonalization(files, delaySeconds) {
    updateStatus(`Initializing personalization for ${files.length} files...`);
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            action: "initializePersonalization", 
            files: files,
            delaySeconds: delaySeconds
        }, function() {
            // Calculate wait time based on the number of files and delay
            const waitTime = files.length * delaySeconds * 1000; // Convert seconds to milliseconds
            updateStatus(`Waiting ${Math.round(waitTime/1000)} seconds for personalization to complete...`);
            
            // Move to step 3 after personalization should be complete
            setTimeout(() => {
                setToReady(files, delaySeconds);
            }, waitTime);
        });
    });
}

// Step 3: Set all files to ready state
function setToReady(files, delaySeconds) {
    updateStatus('Setting files to ready state...');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            action: "setFilesToReady", 
            files: files,
            delaySeconds: delaySeconds
        }, function() {
            // Move to step 4 after a brief delay
            setTimeout(() => {
                triggerDownloads(files, delaySeconds);
            }, 1000);
        });
    });
}

// Step 4: Download all files
function triggerDownloads(files, delaySeconds) {
    updateStatus('Triggering downloads for all files...');
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            action: "downloadAllFiles", 
            files: files,
            delaySeconds: delaySeconds
        }, function() {
            updateStatus(`Download process completed for ${files.length} files!`);
            saveDownloadHistory(files);
        });
    });
}

// Helper function to update status message
function updateStatus(message) {
    document.getElementById('status-message').textContent = message;
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
