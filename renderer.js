// Game state variables
let xp = 0;
let level = 1;
let gold = 0;
let quests = [];
let activeQuest = null;
let stopwatchInterval = null;
let stopwatchTime = 0;
let stopwatchStart = 0;
let completedQuests = [];
let xpToNextLevel = 500;
let rewards = [];
let habits = [];
let habitHistory = {}; // Will store completion data by date
let achievements = [
    { id: 1, name: "First Victory", description: "Focus for 10 minutes", xp: 100, completed: false, condition: () => stopwatchTime >= 60000 },
    { id: 2, name: "Silver Mind", description: "Complete 5x 30-Min Focus Sessions", xp: 250, completed: false, condition: () => completedQuests.filter(q => q.duration >= 1800000).length >= 5 },
    { id: 3, name: "Brain of Steel", description: "Focus for 3 hours in a day", xp: 1000, completed: false, condition: () => completedQuests.reduce((acc, q) => acc + q.duration, 0) >= 10800000 },
    { id: 4, name: "Gold Hoarder", description: "Accumulate 1000 gold", xp: 500, completed: false, condition: () => gold >= 1000 },
    { id: 5, name: "Quest Master", description: "Complete 50 quests", xp: 750, completed: false, condition: () => completedQuests.length >= 50 },
    { id: 6, name: "Speed Runner", description: "Complete a quest in under 5 minutes", xp: 200, completed: false, condition: () => completedQuests.some(q => q.duration < 300000) },
    // New habit-related achievements
    { id: 7, name: "Habit Starter", description: "Create your first habit", xp: 50, completed: false, condition: () => habits.length >= 1 },
    { id: 8, name: "Streak Warrior", description: "Maintain a 7-day streak", xp: 300, completed: false, condition: () => habits.some(h => getHabitStreak(h.id) >= 7) },
    { id: 9, name: "Consistency King", description: "Maintain a 30-day streak", xp: 1000, completed: false, condition: () => habits.some(h => getHabitStreak(h.id) >= 30) },
    { id: 10, name: "Multi-Master", description: "Complete 5 different habits in one day", xp: 500, completed: false, condition: () => checkMultiHabitDay() },
    { id: 11, name: "Century Club", description: "Achieve a 100-day streak", xp: 2000, completed: false, condition: () => habits.some(h => getHabitStreak(h.id) >= 100) }
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

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the UI when the DOM is fully loaded
    initializeUI();
    
    // Set up event listeners
    document.getElementById('add-quest-btn').addEventListener('click', addQuest);
    document.getElementById('complete-quest-btn').addEventListener('click', completeActiveQuest);
    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('level-up-modal').style.display = 'none';
    });
    document.getElementById('reset-game-btn').addEventListener('click', showResetModal);
    document.getElementById('cancel-reset-btn').addEventListener('click', hideResetModal);
    document.getElementById('confirm-reset-btn').addEventListener('click', attemptGameReset);
    // Set up filter listeners
    document.getElementById('month-filter').addEventListener('change', renderQuestHistory);
    document.getElementById('duration-filter').addEventListener('change', renderQuestHistory);
    //rewards
    document.getElementById('add-reward-btn').addEventListener('click', addReward);
    document.getElementById('close-redeem-modal').addEventListener('click', () => {
        document.getElementById('redeem-modal').style.display = 'none';
    });
    // Add habit tracking event listeners
    document.getElementById('add-habit-btn').addEventListener('click', addHabit);
    document.getElementById('habit-frequency').addEventListener('change', toggleCustomDays);
    document.getElementById('close-streak-modal').addEventListener('click', () => {
        document.getElementById('streak-modal').style.display = 'none';
    });
    
    // Add filter button listeners
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderHabitsList(e.target.dataset.filter);
        });
    });
});
// Initialize UI elements
function initializeUI() {
    // Load saved state if available
    loadGameState();

    //render everything
    renderQuestsList();
    renderQuestHistory();
    renderRewardsList();
    renderHabitsList();
    populateMonthFilter();

    updateUI();

    setTimeout(() => {
        renderQuestsList();
        renderRewardsList();
        renderHabitsList();
        updateUI();
    }, 100);
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
        xpToNextLevel,
        rewards,
        habits,
        habitHistory
    };
    
    localStorage.setItem('focusRPG_gameState', JSON.stringify(gameState));
}

