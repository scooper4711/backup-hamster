// Content script for handling downloads on paizo.com/paizo/account/assets

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch(request.action) {
        case "findDownloadableFiles":
            // If filter is provided, only return filtered files
            const filteredFiles = findDownloadableFiles();
            sendResponse({files: filteredFiles});
            break;
        case "filterFiles":
            // Hide all rows that don't match the filter.
            const visibleCount = filterFiles(request.filter);
            sendResponse({visibleCount: visibleCount});
            break;
        case "initializePersonalization":
            // Click on all visible links that include a Personalizer in their href
            clickOnPersonalizerLinks(request.files, request.delaySeconds || 5)
                .then(result => {
                    sendResponse({status: "personalization_complete", count: result.count});
                })
                .catch(error => {
                    console.error("Error during personalization:", error);
                    sendResponse({status: "error", message: error.message});
                });
            break;
        case "setFilesToReady":
            // Click on all visible links that include a Personalizer in their href
            clickOnPersonalizerLinks(request.files, request.delaySeconds || 5)
                .then(result => {
                    sendResponse({status: "set_to_ready", count: result.count});
                })
                .catch(error => {
                    console.error("Error during setFilesToReady:", error);
                    sendResponse({status: "error", message: error.message});
                });
            break;
        case "downloadAllFiles":
            downloadAllFiles(request.files, request.delaySeconds || 5);
            sendResponse({status: "downloads_triggered"});
            break;
        case "startDownload":
            // Pass the delay seconds to your functions
            const delaySeconds = request.delaySeconds || 5;
            clickOnPersonalizerLinks(files, delaySeconds);
            // Also pass to other click functions
            break;
    }
    return true; // Keep the message channel open for async responses
});

/**
 * Filter files based on text content
 * Supports space-separated tokens where ALL must match
 * @param {string} filter - Space-separated tokens to filter by (case insensitive)
 * @returns {number} - Count of visible items after filtering
 */
function filterFiles(filter) {
  // If filter is empty or too short, show all files
  if (!filter || filter.length < 3) {
    return showAllFiles();
  }
  
  // Split filter into tokens and normalize them
  const tokens = filter.toLowerCase().trim().split(/\s+/).filter(token => token.length > 0);
  
  // If no valid tokens, show all files
  if (tokens.length === 0) {
    return showAllFiles();
  }
  
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
    
    // Check if ALL tokens are found in the cell text
    const allTokensMatch = tokens.every(token => cellText.includes(token));
    
    // Show or hide based on whether all tokens match
    if (allTokensMatch) {
      tbody.style.display = ''; // Show the file
      visibleCount++;
    } else {
      tbody.style.display = 'none'; // Hide the file
    }
  });
  
  return visibleCount;
}

// Helper function to show all files
function showAllFiles() {
  const fileRows = document.querySelectorAll('table > tbody');
  let visibleCount = 0;
  
  fileRows.forEach(tbody => {
    if (tbody.id) {
      tbody.style.display = ''; // Show all files
      visibleCount++;
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
 * Click on all files that need personalization
 * @param {Array} files - Array of file objects with id, title, element
 * @param {number} delaySeconds - Delay in seconds between clicks
 * @returns {Promise} - Resolves when all clicks are done
 */
function clickOnPersonalizerLinks(files, delaySeconds = 5) {
    console.log(`Starting personalization for ${files.length} files with a delay of ${delaySeconds} seconds...`);
    return new Promise((resolve) => {
        const delay = delaySeconds * 1000;
        let fileNumber = 1;
        let clickCount = 0;
        const totalFiles = files.length;
        const promises = [];
        
        files.forEach(file => {
            // skip if the href does not contain "Personalizer"
            const tbodyElement = document.getElementById(file.id);
            const titleElement = tbodyElement ? tbodyElement.querySelector('a') : null;
            
            if (!titleElement) return;
            
            // Check if this is a personalizer link
            const href = titleElement.getAttribute('href') || '';
            const needsPersonalization = href.includes('Personalizer');
            if (!needsPersonalization) {
                console.log(`Skipping - not a Personalizer link: ${file.title}`);
                return;
            }
            
            // Create a promise for each file click
            const clickPromise = new Promise(clickResolve => {
                setTimeout(() => {
                    titleElement.click();
                    clickCount++;
                    console.log(`Clicked: ${file.title}`);
                    // Send status update back to popup
                    chrome.runtime.sendMessage({
                        action: "updateStatus",
                        message: `Personalizing ${file.title}... (${clickCount}/${totalFiles})`
                    });
                    clickResolve(); // Mark this click as complete
                }, delay * fileNumber++);
            });
            
            promises.push(clickPromise);
        });
        
        // Wait for ALL click operations to complete
        Promise.all(promises).then(() => {
            console.log(`All ${clickCount} personalizations complete`);
            resolve({count: clickCount});
        });
    });
}

/**
 * Trigger downloads for all files (third click)
 * Uses same delay mechanism for consistency
 */
function downloadAllFiles(files, delaySeconds = 5) {
    const delay = 500; // For downloading, half a second delay is usually enough
    console.log(`Starting download for ${files.length} files with a delay of ${delaySeconds} seconds...`);
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
