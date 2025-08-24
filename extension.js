// @ts-check
const vscode = require('vscode');
const { showDashboard } = require('./dashboard');

let sessionStart = null;
let totalCodingTime = 0;
let isActive = false;
let activityCheckInterval = null;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Orbit Productivity Tracker activated!');

    // Load previous total coding time
    totalCodingTime = context.globalState.get('totalCodingTime', 0);

    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "⌚ 0s";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Update status bar every second
    const interval = setInterval(() => {
        let currentTotal = totalCodingTime;
        if (sessionStart) currentTotal += Date.now() - sessionStart;

        const hours = Math.floor(currentTotal / 3600000);
        const minutes = Math.floor((currentTotal % 3600000) / 60000);
        const seconds = Math.floor((currentTotal % 60000) / 1000);

        statusBarItem.text = `⌚ ${hours}h ${minutes}m ${seconds}s`;
    }, 1000);
    context.subscriptions.push({ dispose: () => clearInterval(interval) });

    // Start activity monitoring
    startActivityMonitoring(context);

    // Command: Show Stats
    const statsDisposable = vscode.commands.registerCommand('orbit.showStats', () => {
        let currentTotal = totalCodingTime;
        if (sessionStart) currentTotal += Date.now() - sessionStart;

        const hours = Math.floor(currentTotal / 3600000);
        const minutes = Math.floor((currentTotal % 3600000) / 60000);
        const seconds = Math.floor((currentTotal % 60000) / 1000);

        vscode.window.showInformationMessage(
            `Total Coding Time: ${hours}h ${minutes}m ${seconds}s`
        );
    });
    context.subscriptions.push(statsDisposable);

    // Command: Show Dashboard
    const dashboardDisposable = vscode.commands.registerCommand('orbit.showDashboard', () => {
        const dailyTimes = context.globalState.get('dailyTimes', {});
        showDashboard(context, totalCodingTime, sessionStart, dailyTimes);
    });
    context.subscriptions.push(dashboardDisposable);
}

function startActivityMonitoring(context) {
    // Track coding time on focus changes
    vscode.window.onDidChangeWindowState((e) => {
        handleFocusChange(e.focused, context);
    });

    // Fallback: Check activity every 30 seconds
    activityCheckInterval = setInterval(() => {
        checkActivityStatus(context);
    }, 30000);
    
    // Store interval for cleanup
    context.subscriptions.push({ dispose: () => clearInterval(activityCheckInterval) });
    
    // Initial check
    handleFocusChange(vscode.window.state.focused, context);
}

function handleFocusChange(focused, context) {
    if (focused) {
        if (!sessionStart) {
            sessionStart = Date.now();
            isActive = true;
            console.log('Orbit: Coding session started');
        }
    } else {
        if (sessionStart) {
            const now = Date.now();
            const elapsed = now - sessionStart;
            totalCodingTime += elapsed;
            sessionStart = null;
            isActive = false;

            // Update daily totals
            const dailyTimes = context.globalState.get('dailyTimes', {});
            const today = new Date().toISOString().split('T')[0];
            dailyTimes[today] = (dailyTimes[today] || 0) + elapsed;

            context.globalState.update('totalCodingTime', totalCodingTime);
            context.globalState.update('dailyTimes', dailyTimes);
            
            console.log('Orbit: Coding session paused');
        }
    }
}

function checkActivityStatus(context) {
    // If we think we're active but no session is recorded, start one
    if (vscode.window.state.focused && !sessionStart) {
        sessionStart = Date.now();
        isActive = true;
        console.log('Orbit: Coding session resumed (fallback detection)');
    }
    // If we think we're inactive but a session is running, pause it
    else if (!vscode.window.state.focused && sessionStart) {
        const now = Date.now();
        const elapsed = now - sessionStart;
        totalCodingTime += elapsed;
        sessionStart = null;
        isActive = false;

        // Update daily totals
        const dailyTimes = context.globalState.get('dailyTimes', {});
        const today = new Date().toISOString().split('T')[0];
        dailyTimes[today] = (dailyTimes[today] || 0) + elapsed;

        context.globalState.update('totalCodingTime', totalCodingTime);
        context.globalState.update('dailyTimes', dailyTimes);
        
        console.log('Orbit: Coding session paused (fallback detection)');
    }
}

function deactivate(context) {
    if (sessionStart) {
        const now = Date.now();
        const elapsed = now - sessionStart;
        totalCodingTime += elapsed;

        const dailyTimes = context.globalState.get('dailyTimes', {});
        const today = new Date().toISOString().split('T')[0];
        dailyTimes[today] = (dailyTimes[today] || 0) + elapsed;

        context.globalState.update('totalCodingTime', totalCodingTime);
        context.globalState.update('dailyTimes', dailyTimes);
    }
    
    if (activityCheckInterval) {
        clearInterval(activityCheckInterval);
    }
}

module.exports = { activate, deactivate };