// Load game state from localStorage
function loadGameState() {
    const savedState = localStorage.getItem('focusRPG_gameState');
    
    if (savedState) {
        const parsedState = JSON.parse(savedState);
        
        // Load primitive values
        xp = parsedState.xp || 0;
        level = parsedState.level || 1;
        gold = parsedState.gold || 0;
        quests = parsedState.quests || [];
        completedQuests = parsedState.completedQuests || [];
        xpToNextLevel = parsedState.xpToNextLevel || 500;
        rewards = parsedState.rewards || [];
        habits = parsedState.habits || [];
        habitHistory = parsedState.habitHistory || {};
        
        // Restore achievement conditions which are lost during JSON serialization
        if (parsedState.achievements) {
            // Update completion status but keep the original condition functions
            achievements.forEach((achievement, index) => {
                if (parsedState.achievements[index]) {
                    achievement.completed = parsedState.achievements[index].completed || false;
                }
            });
        }
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

// Update your renderQuestHistory function to include filtering
function renderQuestHistory() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    
    // Get filter values
    const monthFilter = document.getElementById('month-filter').value;
    const durationFilter = document.getElementById('duration-filter').value;
    
    // Populate month filter if needed
    populateMonthFilter();
    
    if (completedQuests.length === 0) {
        historyList.innerHTML = '<div class="empty-state">No completed quests yet. Finish a quest to see its history here!</div>';
        return;
    }
    
    // Apply filters
    let filteredQuests = [...completedQuests];
    
    // Filter by month
    if (monthFilter !== 'all') {
        const [year, month] = monthFilter.split('-');
        filteredQuests = filteredQuests.filter(quest => {
            const questDate = new Date(quest.completedTime);
            return questDate.getFullYear() === parseInt(year) && 
                   questDate.getMonth() === parseInt(month) - 1;
        });
    }
    
    // Filter by duration
    if (durationFilter !== 'all') {
        filteredQuests = filteredQuests.filter(quest => {
            const duration = quest.duration;
            switch(durationFilter) {
                case 'short': return duration < 300000; // Less than 5 minutes
                case 'medium': return duration >= 300000 && duration < 1800000; // 5-30 minutes
                case 'long': return duration >= 1800000 && duration < 3600000; // 30-60 minutes
                case 'extended': return duration >= 3600000; // More than 60 minutes
                default: return true;
            }
        });
    }
    
    // Sort by most recent first
    const sortedQuests = filteredQuests.sort((a, b) => b.completedTime - a.completedTime);
    
    // Show empty state if no quests match filters
    if (sortedQuests.length === 0) {
        historyList.innerHTML = '<div class="empty-state">No quests match your filter criteria</div>';
        return;
    }
    
    // Render the filtered quests
    sortedQuests.forEach(quest => {
        const formattedTime = formatTime(quest.duration);
        const questDate = new Date(quest.completedTime).toLocaleDateString();
        
        // Format timestamps - handle legacy quests without timestamps
        let timeInfo = '';
        if (quest.startTime && quest.endTime) {
            const startTime = new Date(quest.startTime).toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
            const endTime = new Date(quest.endTime).toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
            timeInfo = `
                <div class="history-timestamps">
                    <span class="timestamp-label">Started:</span> <span class="timestamp-value">${startTime}</span>
                    <span class="timestamp-label">Ended:</span> <span class="timestamp-value">${endTime}</span>
                </div>
            `;
        }
        
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="history-main-info">
                <div class="history-quest-name">${quest.name}</div>
                <div class="history-date">${questDate}</div>
                ${timeInfo}
            </div>
            <div class="history-details">
                <span class="history-duration">${formattedTime}</span>
                <span class="history-xp">+${quest.earnedXP || quest.xpReward} XP</span>
            </div>
            <div class="history-actions">
                <button class="delete-history-btn" data-quest-id="${quest.id || quest.completedTime}" title="Delete this quest log">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        historyList.appendChild(historyItem);
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-history-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const questId = e.currentTarget.getAttribute('data-quest-id');
            deleteQuestFromHistory(questId);
        });
    });
}

