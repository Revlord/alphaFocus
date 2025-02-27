// Game state variables
let xp = 0;
let level = 1;
let gold = 0;
let quests = [];
let activeQuest = null;
let stopwatchInterval = null;
let stopwatchTime = 0;
let completedQuests = [];
let xpToNextLevel = 500;
let achievements = [
    { id: 1, name: "First Victory", description: "Focus for 10 minutes", xp: 100, completed: false, condition: () => false },
    { id: 2, name: "Silver Mind", description: "Complete 5x 30-Min Focus Sessions", xp: 250, completed: false, condition: () => false },
    { id: 3, name: "Brain of Steel", description: "Focus for 3 hours in a day", xp: 1000, completed: false, condition: () => false }
];

// Rank system based on level
const ranks = [
    { level: 1, name: "Goldfish Brain 🐠", maxLevel: 5 },
    { level: 6, name: "Bronze Novice 🎖️", maxLevel: 10 },
    { level: 11, name: "Silver Scholar 📜", maxLevel: 20 },
    { level: 21, name: "Iron Warrior ⚔️", maxLevel: 30 },
    { level: 31, name: "Diamond Monk 🧘‍♂️", maxLevel: 40 },
    { level: 41, name: "Shadow Assassin 🥷", maxLevel: 49 },
    { level: 50, name: "GigaBrain Master 🧠🔥", maxLevel: 999 }
];

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the UI when the DOM is fully loaded
    initializeUI();
    
    // Set up event listeners
    document.getElementById('add-quest-btn').addEventListener('click', addQuest);
    document.getElementById('complete-quest-btn').addEventListener('click', completeActiveQuest);
    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('level-up-modal').style.display = 'none';
    });
    // Add these reset button event listeners
    document.getElementById('reset-game-btn').addEventListener('click', showResetModal);
    document.getElementById('cancel-reset-btn').addEventListener('click', hideResetModal);
    document.getElementById('confirm-reset-btn').addEventListener('click', attemptGameReset);
    
    // Update UI with initial values
    updateUI();
});

// Initialize UI elements
function initializeUI() {
    // Load saved state if available
    loadGameState();
    
    // Initial UI update
    updateUI();
}

// Save game state to localStorage
function saveGameState() {
    const gameState = {
        xp,
        level,
        gold,
        quests,
        completedQuests,
        achievements,
        xpToNextLevel
    };
    
    localStorage.setItem('focusRPG_gameState', JSON.stringify(gameState));
}

// Load game state from localStorage
function loadGameState() {
    const savedState = localStorage.getItem('focusRPG_gameState');
    
    if (savedState) {
        const gameState = JSON.parse(savedState);
        xp = gameState.xp || 0;
        level = gameState.level || 1;
        gold = gameState.gold || 0;
        quests = gameState.quests || [];
        completedQuests = gameState.completedQuests || [];
        achievements = gameState.achievements || achievements;
        xpToNextLevel = gameState.xpToNextLevel || 500;
        
        // Render quests
        renderQuestsList();
        renderQuestHistory();
    }
}

// Update all UI elements based on game state
function updateUI() {
    document.getElementById('xp').innerText = xp;
    document.getElementById('level').innerText = level;
    document.getElementById('gold').innerText = Math.floor(gold);
    document.getElementById('xp-to-level').innerText = xpToNextLevel;
    
    // Update XP progress bar
    const progressPercentage = (xp / xpToNextLevel) * 100;
    document.getElementById('xp-progress').style.width = `${progressPercentage}%`;
    
    // Update rank
    const currentRank = getCurrentRank();
    document.getElementById('rank').innerText = currentRank.name;
    
    // Check for achievements
    checkAchievements();
}

// Add a new quest
function addQuest() {
    const questNameInput = document.getElementById('quest-name');
    const questXpInput = document.getElementById('quest-xp');
    
    const questName = questNameInput.value.trim();
    const questXp = parseInt(questXpInput.value);
    
    if (questName && questXp && questXp > 0) {
        const quest = {
            id: Date.now(), // Use timestamp as unique ID
            name: questName,
            xpReward: questXp,
            timeAdded: new Date()
        };
        
        quests.push(quest);
        questNameInput.value = '';
        questXpInput.value = '10';
        
        renderQuestsList();
        saveGameState();
    }
}

