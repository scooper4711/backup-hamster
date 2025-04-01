// This file contains the JavaScript for the options page, managing user settings and preferences.

document.addEventListener('DOMContentLoaded', function() {
    const saveButton = document.getElementById('save-button');
    const settingsForm = document.getElementById('settings-form');

    // Load saved settings from storage
    chrome.storage.sync.get(['setting1', 'setting2'], function(data) {
        document.getElementById('setting1').value = data.setting1 || '';
        document.getElementById('setting2').value = data.setting2 || '';
    });

    // Save settings when the save button is clicked
    saveButton.addEventListener('click', function() {
        const setting1 = document.getElementById('setting1').value;
        const setting2 = document.getElementById('setting2').value;

        chrome.storage.sync.set({
            setting1: setting1,
            setting2: setting2
        }, function() {
            alert('Settings saved!');
        });
    });
});