// Add function to delete a quest from history
function deleteQuestFromHistory(questId) {
    if (confirm('Are you sure you want to delete this quest from your history? This action cannot be undone.')) {
        // Find and remove the quest from completedQuests array
        completedQuests = completedQuests.filter(quest => {
            // Use either the quest ID or completion time as identifier
            const identifier = quest.id || quest.completedTime;
            return identifier.toString() !== questId.toString();
        });
        
        // Re-render the history and save state
        renderQuestHistory();
        populateMonthFilter(); // Update the month filter options
        saveGameState();
        
        // Show a toast notification
        showToast('📝 Quest deleted from history');
    }
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


// Replace startStopwatch with this implementation
function startStopwatch() {
    // Record the start time (reset for this session)
    stopwatchStart = Date.now();
    // Clear any existing interval
    if (stopwatchInterval) clearInterval(stopwatchInterval);
    // Update the stopwatch display four times per second
    stopwatchInterval = setInterval(() => {
        stopwatchTime = Date.now() - stopwatchStart;
        updateStopwatchDisplay();
    }, 10);
}

// Replace stopStopwatch with this implementation
function stopStopwatch() {
    if (stopwatchInterval) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
        // Final update in case there's any lag
        stopwatchTime = Date.now() - stopwatchStart;
        updateStopwatchDisplay();
    }
}

// Update the stopwatch display
// Update the stopwatch display
function updateStopwatchDisplay() {
    const hours = Math.floor(stopwatchTime / 3600000);
    const minutes = Math.floor((stopwatchTime % 3600000) / 60000);
    const seconds = Math.floor((stopwatchTime % 60000) / 1000);
    const centiseconds = Math.floor((stopwatchTime % 1000) / 10);
    
    const display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`;
    document.getElementById('stopwatch').innerText = display;
}

// Format time in milliseconds to HH:MM:SS:CC
function formatTime(milliseconds) {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const centiseconds = Math.floor((milliseconds % 1000) / 10);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`;
}

