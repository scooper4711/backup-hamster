// This file contains utility functions for managing storage, such as saving and retrieving user settings or downloaded files.

const STORAGE_KEY = 'backupHamsterData';

export const saveToStorage = async (data) => {
    try {
        const jsonData = JSON.stringify(data);
        await chrome.storage.local.set({ [STORAGE_KEY]: jsonData });
    } catch (error) {
        console.error('Error saving to storage:', error);
    }
};

export const loadFromStorage = async () => {
    try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        return result[STORAGE_KEY] ? JSON.parse(result[STORAGE_KEY]) : null;
    } catch (error) {
        console.error('Error loading from storage:', error);
        return null;
    }
};

export const clearStorage = async () => {
    try {
        await chrome.storage.local.remove(STORAGE_KEY);
    } catch (error) {
        console.error('Error clearing storage:', error);
    }
};