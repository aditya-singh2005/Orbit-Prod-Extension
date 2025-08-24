const vscode = require("vscode");

function showDashboard(context, totalCodingTime, sessionStart, dailyTimes) {
    const panel = vscode.window.createWebviewPanel(
        'productivityDashboard',
        'Orbit Productivity Dashboard',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    // Compute chart labels and values for last 7 days
    const chartLabels = [];
    const chartValues = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        chartLabels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        chartValues.push(Math.round((dailyTimes[key] || 0) / 3600000 * 10) / 10);
    }

    // Current total and today's time
    let currentTotal = totalCodingTime;
    if (sessionStart) currentTotal += Date.now() - sessionStart;

    const todayKey = new Date().toISOString().split('T')[0];
    let todayTime = dailyTimes[todayKey] || 0;
    if (sessionStart) todayTime += Date.now() - sessionStart;

    // Day streak
    let streak = 0;
    const sortedDates = Object.keys(dailyTimes).sort().reverse();
    for (let date of sortedDates) {
        if (dailyTimes[date] >= 3600000) streak++;
        else break;
    }

    // Average time
    const totalDays = Object.keys(dailyTimes).length || 1;
    const avgTime = currentTotal / totalDays;

    // Weekly total
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    let weeklyTotal = 0;
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const key = date.toISOString().split('T')[0];
        weeklyTotal += dailyTimes[key] || 0;
    }
    if (sessionStart && todayKey >= weekStart.toISOString().split('T')[0]) {
        weeklyTotal += Date.now() - sessionStart;
    }

    panel.webview.html = getDashboardHTML(currentTotal, todayTime, weeklyTotal, streak, avgTime, chartLabels, chartValues, dailyTimes, sessionStart);
}