// Format time in milliseconds to HH:MM:SS:CC
function formatTime(milliseconds) {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const centiseconds = Math.floor((milliseconds % 1000) / 10);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`;
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
    
    // Calculate start and end times
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - questDuration);
    
    // Add to completed quests
    const completedQuest = {
        ...activeQuest,
        completedTime: endTime,
        duration: questDuration,
        earnedXP,
        startTime: startTime,
        endTime: endTime
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
    if (duration < 60000) return 1; // Less than 1 minute
    if (duration < 300000) return 1.2; // 1-5 minutes
    if (duration < 1800000) return 1.5; // 5-30 minutes
    if (duration < 3600000) return 1.8; // 30-60 minutes
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
    rewards= [];
    habits = [];
    habitHistory = {};
    
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
    renderRewardsList();
    renderHabitsList();
    updateStopwatchDisplay();
    renderQuestsList();
    renderQuestHistory();
    updateUI();
}

// Add habit tracking functions
function addHabit() {
    const habitNameInput = document.getElementById('habit-name');
    const difficultySelect = document.getElementById('habit-difficulty');
    const frequencySelect = document.getElementById('habit-frequency');
    
    const habitName = habitNameInput.value.trim();
    const difficulty = difficultySelect.value;
    const frequency = frequencySelect.value;
    
    if (!habitName) {
        alert('Please enter a habit name!');
        return;
    }
    
    let customDays = [];
    if (frequency === 'custom') {
        const checkboxes = document.querySelectorAll('.days-checkboxes input[type="checkbox"]:checked');
        customDays = Array.from(checkboxes).map(cb => parseInt(cb.value));
        if (customDays.length === 0) {
            alert('Please select at least one day for custom frequency!');
            return;
        }
    }
    
    const xpRewards = {
        easy: 5,
        medium: 10,
        hard: 20,
        extreme: 35
    };
    
    const habit = {
        id: Date.now(),
        name: habitName,
        difficulty: difficulty,
        xpReward: xpRewards[difficulty],
        frequency: frequency,
        customDays: customDays,
        createdDate: new Date().toISOString().split('T')[0],
        totalCompletions: 0
    };
    
    habits.push(habit);
    
    // Clear form
    habitNameInput.value = '';
    difficultySelect.value = 'medium';
    frequencySelect.value = 'daily';
    document.getElementById('custom-days-selector').classList.add('hidden');
    document.querySelectorAll('.days-checkboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    renderHabitsList();
    saveGameState();
    
    // Show success message
    showToast(`🎯 Habit "${habitName}" added! Start building your streak!`);
}

function toggleCustomDays() {
    const frequency = document.getElementById('habit-frequency').value;
    const customSelector = document.getElementById('custom-days-selector');
    
    if (frequency === 'custom') {
        customSelector.classList.remove('hidden');
    } else {
        customSelector.classList.add('hidden');
    }
}

function renderHabitsList(filter = 'all') {
    const habitsList = document.getElementById('habits-list');
    habitsList.innerHTML = '';
    
    if (habits.length === 0) {
        habitsList.innerHTML = '<div class="empty-habits">No habits created yet. Add your first habit above!</div>';
        return;
    }
    
    let filteredHabits = [...habits];
    const today = new Date().toISOString().split('T')[0];
    
    // Apply filters
    switch(filter) {
        case 'active':
            filteredHabits = habits.filter(habit => 
                isHabitActiveToday(habit) && !isHabitCompletedToday(habit.id)
            );
            break;
        case 'completed':
            filteredHabits = habits.filter(habit => isHabitCompletedToday(habit.id));
            break;
        case 'streak':
            filteredHabits = habits.sort((a, b) => getHabitStreak(b.id) - getHabitStreak(a.id));
            break;
    }
    
    if (filteredHabits.length === 0) {
        const filterMessages = {
            active: 'No active habits for today!',
            completed: 'No habits completed today yet!',
            streak: 'No habits with streaks yet!'
        };
        habitsList.innerHTML = `<div class="empty-habits">${filterMessages[filter] || 'No habits found!'}</div>`;
        return;
    }
    
    filteredHabits.forEach(habit => {
        const habitElement = createHabitElement(habit);
        habitsList.appendChild(habitElement);
    });
}

function createHabitElement(habit) {
    const habitElement = document.createElement('div');
    habitElement.className = 'habit-item';
    
    const isCompletedToday = isHabitCompletedToday(habit.id);
    const isActiveToday = isHabitActiveToday(habit);
    const currentStreak = getHabitStreak(habit.id);
    
    // Add special classes for visual effects
    if (isCompletedToday) {
        habitElement.classList.add('completed');
    }
    if (currentStreak >= 7) {
        habitElement.classList.add('streak-fire');
    }
    
    const frequencyText = getFrequencyText(habit);
    const weeklyProgress = generateWeeklyProgress(habit.id);
    
    habitElement.innerHTML = `
        <div class="habit-header">
            <div class="habit-name">${habit.name}</div>
            <div class="habit-difficulty ${habit.difficulty}">${habit.difficulty}</div>
        </div>
        
        <div class="habit-streak">
            <span class="streak-flame">🔥</span>
            <span class="streak-number">${currentStreak}</span>
            <span class="streak-text">day streak</span>
        </div>
        
        <div class="habit-frequency">
            <i class="fas fa-calendar"></i>
            ${frequencyText}
        </div>
        
        <div class="habit-progress">
            <div class="progress-text">
                <span>This week</span>
                <span>${getWeeklyCompletionCount(habit.id)}/7</span>
            </div>
            <div class="weekly-progress">
                ${weeklyProgress}
            </div>
        </div>
        
        <div class="habit-actions">
            <button class="complete-habit-btn ${isCompletedToday ? 'completed' : ''}" 
                    data-habit-id="${habit.id}" 
                    ${!isActiveToday || isCompletedToday ? 'disabled' : ''}>
                ${isCompletedToday ? 
                    '<i class="fas fa-check"></i> Completed!' : 
                    `<i class="fas fa-plus"></i> Complete (+${habit.xpReward} XP)`}
            </button>
            <button class="delete-habit-btn" data-habit-id="${habit.id}">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    // Add event listeners
    const completeBtn = habitElement.querySelector('.complete-habit-btn');
    const deleteBtn = habitElement.querySelector('.delete-habit-btn');
    
    if (!completeBtn.disabled) {
        completeBtn.addEventListener('click', () => completeHabit(habit.id));
    }
    
    deleteBtn.addEventListener('click', () => deleteHabit(habit.id));
    
    return habitElement;
}

