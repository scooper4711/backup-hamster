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
            setFilesToReady(request.files);
            sendResponse({status: "set_to_ready"});
            break;
        case "downloadAllFiles":
            downloadAllFiles(request.files);
            sendResponse({status: "downloads_triggered"});
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
 * Finds all anchor elements with a href that includes the string "Personalizer"
 */
function findDownloadableFiles() {
    const files = [];
    const fileElements = document.querySelectorAll('a[href*="Personalizer"]');

    fileElements.forEach(fileElement => {
        const fileId = extractFileId(fileElement);
        const title = extractFileTitle(fileElement);
        const dateUpdated = extractUpdateDate(fileElement);
        const lastDownloaded = extractLastDownloaded(fileElement);
        console.log(`File ID: ${fileId}, Title: ${title}, Date Updated: ${dateUpdated}, Last Downloaded: ${lastDownloaded}, File: ${fileElement}`);
        if (fileId && title) {
            files.push({
                id: fileId,
                title: title,
                dateUpdated: dateUpdated,
                lastDownloaded: lastDownloaded,
                element: fileElement // get the achor element for later use
            });
        }
    });
    console.log(`Found ${files.length} downloadable files.`);
    return files;
}
/**
 * Extract the file ID from the file element. It's the id of the <tbody> element that contains the fileElement
 */
function extractFileId(fileElement) {
    // The file ID is the id of the closest <tbody> element
    const tbodyElement = fileElement.closest('tbody');
    return tbodyElement ? tbodyElement.id : null;
}
/**
 * Extract the file title from the file element
 */
function extractFileTitle(fileElement) {
    // fileElement is an anchor tag. Return the body of the anchor tag if it exists
    return fileElement && fileElement.textContent ? fileElement.textContent.trim() : null;
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
 */
function initializePersonalization(files) {
    const delay = 5000; // 5 seconds delay between clicks
    let fileNumber = 1;
    
    files.forEach(file => {
        const lastDownloaded = file.lastDownloaded || 'never';
        const delayForThisFile = delay * fileNumber++;
        
        if (lastDownloaded === 'never' || lastDownloaded === '') {
            console.log(`Scheduling personalization for: ${file.title}`);
            const tbodyElement = document.getElementById(file.id);
            const titleElement = tbodyElement ? tbodyElement.querySelector('a') : null;
            
            if (titleElement) {
                setTimeout(() => {
                    titleElement.click(); // Click to start personalization
                    console.log(`Clicked to personalize: ${file.title}`);
                    
                    // Send status update back to popup
                    chrome.runtime.sendMessage({
                        action: "updateStatus",
                        message: `Personalizing ${file.title}...`
                    });
                }, delayForThisFile);
            }
        }
    });
}

/**
 * Set all files to ready state (second click after personalization)
 */
function setFilesToReady(files) {
    files.forEach(file => {
        // Skip files that are already ready
        if (file.status === 'ready') {
            return;
        }
        
        // Find the element
        const titleElement = file.element || 
            document.querySelector(`[data-product-id="${file.id}"]`) ||
            document.querySelector(`.product-title a[title="${file.title}"]`);
        
        if (titleElement) {
            // Click to set to ready
            titleElement.click();
            console.log(`Set to ready: ${file.title}`);
        }
    });
}

/**
 * Trigger downloads for all files (third click)
 */
function downloadAllFiles(files) {
    files.forEach(file => {
        // Find the element
        const titleElement = file.element || 
            document.querySelector(`[data-product-id="${file.id}"]`) ||
            document.querySelector(`.product-title a[title="${file.title}"]`);
        
        if (titleElement) {
            // Click to download
            titleElement.click();
            console.log(`Triggered download for: ${file.title}`);
        }
    });
}
