// Content script for handling downloads on paizo.com/paizo/account/assets

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch(request.action) {
        case "findDownloadableFiles":
            // If filter is provided, only return filtered files
            const allFiles = findDownloadableFiles();
            let filteredFiles = allFiles;
            
            if (request.filter && request.filter.length >= 3) {
                const normalizedFilter = request.filter.toLowerCase();
                filteredFiles = allFiles.filter(file => 
                    file.title.toLowerCase().includes(normalizedFilter)
                );
            }
            
            sendResponse({files: filteredFiles});
            break;
        case "filterFiles":
            // Call the filter function and return visible count
            const visibleCount = filterFiles(request.filter);
            sendResponse({visibleCount: visibleCount});
            break;
        case "initializePersonalization":
            initializePersonalization(request.files);
            sendResponse({status: "personalization_started"});
            break;
        case "setFilesToReady":
            setFilesToReady(request.files, request.delaySeconds || 5);
            sendResponse({status: "set_to_ready"});
            break;
        case "downloadAllFiles":
            downloadAllFiles(request.files, request.delaySeconds || 5);
            sendResponse({status: "downloads_triggered"});
            break;
        case "startDownload":
            // Pass the delay seconds to your functions
            const delaySeconds = request.delaySeconds || 5;
            initializePersonalization(files, delaySeconds);
            // Also pass to other click functions
            break;
    }
    return true; // Keep the message channel open for async responses
});

/**
 * Filter files based on text content
 * @param {string} filter - Text to filter by (case insensitive)
 * @returns {number} - Count of visible items after filtering
 */
function filterFiles(filter) {
  // Normalize filter for case-insensitive comparison
  const normalizedFilter = filter.toLowerCase();
  
  // Find all file rows (tbody elements)
  const fileRows = document.querySelectorAll('table > tbody');
  
  let visibleCount = 0;
  
  // Process each file row
  fileRows.forEach(tbody => {
    // Skip tbodies without an ID (likely UI elements, not file entries)
    if (!tbody.id) return;
    
    // Find the anchor in the second cell (file title)
    const secondCell = tbody.querySelector('tr > td:nth-child(2)');
    if (!secondCell) return;
    
    // Get all text from the cell (includes title in anchor or span)
    const cellText = secondCell.textContent.trim().toLowerCase();
    
    // Show or hide based on filter match
    if (!filter || filter.length < 3 || cellText.includes(normalizedFilter)) {
      tbody.style.display = ''; // Show the file
      visibleCount++;
    } else {
      tbody.style.display = 'none'; // Hide the file
    }
  });
  
  return visibleCount;
}

/**
 * Find all downloadable files on the page
 * Uses the same method as filterFiles to ensure all downloadable files are found
 */
function findDownloadableFiles() {
    const files = [];
    const fileRows = document.querySelectorAll('table > tbody');
    
    fileRows.forEach(tbody => {
        // Skip rows that are hidden by the filter
        if (tbody.style.display === 'none') return;
        
        // Skip tbodies without an ID (likely UI elements, not file entries)
        if (!tbody.id) return;
        
        // Find the anchor in the second cell (file title)
        const secondCell = tbody.querySelector('tr > td:nth-child(2)');
        if (!secondCell) return;
        
        // Get the anchor element (file link)
        const fileElement = secondCell.querySelector('a');
        if (!fileElement) return;
        
        const fileId = tbody.id;
        const title = fileElement.textContent.trim();
        const dateUpdated = extractUpdateDate(fileElement);
        const lastDownloaded = extractLastDownloaded(fileElement);
        
        if (fileId && title) {
            files.push({
                id: fileId,
                title: title,
                dateUpdated: dateUpdated,
                lastDownloaded: lastDownloaded,
                element: fileElement
            });
        }
    });
    
    console.log(`Found ${files.length} downloadable files (including visible files without Personalizer).`);
    return files;
}

/**
 * Extract the update date from the file element
 */
function extractUpdateDate(fileElement) {
    // The update date is in the fourth cell of the <tbody> element that contains the fileElement
    const tbodyElement = fileElement.closest('tbody');
    if (!tbodyElement) return null;
    const dateCell = tbodyElement.querySelector('td:nth-child(4)');
    return dateCell ? dateCell.textContent.trim() : null;
}

/**
 * Determine the current download status of a file
 */
function extractLastDownloaded(fileElement) {
    // The last downloaded date is in the third cell of the <tbody> element that contains the fileElement
    const tbodyElement = fileElement.closest('tbody');
    if (!tbodyElement) return null;
    const dateCell = tbodyElement.querySelector('td:nth-child(3)');
    return dateCell ? dateCell.textContent.trim() : null;
}

/**
 * Determine if a file should be downloaded
 */