function completeHabit(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit || isHabitCompletedToday(habitId)) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Initialize habit history if needed
    if (!habitHistory[habitId]) {
        habitHistory[habitId] = {};
    }
    
    // Mark as completed today
    habitHistory[habitId][today] = true;
    habit.totalCompletions++;
    
    // Award XP and gold
    const bonusMultiplier = calculateStreakBonus(habitId);
    const earnedXP = Math.round(habit.xpReward * bonusMultiplier);
    const earnedGold = Math.round(earnedXP / 15); // Less gold than quests
    
    gainXP(earnedXP);
    gainGold(earnedGold);
    
    // Check for streak milestones
    const newStreak = getHabitStreak(habitId);
    checkStreakMilestones(habit, newStreak);
    
    // Re-render habits
    renderHabitsList();
    saveGameState();
    
    // Show completion message
    showToast(`✅ ${habit.name} completed! +${earnedXP} XP, +${earnedGold} Gold`);
}

function deleteHabit(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    
    if (confirm(`Are you sure you want to delete "${habit.name}"? This will also delete all progress history.`)) {
        habits = habits.filter(h => h.id !== habitId);
        delete habitHistory[habitId];
        renderHabitsList();
        saveGameState();
    }
}

function isHabitActiveToday(habit) {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    
    switch(habit.frequency) {
        case 'daily':
            return true;
        case 'weekdays':
            return dayOfWeek >= 1 && dayOfWeek <= 5;
        case 'weekends':
            return dayOfWeek === 0 || dayOfWeek === 6;
        case 'custom':
            return habit.customDays.includes(dayOfWeek);
        default:
            return true;
    }
}

function isHabitCompletedToday(habitId) {
    const today = new Date().toISOString().split('T')[0];
    return habitHistory[habitId] && habitHistory[habitId][today] === true;
}

function getHabitStreak(habitId) {
    if (!habitHistory[habitId]) return 0;
    
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return 0;
    
    let streak = 0;
    const today = new Date();
    
    // Check backwards from today
    for (let i = 0; i < 365; i++) { // Max 1 year lookback
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        
        // Create a habit object with the date to check if it should be active
        const tempHabit = { ...habit };
        const originalDate = new Date();
        
        // Temporarily set the date for checking
        global.Date = class extends Date {
            constructor(...args) {
                if (args.length === 0) {
                    super(checkDate);
                } else {
                    super(...args);
                }
            }
            static now() {
                return checkDate.getTime();
            }
        };
        
        const dateStr = checkDate.toISOString().split('T')[0];
        const wasActiveOnDate = isHabitActiveonDate(habit, checkDate);
        
        // Restore original Date
        global.Date = originalDate.constructor;
        
        if (wasActiveOnDate) {
            if (habitHistory[habitId][dateStr]) {
                streak++;
            } else {
                break; // Streak broken
            }
        }
        // If habit wasn't active on this date, continue checking previous days
    }
    
    return streak;
}