function getDashboardHTML(currentTotal, todayTime, weeklyTotal, streak, avgTime, chartLabels, chartValues, dailyTimes, sessionStart) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Orbit Productivity Dashboard</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            :root {
                --primary: #2563eb;
                --primary-light: #3b82f6;
                --primary-dark: #1d4ed8;
                --secondary: #10b981;
                --warning: #f59e0b;
                --danger: #ef4444;
                --success: #059669;
                
                /* Light theme colors */
                --bg-primary: #ffffff;
                --bg-secondary: #f8fafc;
                --bg-tertiary: #f1f5f9;
                --text-primary: #0f172a;
                --text-secondary: #475569;
                --text-muted: #64748b;
                --border: #e2e8f0;
                --border-light: #f1f5f9;
                --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
                --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                
                --border-radius: 12px;
                --transition: all 0.3s ease;
            }

            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                color: var(--text-primary);
                line-height: 1.6;
                min-height: 100vh;
                padding: 0;
                margin: 0;
            }

            .dashboard-container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 1.5rem;
            }

            /* Header Styles */
            .header {
                text-align: center;
                margin-bottom: 2.5rem;
                padding: 2rem;
                background: var(--bg-primary);
                border-radius: var(--border-radius);
                border: 1px solid var(--border);
                box-shadow: var(--shadow);
            }

            .header h1 {
                font-size: 2.2rem;
                font-weight: 800;
                color: var(--text-primary);
                margin-bottom: 0.5rem;
                letter-spacing: -0.02em;
            }

            .header p {
                color: var(--text-secondary);
                font-size: 1rem;
                margin-bottom: 1rem;
            }

            .current-time {
                display: inline-block;
                background: var(--bg-tertiary);
                color: var(--text-primary);
                padding: 0.5rem 1rem;
                border-radius: 50px;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
                font-size: 0.85rem;
                border: 1px solid var(--border);
                font-weight: 500;
            }

            /* Controls */
            .controls {
                display: flex;
                justify-content: center;
                gap: 1rem;
                margin-bottom: 2rem;
                flex-wrap: wrap;
            }

            .btn {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1.5rem;
                background: var(--bg-primary);
                color: var(--text-secondary);
                border: 1px solid var(--border);
                border-radius: 50px;
                text-decoration: none;
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: var(--transition);
                box-shadow: var(--shadow);
            }

            .btn:hover {
                background: var(--bg-secondary);
                color: var(--text-primary);
                transform: translateY(-2px);
                box-shadow: var(--shadow-lg);
                border-color: var(--primary-light);
            }

            .btn-primary {
                background: var(--primary);
                color: white;
                border-color: var(--primary);
            }

            .btn-primary:hover {
                background: var(--primary-dark);
                border-color: var(--primary-dark);
                color: white;
            }

            /* Stats Grid - Responsive 2x2 / 4x1 */
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1.5rem;
                margin-bottom: 2.5rem;
            }

            .stat-card {
                background: var(--bg-primary);
                border-radius: var(--border-radius);
                padding: 1.5rem;
                text-align: center;
                border: 1px solid var(--border);
                transition: var(--transition);
                display: flex;
                flex-direction: column;
                justify-content: center;
                box-shadow: var(--shadow);
            }

            .stat-card:hover {
                transform: translateY(-5px);
                box-shadow: var(--shadow-lg);
                border-color: var(--primary-light);
            }

            .stat-icon {
                font-size: 2.5rem;
                margin-bottom: 1rem;
                opacity: 0.8;
            }

            .stat-value {
                font-size: 1.8rem;
                font-weight: 700;
                color: var(--text-primary);
                font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
                margin-bottom: 0.5rem;
                line-height: 1.2;
            }

            .stat-label {
                color: var(--text-secondary);
                font-size: 0.9rem;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            /* Chart Section */
            .chart-section {
                background: var(--bg-primary);
                border: 1px solid var(--border);
                border-radius: var(--border-radius);
                padding: 1.5rem;
                margin-bottom: 2rem;
                box-shadow: var(--shadow);
            }

            .chart-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 1.5rem;
            }

            .chart-title {
                font-size: 1.2rem;
                font-weight: 600;
                color: var(--text-primary);
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .chart-container {
                height: 250px;
                position: relative;
            }

            /* Progress Section */
            .progress-section {
                background: var(--bg-primary);
                border: 1px solid var(--border);
                border-radius: var(--border-radius);
                padding: 1.5rem;
                margin-bottom: 2rem;
                box-shadow: var(--shadow);
            }

            .progress-title {
                font-size: 1.2rem;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 1.5rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .progress-item {
                margin-bottom: 1.5rem;
            }

            .progress-item:last-child {
                margin-bottom: 0;
            }

            .progress-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.5rem;
            }

            .progress-label {
                font-size: 0.95rem;
                font-weight: 500;
                color: var(--text-secondary);
            }

            .progress-percentage {
                font-size: 0.95rem;
                font-weight: 600;
                color: var(--primary);
                font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
            }

            .progress-bar {
                width: 100%;
                height: 8px;
                background-color: var(--bg-tertiary);
                border-radius: 4px;
                overflow: hidden;
                border: 1px solid var(--border-light);
            }

            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, var(--primary), var(--primary-light));
                border-radius: 4px;
                transition: width 0.8s ease;
                position: relative;
            }

            .progress-fill::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                bottom: 0;
                right: 0;
                background-image: linear-gradient(
                    -45deg,
                    rgba(255, 255, 255, 0.2) 25%,
                    transparent 25%,
                    transparent 50%,
                    rgba(255, 255, 255, 0.2) 50%,
                    rgba(255, 255, 255, 0.2) 75%,
                    transparent 75%,
                    transparent
                );
                z-index: 1;
                background-size: 20px 20px;
                animation: move 1s linear infinite;
                border-radius: 4px;
            }

            @keyframes move {
                0% {
                    background-position: 0 0;
                }
                100% {
                    background-position: 20px 0;
                }
            }

            /* Session Info */
            .session-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }

            .session-card {
                background: var(--bg-primary);
                border: 1px solid var(--border);
                border-radius: var(--border-radius);
                padding: 1.5rem;
                box-shadow: var(--shadow);
                transition: var(--transition);
            }

            .session-card:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-lg);
            }

            .session-header {
                font-size: 0.95rem;
                font-weight: 500;
                color: var(--text-secondary);
                margin-bottom: 0.75rem;
            }

            .session-value {
                font-size: 1.5rem;
                font-weight: 700;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
                color: var(--text-primary);
            }

            .session-value.active {
                color: var(--secondary);
            }

            .session-value.daily {
                color: var(--warning);
            }

            .session-value.weekly {
                color: var(--primary);
            }

            /* Achievements */
            .achievements-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 1rem;
            }

            .achievement {
                background: var(--bg-secondary);
                border: 1px solid var(--border);
                border-radius: var(--border-radius);
                padding: 1.25rem;
                text-align: center;
                transition: var(--transition);
            }

            .achievement.unlocked {
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05));
                border-color: var(--secondary);
                color: var(--success);
                box-shadow: var(--shadow);
            }

            .achievement.locked {
                opacity: 0.5;
                color: var(--text-muted);
            }

            .achievement-icon {
                font-size: 2rem;
                margin-bottom: 0.75rem;
            }

            .achievement-label {
                font-size: 0.8rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .dashboard-container {
                    padding: 1rem;
                }
                
                .stats-grid {
                    grid-template-columns: 1fr;
                }
                
                .header h1 {
                    font-size: 1.8rem;
                }
                
                .stat-value {
                    font-size: 1.5rem;
                }
                
                .controls {
                    flex-direction: column;
                }
                
                .btn {
                    width: 100%;
                    justify-content: center;
                }
                
                .session-grid {
                    grid-template-columns: 1fr;
                }
            }

            /* Animation for elements */
            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .stat-card, .chart-section, .progress-section, .session-card {
                animation: fadeIn 0.5s ease-out;
            }

            .stat-card:nth-child(2) {
                animation-delay: 0.1s;
            }
            
            .stat-card:nth-child(3) {
                animation-delay: 0.2s;
            }
            
            .stat-card:nth-child(4) {
                animation-delay: 0.3s;
            }
        </style>
    </head>
    <body>
        <div class="dashboard-container">
            <!-- Header -->
            <div class="header">
                <h1>🚀 Orbit Dashboard</h1>
                <p>Track your coding progress and boost productivity</p>
                <div class="current-time" id="currentTime"></div>
            </div>

            <!-- Controls -->
            <div class="controls">
                <button class="btn btn-primary" onclick="refreshData()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                    </svg>
                    Refresh Data
                </button>
                <button class="btn" onclick="exportData()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                    Export Data
                </button>
            </div>

            <!-- Stats Grid - 2x2 on desktop, 4x1 on mobile -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">⏱️</div>
                    <div class="stat-value">${formatTime(currentTotal)}</div>
                    <div class="stat-label">Total Coding Time</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📅</div>
                    <div class="stat-value">${formatTime(todayTime)}</div>
                    <div class="stat-label">Today's Progress</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🔥</div>
                    <div class="stat-value">${streak}</div>
                    <div class="stat-label">Day Streak</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${formatTimeShort(avgTime)}</div>
                    <div class="stat-label">Daily Average</div>
                </div>
            </div>

            <!-- Chart Section -->
            <div class="chart-section">
                <div class="chart-header">
                    <h3 class="chart-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 3v18h18"/>
                            <path d="M18 17V9"/>
                            <path d="M13 17V5"/>
                            <path d="M8 17v-3"/>
                        </svg>
                        Weekly Progress
                    </h3>
                </div>
                <div class="chart-container">
                    <canvas id="weeklyChart"></canvas>
                </div>
            </div>

            <!-- Progress Section -->
            <div class="progress-section">
                <h3 class="progress-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="m9 12 2 2 4-4"/>
                    </svg>
                    Goals & Targets
                </h3>
                <div class="progress-item">
                    <div class="progress-header">
                        <span class="progress-label">Daily Target (4 hours)</span>
                        <span class="progress-percentage">${Math.round((todayTime / (4 * 3600000)) * 100)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min((todayTime / (4 * 3600000)) * 100, 100)}%"></div>
                    </div>
                </div>
                <div class="progress-item">
                    <div class="progress-header">
                        <span class="progress-label">Weekly Target (28 hours)</span>
                        <span class="progress-percentage">${Math.round((weeklyTotal / (28 * 3600000)) * 100)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min((weeklyTotal / (28 * 3600000)) * 100, 100)}%"></div>
                    </div>
                </div>
            </div>

            <!-- Session Info -->
            <div class="session-grid">
                <div class="session-card">
                    <div class="session-header">Current Session</div>
                    <div class="session-value active" id="currentSession">
                        ${sessionStart ? formatTime(Date.now() - sessionStart) : '0h 0m 0s'}
                    </div>
                </div>
                <div class="session-card">
                    <div class="session-header">Today Total</div>
                    <div class="session-value daily">${formatTime(todayTime)}</div>
                </div>
                <div class="session-card">
                    <div class="session-header">Weekly Total</div>
                    <div class="session-value weekly">${formatTime(weeklyTotal)}</div>
                </div>
            </div>

            <!-- Achievements -->
            <div class="progress-section">
                <h3 class="progress-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="8" r="7"/>
                        <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/>
                    </svg>
                    Achievements
                </h3>
                <div class="achievements-grid">
                    <div class="achievement ${currentTotal >= 3600000 ? 'unlocked' : 'locked'}">
                        <div class="achievement-icon">🌱</div>
                        <div class="achievement-label">First Hour</div>
                    </div>
                    <div class="achievement ${streak >= 3 ? 'unlocked' : 'locked'}">
                        <div class="achievement-icon">🔥</div>
                        <div class="achievement-label">On Fire</div>
                    </div>
                    <div class="achievement ${todayTime >= 8 * 3600000 ? 'unlocked' : 'locked'}">
                        <div class="achievement-icon">⚡</div>
                        <div class="achievement-label">Marathon</div>
                    </div>
                    <div class="achievement ${streak >= 7 ? 'unlocked' : 'locked'}">
                        <div class="achievement-icon">🎯</div>
                        <div class="achievement-label">Consistent</div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            function formatTime(ms) {
                const hours = Math.floor(ms / 3600000);
                const minutes = Math.floor((ms % 3600000) / 60000);
                const seconds = Math.floor((ms % 60000) / 1000);
                return hours > 0 ? \`\${hours}h \${minutes}m \${seconds}s\` : \`\${minutes}m \${seconds}s\`;
            }

            function formatTimeShort(ms) {
                const hours = Math.floor(ms / 3600000);
                const minutes = Math.floor((ms % 3600000) / 60000);
                return hours > 0 ? \`\${hours}h \${minutes}m\` : \`\${minutes}m\`;
            }

            function updateCurrentTime() {
                document.getElementById('currentTime').textContent = new Date().toLocaleString();
            }

            function refreshData() {
                window.location.reload();
            }

            function exportData() {
                const data = {
                    totalTime: ${currentTotal},
                    todayTime: ${todayTime},
                    weeklyTime: ${weeklyTotal},
                    streak: ${streak},
                    dailyTimes: ${JSON.stringify(dailyTimes)}
                };
                console.log('Export data:', JSON.stringify(data, null, 2));
                alert('Data logged to console (in VS Code, check Developer Tools)');
            }

            // Initialize chart
            function initChart() {
                const canvas = document.getElementById('weeklyChart');
                const ctx = canvas.getContext('2d');
                
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ${JSON.stringify(chartLabels)},
                        datasets: [{
                            label: 'Hours Coded',
                            data: ${JSON.stringify(chartValues)},
                            borderColor: '#2563eb',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointBackgroundColor: '#2563eb',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                titleColor: '#f8fafc',
                                bodyColor: '#f8fafc',
                                borderColor: '#334155',
                                borderWidth: 1,
                                cornerRadius: 8,
                                displayColors: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: { 
                                    color: '#e2e8f0',
                                    drawBorder: false
                                },
                                ticks: { 
                                    color: '#64748b',
                                    maxTicksLimit: 6
                                }
                            },
                            x: {
                                grid: { 
                                    color: '#e2e8f0',
                                    drawBorder: false
                                },
                                ticks: { 
                                    color: '#64748b',
                                    maxRotation: 0
                                }
                            }
                        },
                        animation: {
                            duration: 1500,
                            easing: 'easeOutQuart'
                        }
                    }
                });
            }

            // Initialize
            updateCurrentTime();
            setInterval(updateCurrentTime, 1000);
            
            // Update current session time if active
            ${sessionStart ? `
            function updateCurrentSession() {
                const sessionTime = Date.now() - ${sessionStart};
                document.getElementById('currentSession').textContent = formatTime(sessionTime);
            }
            setInterval(updateCurrentSession, 1000);
            ` : ''}
            
            // Initialize chart after a short delay
            setTimeout(initChart, 100);
        </script>
    </body>
    </html>
    `;
}

function formatTime(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function formatTimeShort(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

module.exports = { showDashboard };