// Language: javascript
/**
 * renderer.test.js
 */
 
// Setup basic DOM and global variables for testing
beforeEach(() => {
    document.body.innerHTML = `
        <div id="no-active-quest" class="visible"></div>
        <div id="quest-details" class="hidden"></div>
        <div id="active-quest-name"></div>
        <div id="stopwatch"></div>
    `;

    // Reset global game state variables
    window.xp = 0;
    window.level = 1;
    window.gold = 0;
    window.quests = [];
    window.activeQuest = null;
    window.stopwatchInterval = null;
    window.stopwatchTime = 0;
    window.completedQuests = [];
    window.xpToNextLevel = 500;
    
    // Stub functions for stopwatch updates
    window.updateStopwatchDisplay = jest.fn();
    window.startStopwatch = jest.fn(() => {
        // Simulate starting stopwatch by resetting stopwatchTime
        window.stopwatchTime = 0;
    });
    window.stopStopwatch = jest.fn(() => {
        window.stopwatchInterval = null;
    });

    // Clear any previous confirm mocks
    global.confirm = jest.fn();
});

// Import or require the renderer.js file if needed.
// For this test, we assume startQuest is in the global scope.

describe('startQuest', () => {
    test('should start quest when no active quest exists', () => {
        // Arrange: create a quest and add to quests array
        const quest = {
            id: 123,
            name: "Test Quest",
            xpReward: 50,
            timeAdded: new Date()
        };
        window.quests.push(quest);

        // Act: call startQuest with quest id
        startQuest(quest.id);

        // Assert: activeQuest gets set to quest with a startTime property copied over
        expect(window.activeQuest).toBeTruthy();
        expect(window.activeQuest.id).toBe(quest.id);
        expect(window.activeQuest.name).toBe(quest.name);

        // Verify UI updates:
        expect(document.getElementById('no-active-quest').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('quest-details').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('active-quest-name').innerText).toBe(quest.name);

        // Stopwatch should be reset and started
        expect(window.stopwatchTime).toBe(0);
        expect(startStopwatch).toHaveBeenCalled();
        expect(updateStopwatchDisplay).toHaveBeenCalled();
    });

    test('should NOT start new quest when active quest exists and confirm returns false', () => {
        // Arrange: set an active quest already
        window.activeQuest = { id: 1, name: "Active Quest", xpReward: 100, startTime: new Date() };

        // Create a new quest and add to quests
        const newQuest = {
            id: 456,
            name: "New Quest",
            xpReward: 75,
            timeAdded: new Date()
        };
        window.quests.push(newQuest);

        // Set confirm to return false
        global.confirm.mockReturnValue(false);

        // Act: attempt to start new quest
        startQuest(newQuest.id);

        // Assert: activeQuest remains unchanged
        expect(window.activeQuest.id).toBe(1);
        // Verify that stopStopwatch was not called (since user cancelled)
        expect(stopStopwatch).not.toHaveBeenCalled();
    });

    test('should start new quest when active quest exists and confirm returns true', () => {
        // Arrange: set an active quest already with id=1
        window.activeQuest = { id: 1, name: "Active Quest", xpReward: 100, startTime: new Date() };

        // Create a new quest and add to quests
        const newQuest = {
            id: 789,
            name: "Confirmed Quest",
            xpReward: 80,
            timeAdded: new Date()
        };
        window.quests.push(newQuest);

        // Set confirm to return true
        global.confirm.mockReturnValue(true);

        // Act: attempt to start new quest
        startQuest(newQuest.id);

        // Assert: stopStopwatch should be called to clear previous quest
        expect(stopStopwatch).toHaveBeenCalled();

        // New activeQuest should be set with newQuest details
        expect(window.activeQuest).toBeTruthy();
        expect(window.activeQuest.id).toBe(newQuest.id);
        expect(window.activeQuest.name).toBe(newQuest.name);

        // Verify UI updates:
        expect(document.getElementById('no-active-quest').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('quest-details').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('active-quest-name').innerText).toBe(newQuest.name);

        // Stopwatch should be reset and started
        expect(window.stopwatchTime).toBe(0);
        expect(startStopwatch).toHaveBeenCalled();
        expect(updateStopwatchDisplay).toHaveBeenCalled();
    });
});