function isHabitActiveonDate(habit, date) {
    const dayOfWeek = date.getDay();
    
    switch(habit.frequency) {
        case 'daily':
            return true;
        case 'weekdays':
            return dayOfWeek >= 1 && dayOfWeek <= 5;
        case 'weekends':
            return dayOfWeek === 0 || dayOfWeek === 6;
        case 'custom':
            return habit.customDays.includes(dayOfWeek);
        default:
            return true;
    }
}

function calculateStreakBonus(habitId) {
    const streak = getHabitStreak(habitId);
    if (streak < 3) return 1;
    if (streak < 7) return 1.2;
    if (streak < 30) return 1.5;
    if (streak < 100) return 2;
    return 2.5; // Epic streak bonus
}

function checkStreakMilestones(habit, streak) {
    const milestones = [7, 30, 50, 100, 365];
    
    if (milestones.includes(streak)) {
        const bonusXP = streak * 2; // Bonus XP for milestones
        gainXP(bonusXP);
        
        // Show streak modal
        document.getElementById('streak-days').textContent = streak;
        document.getElementById('streak-habit').textContent = habit.name;
        document.getElementById('streak-bonus').textContent = `+${bonusXP} XP`;
        document.getElementById('streak-modal').style.display = 'flex';
    }
}

function getFrequencyText(habit) {
    const freqMap = {
        daily: 'Every day',
        weekdays: 'Weekdays only',
        weekends: 'Weekends only',
        custom: `Custom days (${habit.customDays.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')})`
    };
    return freqMap[habit.frequency] || 'Daily';
}

function generateWeeklyProgress(habitId) {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    
    let progressHTML = '';
    
    for (let i = 0; i < 7; i++) {
        const checkDate = new Date(startOfWeek);
        checkDate.setDate(startOfWeek.getDate() + i);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        const isToday = dateStr === today.toISOString().split('T')[0];
        const isCompleted = habitHistory[habitId] && habitHistory[habitId][dateStr];
        
        let classes = 'day-dot';
        if (isCompleted) classes += ' completed';
        if (isToday) classes += ' today';
        
        progressHTML += `<div class="${classes}" title="${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i]}"></div>`;
    }
    
    return progressHTML;
}

function getWeeklyCompletionCount(habitId) {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    
    let count = 0;
    for (let i = 0; i < 7; i++) {
        const checkDate = new Date(startOfWeek);
        checkDate.setDate(startOfWeek.getDate() + i);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        if (habitHistory[habitId] && habitHistory[habitId][dateStr]) {
            count++;
        }
    }
    
    return count;
}

function checkMultiHabitDay() {
    const today = new Date().toISOString().split('T')[0];
    let completedToday = 0;
    
    habits.forEach(habit => {
        if (isHabitCompletedToday(habit.id)) {
            completedToday++;
        }
    });
    
    return completedToday >= 5;
}

function showToast(message) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--primary-color);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 1000;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Check for unlocked achievements
// Update your checkAchievements function to be more defensive
function checkAchievements() {
    achievements.forEach(achievement => {
        if (!achievement.completed && typeof achievement.condition === 'function') {
            if (achievement.condition()) {
                achievement.completed = true;
                gainXP(achievement.xp);
                
                // Show notification
                console.log(`Achievement unlocked: ${achievement.name}`);
            }
        }
    });
}