function shouldDownloadFile(fileId, currentStatus, dateUpdated, history) {
    // If file is already in personalizing or ready state, download it
    if (currentStatus === 'personalizing' || currentStatus === 'ready') {
        return true;
    }
    
    // If file has never been downloaded before, download it
    if (!history[fileId]) {
        return true;
    }
    
    // If file has been updated since last download, download it again
    if (dateUpdated && history[fileId].lastDownloaded) {
        const lastDownloaded = new Date(history[fileId].lastDownloaded);
        const updated = new Date(dateUpdated);
        return updated > lastDownloaded;
    }
    
    return false;
}

/**
 * Initialize personalization for all files (first click)
 * Only clicks files that need personalizing (have Personalizer in href or never downloaded)
 */
function initializePersonalization(files, delaySeconds = 5) {
    const delay = delaySeconds * 1000; // Convert to milliseconds
    let fileNumber = 1;
    let clickCount = 0;
    
    files.forEach(file => {
        const lastDownloaded = file.lastDownloaded || 'never';
        const delayForThisFile = delay * fileNumber++;
        
        // Skip files that don't need personalization
        // if (lastDownloaded !== 'never' && lastDownloaded !== '') {
        //     console.log(`Skipping already downloaded file: ${file.title}`);
        //     return;
        // }
        
        console.log(`Scheduling personalization for: ${file.title}`);
        const tbodyElement = document.getElementById(file.id);
        const titleElement = tbodyElement ? tbodyElement.querySelector('a') : null;
        
        if (titleElement) {
            // Check if this is a personalizer link
            const href = titleElement.getAttribute('href') || '';
            const needsPersonalization = href.includes('Personalizer') || lastDownloaded === 'never';
            
            if (!needsPersonalization) {
                console.log(`Skipping - no Personalizer in href: ${file.title}`);
                return;
            }
            
            setTimeout(() => {
                titleElement.click(); // Click to start personalization
                clickCount++;
                console.log(`Clicked to personalize: ${file.title}`);
                
                // Send status update back to popup
                chrome.runtime.sendMessage({
                    action: "updateStatus",
                    message: `Personalizing ${file.title}... (${clickCount}/${files.length})`
                });
            }, delayForThisFile);
        }
    });
}

/**
 * Set all files to ready state (second click after personalization)
 * Uses same delay mechanism as personalization
 */
function setFilesToReady(files, delaySeconds = 5) {
    const delay = delaySeconds * 1000; // Convert to milliseconds
    let fileNumber = 1;
    let clickCount = 0;
    
    files.forEach(file => {
        const delayForThisFile = delay * fileNumber++;
        
        setTimeout(() => {
            // Find the element
            const tbodyElement = document.getElementById(file.id);
            const titleElement = tbodyElement ? tbodyElement.querySelector('a') : null;
            
            if (titleElement) {
                // Check if this file shows "Personalizing..."
                const tbodyText = tbodyElement.textContent || '';
                const isPersonalizing = tbodyText.includes('Personalizing') || 
                                      tbodyText.includes('Click link again in');
                
                if (!isPersonalizing) {
                    console.log(`Skipping - not in personalizing state: ${file.title}`);
                    return;
                }
                
                titleElement.click(); // Click to set to ready
                clickCount++;
                console.log(`Set to ready: ${file.title}`);
                
                // Send status update back to popup
                chrome.runtime.sendMessage({
                    action: "updateStatus",
                    message: `Setting ready ${file.title}... (${clickCount}/${files.length})`
                });
            }
        }, delayForThisFile);
    });
}

/**
 * Trigger downloads for all files (third click)
 * Uses same delay mechanism for consistency
 */
function downloadAllFiles(files, delaySeconds = 5) {
    const delay = delaySeconds * 1000; // Convert to milliseconds
    let fileNumber = 1;
    let clickCount = 0;
    
    files.forEach(file => {
        const delayForThisFile = delay * fileNumber++;
        
        setTimeout(() => {
            // Find the element
            const tbodyElement = document.getElementById(file.id);
            const titleElement = tbodyElement ? tbodyElement.querySelector('a') : null;
            
            if (titleElement) {
                // Check if this file shows "Ready!"
                const tbodyText = tbodyElement.textContent || '';
                const isReady = tbodyText.includes('Ready!') || 
                               tbodyText.includes('Click again to download');
                
                if (!isReady) {
                    console.log(`Skipping download - not in ready state: ${file.title}`);
                    return;
                }
                
                titleElement.click(); // Click to download
                clickCount++;
                console.log(`Triggered download for: ${file.title}`);
                
                // Send status update back to popup
                chrome.runtime.sendMessage({
                    action: "updateStatus",
                    message: `Downloading ${file.title}... (${clickCount}/${files.length})`
                });
            }
        }, delayForThisFile);
    });
}