// Render the quests list
function renderQuestsList() {
    const questsList = document.getElementById('quests-list');
    questsList.innerHTML = '';
    
    if (quests.length === 0) {
        questsList.innerHTML = '<div class="empty-state">No quests added yet. Start by adding a quest above!</div>';
        return;
    }
    
    quests.forEach(quest => {
        const questElement = document.createElement('div');
        questElement.className = 'quest-item';
        questElement.innerHTML = `
            <div class="quest-name">${quest.name}</div>
            <div class="quest-xp">${quest.xpReward} XP</div>
            <button class="start-quest-btn" data-quest-id="${quest.id}">Start</button>
        `;
        
        questsList.appendChild(questElement);
    });
    
    // Add event listeners to start buttons
    document.querySelectorAll('.start-quest-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const questId = parseInt(e.target.getAttribute('data-quest-id'));
            startQuest(questId);
        });
    });
}

// Render quest history
function renderQuestHistory() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    
    if (completedQuests.length === 0) {
        historyList.innerHTML = '<div class="empty-state">No completed quests yet. Finish a quest to see its history here!</div>';
        return;
    }
    
    // Sort by most recent first
    const sortedQuests = [...completedQuests].sort((a, b) => b.completedTime - a.completedTime);
    
    sortedQuests.forEach(quest => {
        const formattedTime = formatTime(quest.duration);
        const questDate = new Date(quest.completedTime).toLocaleDateString();
        
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div>
                <div class="history-quest-name">${quest.name}</div>
                <div class="history-date">${questDate}</div>
            </div>
            <div class="history-details">
                <span class="history-duration">${formattedTime}</span>
                <span class="history-xp">+${quest.xpReward} XP</span>
            </div>
        `;
        
        historyList.appendChild(historyItem);
    });
}

// Start a quest
function startQuest(questId) {
    // If there's already an active quest, confirm before starting a new one
    if (activeQuest) {
        if (!confirm('You already have an active quest. Do you want to abandon it and start this one?')) {
            return;
        }
        stopStopwatch();
        activeQuest = null;
    }
    
    // Find the quest by ID
    const quest = quests.find(q => q.id === questId);
    
    if (quest) {
        activeQuest = { ...quest, startTime: new Date() };
        
        // Update UI to show active quest
        document.getElementById('no-active-quest').classList.add('hidden');
        document.getElementById('quest-details').classList.remove('hidden');
        document.getElementById('active-quest-name').innerText = quest.name;
        
        // Reset and start stopwatch
        stopwatchTime = 0;
        updateStopwatchDisplay();
        startStopwatch();
    }
}

// Start the stopwatch
function startStopwatch() {
    stopwatchInterval = setInterval(() => {
        stopwatchTime++;
        updateStopwatchDisplay();
    }, 1000);
}

// Stop the stopwatch
function stopStopwatch() {
    if (stopwatchInterval) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
    }
}

// Update the stopwatch display
function updateStopwatchDisplay() {
    const hours = Math.floor(stopwatchTime / 3600);
    const minutes = Math.floor((stopwatchTime % 3600) / 60);
    const seconds = stopwatchTime % 60;
    
    const display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('stopwatch').innerText = display;
}

// Format time in seconds to HH:MM:SS
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Complete the active quest
function completeActiveQuest() {
    if (!activeQuest) return;
    
    stopStopwatch();
    
    // Calculate duration
    const questDuration = stopwatchTime;
    const bonusMultiplier = calculateBonusMultiplier(questDuration);
    
    // Award XP and Gold based on quest reward and duration
    const earnedXP = Math.round(activeQuest.xpReward * bonusMultiplier);
    const earnedGold = Math.round(earnedXP / 10);
    
    // Add to completed quests
    const completedQuest = {
        ...activeQuest,
        completedTime: new Date(),
        duration: questDuration,
        earnedXP
    };
    
    completedQuests.push(completedQuest);
    
    // Remove from active quests
    quests = quests.filter(q => q.id !== activeQuest.id);
    
    // Award XP and Gold
    gainXP(earnedXP);
    gainGold(earnedGold);
    
    // Show completion message
    alert(`Quest completed! You gained ${earnedXP} XP and ${earnedGold} Gold!\nTime spent: ${formatTime(questDuration)}`);
    
    // Reset active quest
    activeQuest = null;
    
    // Update UI
    document.getElementById('no-active-quest').classList.remove('hidden');
    document.getElementById('quest-details').classList.add('hidden');
    
    renderQuestsList();
    renderQuestHistory();
    saveGameState();
}

// Calculate bonus multiplier based on focus duration
function calculateBonusMultiplier(duration) {
    if (duration < 60) return 1; // Less than 1 minute
    if (duration < 300) return 1.2; // 1-5 minutes
    if (duration < 1800) return 1.5; // 5-30 minutes
    if (duration < 3600) return 1.8; // 30-60 minutes
    return 2; // More than 60 minutes
}

// Get the current rank based on level
function getCurrentRank() {
    for (let i = ranks.length - 1; i >= 0; i--) {
        if (level >= ranks[i].level) {
            return ranks[i];
        }
    }
    return ranks[0]; // Default to lowest rank
}

function resetAllTasks() {

}

// Gain XP and check for level up
function gainXP(amount) {
    xp += amount;
    
    // Check for level up
    if (xp >= xpToNextLevel) {
        levelUp();
    }
    
    updateUI();
    saveGameState();
}

// Gain Gold
function gainGold(amount) {
    gold += amount;
    updateUI();
    saveGameState();
}

// Level up
function levelUp() {
    const oldLevel = level;
    level++;
    xp = xp - xpToNextLevel;
    xpToNextLevel = Math.round(xpToNextLevel * 1.2); // Each level requires more XP
    
    // Check if reached a new rank
    const oldRank = getCurrentRankForLevel(oldLevel);
    const newRank = getCurrentRankForLevel(level);
    
    // Show level up modal
    document.getElementById('new-level').innerText = level;
    document.getElementById('new-rank').innerText = newRank.name;
    document.getElementById('level-up-modal').style.display = 'flex';
    
    // Play level up sound effect
    playLevelUpSound();
    
    // Check for level up again if we have excess XP
    if (xp >= xpToNextLevel) {
        levelUp();
    }
    
    updateUI();
    saveGameState();
}

// Get rank for a specific level
function getCurrentRankForLevel(level) {
    for (let i = ranks.length - 1; i >= 0; i--) {
        if (level >= ranks[i].level) {
            return ranks[i];
        }
    }
    return ranks[0];
}

function showResetModal() {
    document.getElementById('reset-modal').style.display = 'flex';
    document.getElementById('reset-code').value = '';
    document.getElementById('reset-code').focus();
    
}

// Hide the reset confirmation modal
function hideResetModal() {
    document.getElementById('reset-modal').style.display = 'none';
}

// Attempt to reset the game with the secret code
function attemptGameReset() {
    const secretCode = 'grindfor2030';
    const enteredCode = document.getElementById('reset-code').value;
    
    if (enteredCode === secretCode) {
        resetGameData();
        hideResetModal();
        alert('Game data has been reset successfully!');
    } else {
        alert('Incorrect secret code. Game data was not reset.');
    }
}

function resetGameData() {
    // Reset all game state variables
    xp = 0;
    level = 1;
    gold = 0;
    quests = [];
    activeQuest = null;
    stopwatchTime = 0;
    completedQuests = [];
    xpToNextLevel = 500;
    
    // Reset achievements
    achievements.forEach(achievement => {
        achievement.completed = false;
    });
    
    // Clear active quest display
    if (stopwatchInterval) {
        stopStopwatch();
    }
    document.getElementById('no-active-quest').classList.remove('hidden');
    document.getElementById('quest-details').classList.add('hidden');
    
    // Save reset state
    saveGameState();
    
    // Update UI
    updateStopwatchDisplay();
    renderQuestsList();
    renderQuestHistory();
    updateUI();
}

// Check for unlocked achievements
function checkAchievements() {
    // Implement achievement checking logic here
    // This will check conditions like "completed 5 quests" etc.
}

// Play level up sound
function playLevelUpSound() {
    // We'd implement audio here in a full version
    console.log("Level up sound played!");
}

// Initialize the game
updateUI();