function populateMonthFilter() {
    const monthFilter = document.getElementById('month-filter');
    const currentValue = monthFilter.value;
    
    // Keep the "All time" option
    monthFilter.innerHTML = '<option value="all">All time</option>';
    
    if (completedQuests.length === 0) return;
    
    // Get unique year-month combinations from completed quests
    const uniqueMonths = new Set();
    
    completedQuests.forEach(quest => {
        const date = new Date(quest.completedTime);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // JavaScript months are 0-indexed
        uniqueMonths.add(`${year}-${month}`);
    });
    
    // Sort months in descending order (newest first)
    const sortedMonths = Array.from(uniqueMonths).sort().reverse();
    
    // Add month options to the filter
    sortedMonths.forEach(yearMonth => {
        const [year, month] = yearMonth.split('-');
        const date = new Date(year, month - 1);
        const monthName = date.toLocaleString('default', { month: 'long' });
        const option = document.createElement('option');
        option.value = yearMonth;
        option.textContent = `${monthName} ${year}`;
        monthFilter.appendChild(option);
    });
    
    // Try to restore the previously selected value
    if (currentValue !== 'all') {
        monthFilter.value = currentValue;
        // If the value doesn't exist anymore, default to "all"
        if (monthFilter.value !== currentValue) {
            monthFilter.value = 'all';
        }
    }
}

function addReward() {
    const rewardNameInput = document.getElementById('reward-name');
    const rewardPriceInput = document.getElementById('reward-price');
    
    const rewardName = rewardNameInput.value.trim();
    const rewardPrice = parseInt(rewardPriceInput.value);
    
    if (rewardName && rewardPrice && rewardPrice > 0) {
        const reward = {
            id: Date.now(),
            name: rewardName,
            price: rewardPrice,
            timeAdded: new Date()
        };
        
        rewards.push(reward);
        rewardNameInput.value = '';
        rewardPriceInput.value = '50';
        
        renderRewardsList();
        saveGameState();
    }
}

function renderRewardsList() {
    const rewardsList = document.getElementById('rewards-list');
    rewardsList.innerHTML = '';
    
    if (rewards.length === 0) {
        rewardsList.innerHTML = '<div class="empty-rewards">No rewards yet. Create some rewards to spend your gold on!</div>';
        return;
    }
    
    rewards.forEach(reward => {
        const rewardElement = document.createElement('div');
        rewardElement.className = 'reward-item';
        
        // Check if user has enough gold
        const canAfford = gold >= reward.price;
        
        rewardElement.innerHTML = `
            <div class="reward-name">${reward.name}</div>
            <div class="reward-price">${reward.price} 💰</div>
            <div class="reward-actions">
                <button class="redeem-btn" data-reward-id="${reward.id}" ${!canAfford ? 'disabled' : ''}>
                    ${canAfford ? '<i class="fas fa-shopping-cart"></i> Redeem' : '<i class="fas fa-lock"></i> Not enough'}
                </button>
                <button class="delete-reward-btn" data-reward-id="${reward.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        rewardsList.appendChild(rewardElement);
    });
    
    // Add event listeners to redeem buttons
    document.querySelectorAll('.redeem-btn').forEach(button => {
        if (!button.disabled) {
            button.addEventListener('click', (e) => {
                const rewardId = parseInt(e.currentTarget.getAttribute('data-reward-id'));
                redeemReward(rewardId);
            });
        }
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-reward-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const rewardId = parseInt(e.currentTarget.getAttribute('data-reward-id'));
            deleteReward(rewardId);
        });
    });
}

// Add function to delete a reward
function deleteReward(rewardId) {
    if (confirm('Are you sure you want to delete this reward?')) {
        rewards = rewards.filter(reward => reward.id !== rewardId);
        renderRewardsList();
        saveGameState();
    }
}

// Update redeemReward to remove the reward after redeeming
function redeemReward(rewardId) {
    // Find the reward by ID
    const reward = rewards.find(r => r.id === rewardId);
    
    if (reward && gold >= reward.price) {
        // Deduct the price from gold
        gold -= reward.price;
        
        // Show the redemption modal
        document.getElementById('redeemed-reward').textContent = reward.name;
        document.getElementById('redeem-modal').style.display = 'flex';
        
        // Remove the reward after redeeming
        rewards = rewards.filter(r => r.id !== rewardId);
        
        // Update UI
        updateUI();
        renderRewardsList();
        saveGameState();
    }
}


// Play level up sound
function playLevelUpSound() {
    // We'd implement audio here in a full version
    console.log("Level up sound played!");
}

// Initialize the game
updateUI();