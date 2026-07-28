// app.js

// Global State
let currentPlayer = 'Lucas';
let selectedSeason = 'All';
let teamQuery = '';
let rivalQuery = '';
let currentPage = 1;
const itemsPerPage = 10;

// Parsed Data Cache
let lucasMatches = [];
let tommyMatches = [];
let activeMatches = []; // Current filtered matches for active player

// Chart instances
let outcomeChartInstance = null;
let divisionChartInstance = null;
let compareWinrateChartInstance = null;
let compareGoalsChartInstance = null;

// Initialize Application
function initApp() {
    // Set custom Chart.js defaults for dark theme
    if (typeof Chart !== 'undefined') {
        Chart.defaults.color = '#9ca3af';
        Chart.defaults.font.family = "'Outfit', sans-serif";
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10, 13, 20, 0.95)';
        Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.titleColor = '#fff';
        Chart.defaults.plugins.tooltip.bodyColor = '#f3f4f6';
        Chart.defaults.plugins.tooltip.padding = 10;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
    }
    
    // Parse data from FIFA_DATA (loaded from data.js)
    lucasMatches = parsePlayerData('Lucas');
    tommyMatches = parsePlayerData('Tommy');
    
    // Set initial view
    switchPlayer('Lucas');
}

// Run initialization immediately if DOM is ready, otherwise wait for event
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Parse Excel rows into clean objects
function parsePlayerData(playerName) {
    const rawRows = FIFA_DATA[playerName];
    if (!rawRows || rawRows.length <= 2) return [];
    
    const dataRows = rawRows.slice(2);
    
    return dataRows.map((row, index) => {
        // Skip empty or invalid rows
        if (!row || row.length < 5 || !row[0] || row[0] === '') return null;
        
        const season = parseInt(row[0]);
        if (isNaN(season)) return null;
        
        const team = row[1] ? String(row[1]).trim() : 'Desconocido';
        const rival = row[2] ? String(row[2]).trim() : 'Desconocido';
        const score = row[3] ? String(row[3]).trim() : '0 a 0';
        const outcome = row[4] ? String(row[4]).trim() : 'Empate';
        const date = row[5] ? String(row[5]).trim() : '';
        const points = parseInt(row[6]);
        const division = parseInt(row[7]);
        
        // Parse score "X a Y"
        let gf = 0;
        let gc = 0;
        const scoreParts = score.toLowerCase().split(/\s+a\s+/);
        if (scoreParts.length === 2) {
            gf = parseInt(scoreParts[0]) || 0;
            gc = parseInt(scoreParts[1]) || 0;
        } else {
            // Fallback score parsing in case of different format
            const numbers = score.match(/\d+/g);
            if (numbers && numbers.length >= 2) {
                gf = parseInt(numbers[0]) || 0;
                gc = parseInt(numbers[1]) || 0;
            }
        }
        
        const extra = row[8] ? String(row[8]).trim() : '';
        
        return {
            id: index,
            season,
            team,
            rival,
            score,
            outcome: sanitizeOutcome(outcome),
            date,
            points: isNaN(points) ? (outcome.toLowerCase().startsWith('vic') ? 3 : (outcome.toLowerCase().startsWith('emp') ? 1 : 0)) : points,
            division: isNaN(division) ? 10 : division,
            gf,
            gc,
            extra,
            isWalkover: playerName === 'Tommy' && extra.toLowerCase() === 'si'
        };
    }).filter(row => row !== null);
}

// Ensure outcome text is standard (Victoria, Derrota, Empate)
function sanitizeOutcome(outcome) {
    const lower = outcome.toLowerCase().trim();
    if (lower.startsWith('vic')) return 'Victoria';
    if (lower.startsWith('der') || lower.startsWith('per')) return 'Derrota';
    return 'Empate';
}

// Switch between Player tabs or Comparison view
function switchPlayer(player) {
    currentPlayer = player;
    
    // Update active tab styling
    document.querySelectorAll('.player-btn').forEach(btn => btn.classList.remove('active'));
    if (player === 'Lucas') {
        document.getElementById('btn-player-lucas').classList.add('active');
    } else if (player === 'Tommy') {
        document.getElementById('btn-player-tommy').classList.add('active');
    } else {
        document.getElementById('btn-player-compare').classList.add('active');
    }
    
    const filtersSection = document.getElementById('filters-section');
    const playerDashboard = document.getElementById('player-dashboard-view');
    const comparisonView = document.getElementById('comparison-view');
    
    if (player === 'Comparativa') {
        filtersSection.style.display = 'none';
        playerDashboard.style.display = 'none';
        comparisonView.style.display = 'block';
        
        renderComparisonView();
    } else {
        filtersSection.style.display = 'flex';
        playerDashboard.style.display = 'block';
        comparisonView.style.display = 'none';
        
        // Reset filter states for new player
        selectedSeason = 'All';
        teamQuery = '';
        rivalQuery = '';
        currentPage = 1;
        document.getElementById('team-search-input').value = '';
        document.getElementById('rival-search-input').value = '';
        
        renderSeasonFilters();
        updateDashboardData();
    }
}

// Render dynamic Season filter buttons
function renderSeasonFilters() {
    const container = document.getElementById('season-filters-container');
    container.innerHTML = '';
    
    const matches = currentPlayer === 'Lucas' ? lucasMatches : tommyMatches;
    
    // Extract unique seasons
    const seasons = [...new Set(matches.map(m => m.season))].sort((a, b) => a - b);
    
    // "All" Button
    const allBtn = document.createElement('button');
    allBtn.className = `season-btn ${selectedSeason === 'All' ? 'active' : ''}`;
    allBtn.innerText = 'Todas';
    allBtn.onclick = () => filterBySeason('All');
    container.appendChild(allBtn);
    
    // Individual Season Buttons
    seasons.forEach(season => {
        const btn = document.createElement('button');
        btn.className = `season-btn ${selectedSeason === season ? 'active' : ''}`;
        btn.innerText = `Temp ${season}`;
        btn.onclick = () => filterBySeason(season);
        container.appendChild(btn);
    });
}

function filterBySeason(season) {
    selectedSeason = season;
    currentPage = 1;
    
    // Update active state in UI
    document.querySelectorAll('.season-btn').forEach(btn => {
        if (btn.innerText === 'Todas' && season === 'All') {
            btn.classList.add('active');
        } else if (btn.innerText === `Temp ${season}`) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    updateDashboardData();
}

function handleFilterChange() {
    teamQuery = document.getElementById('team-search-input').value.toLowerCase().trim();
    rivalQuery = document.getElementById('rival-search-input').value.toLowerCase().trim();
    currentPage = 1;
    updateDashboardData();
}

// Filter, calculate stats, and update charts/tables
function updateDashboardData() {
    const rawMatches = currentPlayer === 'Lucas' ? lucasMatches : tommyMatches;
    
    // Filter matches
    activeMatches = rawMatches.filter(match => {
        // Season filter
        if (selectedSeason !== 'All' && match.season !== selectedSeason) {
            return false;
        }
        // My Team filter
        if (teamQuery !== '' && !match.team.toLowerCase().includes(teamQuery)) {
            return false;
        }
        // Rival filter
        if (rivalQuery !== '' && !match.rival.toLowerCase().includes(rivalQuery)) {
            return false;
        }
        return true;
    });
    
    // Render parts of dashboard
    renderKPIs();
    renderCharts();
    renderTables();
    renderMatchLog();
}

// Calculate and render KPI Cards
function renderKPIs() {
    const container = document.getElementById('kpi-grid-container');
    container.innerHTML = '';
    
    const total = activeMatches.length;
    
    if (total === 0) {
        container.innerHTML = `<div class="no-data" style="grid-column: 1 / -1;">No hay partidos que coincidan con los filtros.</div>`;
        return;
    }
    
    const wins = activeMatches.filter(m => m.outcome === 'Victoria').length;
    const draws = activeMatches.filter(m => m.outcome === 'Empate').length;
    const losses = activeMatches.filter(m => m.outcome === 'Derrota').length;
    
    const winRate = ((wins / total) * 100).toFixed(1);
    
    // Points efficiency (Standard Football Efficiency)
    const pointsEarned = activeMatches.reduce((sum, m) => sum + m.points, 0);
    const maxPoints = total * 3;
    const efficiency = ((pointsEarned / maxPoints) * 100).toFixed(1);
    
    const gf = activeMatches.reduce((sum, m) => sum + m.gf, 0);
    const gc = activeMatches.reduce((sum, m) => sum + m.gc, 0);
    const diff = gf - gc;
    const diffSign = diff > 0 ? '+' : '';
    
    const avgGf = (gf / total).toFixed(1);
    const avgGc = (gc / total).toFixed(1);
    
    // Find highest division reached in this dataset
    const divisions = activeMatches.map(m => m.division).filter(d => !isNaN(d) && d > 0);
    const bestDiv = divisions.length > 0 ? Math.min(...divisions) : '-'; // 1 is best, 10 is worst
    
    const kpiData = [
        {
            title: 'Partidos Jugados',
            value: total,
            footer: `${wins} V &bull; ${draws} E &bull; ${losses} D`,
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path><path d="M2 12h20"></path></svg>`
        },
        {
            title: 'Efectividad de Puntos',
            value: `${efficiency}%`,
            footer: `${pointsEarned} de ${maxPoints} pts posibles`,
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
        },
        {
            title: 'Goles Realizados / Contra',
            value: `${gf} : ${gc}`,
            footer: `Diferencia: ${diffSign}${diff}`,
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`
        },
        {
            title: 'Mejor División',
            value: bestDiv === '-' ? '-' : `Div ${bestDiv}`,
            footer: selectedSeason === 'All' ? 'Historial completo' : `Temporada ${selectedSeason}`,
            icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>`
        }
    ];
    
    kpiData.forEach(kpi => {
        const card = document.createElement('div');
        card.className = 'kpi-card';
        card.innerHTML = `
            <div class="kpi-header">
                <span>${kpi.title}</span>
                <div class="kpi-icon-container">${kpi.icon}</div>
            </div>
            <div class="kpi-value">${kpi.value}</div>
            <div class="kpi-footer">${kpi.footer}</div>
        `;
        container.appendChild(card);
    });
}

// Render dynamic charts (Doughnut & Line)
function renderCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js no está cargado. Se omitirá el renderizado de gráficos.');
        return;
    }
    // 1. Outcome Doughnut Chart
    const wins = activeMatches.filter(m => m.outcome === 'Victoria').length;
    const draws = activeMatches.filter(m => m.outcome === 'Empate').length;
    const losses = activeMatches.filter(m => m.outcome === 'Derrota').length;
    
    const ctxOutcome = document.getElementById('outcome-chart').getContext('2d');
    if (outcomeChartInstance) outcomeChartInstance.destroy();
    
    if (activeMatches.length === 0) {
        // Chart container will show empty
        return;
    }
    
    outcomeChartInstance = new Chart(ctxOutcome, {
        type: 'doughnut',
        data: {
            labels: ['Victorias', 'Empates', 'Derrotas'],
            datasets: [{
                data: [wins, draws, losses],
                backgroundColor: [
                    '#10b981', // green
                    '#f59e0b', // amber
                    '#ef4444'  // red
                ],
                borderColor: '#0a0d14',
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: { size: 12, weight: '500' }
                    }
                }
            },
            cutout: '65%'
        }
    });
    
    // 2. Division Line Chart
    // Sort matches chronologically to show evolution (matches are recorded top-to-bottom in Excel, so we keep order)
    const divisionData = activeMatches.map((m, idx) => ({
        x: idx + 1,
        y: m.division,
        season: m.season
    })).filter(pt => !isNaN(pt.y) && pt.y > 0);
    
    const ctxDiv = document.getElementById('division-chart').getContext('2d');
    if (divisionChartInstance) divisionChartInstance.destroy();
    
    divisionChartInstance = new Chart(ctxDiv, {
        type: 'line',
        data: {
            labels: divisionData.map(pt => `Part ${pt.x} (T${pt.season})`),
            datasets: [{
                label: 'División (Menor es mejor)',
                data: divisionData.map(pt => pt.y),
                borderColor: '#00f0ff',
                backgroundColor: 'rgba(0, 240, 255, 0.05)',
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#00f0ff',
                pointBorderColor: '#0a0d14',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    reverse: true, // Division 1 is top, 10 is bottom
                    min: 1,
                    max: 10,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return 'Div ' + value;
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 12
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Generate statistics tables (Teams & Rivals)
function renderTables() {
    // 1. Rendimiento por Equipo
    const teamStats = {};
    activeMatches.forEach(match => {
        const team = match.team;
        if (!teamStats[team]) {
            teamStats[team] = { name: team, pj: 0, wins: 0, draws: 0, losses: 0, gf: 0, gc: 0, points: 0 };
        }
        const s = teamStats[team];
        s.pj++;
        s.gf += match.gf;
        s.gc += match.gc;
        s.points += match.points;
        if (match.outcome === 'Victoria') s.wins++;
        else if (match.outcome === 'Empate') s.draws++;
        else if (match.outcome === 'Derrota') s.losses++;
    });
    
    const sortedTeams = Object.values(teamStats).sort((a, b) => b.points - a.points || b.pj - a.pj);
    const teamsBody = document.getElementById('teams-stats-body');
    teamsBody.innerHTML = '';
    
    if (sortedTeams.length === 0) {
        teamsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-text-muted);">Sin datos de equipos</td></tr>`;
    } else {
        sortedTeams.slice(0, 5).forEach(team => {
            const eff = ((team.points / (team.pj * 3)) * 100).toFixed(0);
            const diff = team.gf - team.gc;
            const diffSign = diff > 0 ? '+' : '';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600;">${team.name}</td>
                <td style="text-align: center;">${team.pj}</td>
                <td style="text-align: center; color: var(--color-text-muted); font-size:0.85rem;">${team.wins} - ${team.draws} - ${team.losses}</td>
                <td style="text-align: center; font-weight:600; color: ${eff >= 50 ? 'var(--color-win)' : 'var(--color-text-main)'}">${eff}%</td>
                <td style="text-align: center;">${team.gf}:${team.gc} <span style="font-size:0.75rem; color:${diff >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}">(${diffSign}${diff})</span></td>
            `;
            teamsBody.appendChild(tr);
        });
    }
    
    // 2. Rendimiento por Rival
    const rivalStats = {};
    activeMatches.forEach(match => {
        const rival = match.rival;
        if (!rivalStats[rival]) {
            rivalStats[rival] = { name: rival, pj: 0, wins: 0, draws: 0, losses: 0, gf: 0, gc: 0, points: 0 };
        }
        const s = rivalStats[rival];
        s.pj++;
        s.gf += match.gf;
        s.gc += match.gc;
        s.points += match.points;
        if (match.outcome === 'Victoria') s.wins++;
        else if (match.outcome === 'Empate') s.draws++;
        else if (match.outcome === 'Derrota') s.losses++;
    });
    
    // We sort rivals:
    // To list nemesis vs clients:
    // Clients: High win rate, Nemesis: Low win rate.
    // Let's list the top rivals by matches played to keep it relevant, and order them by points efficiency.
    const sortedRivals = Object.values(rivalStats).sort((a, b) => b.pj - a.pj || a.points - b.points);
    const rivalsBody = document.getElementById('rivals-stats-body');
    rivalsBody.innerHTML = '';
    
    if (sortedRivals.length === 0) {
        rivalsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-text-muted);">Sin datos de rivales</td></tr>`;
    } else {
        // Let's show the top 5 rivals with their stats
        sortedRivals.slice(0, 5).forEach(rival => {
            const eff = ((rival.points / (rival.pj * 3)) * 100).toFixed(0);
            const diff = rival.gf - rival.gc;
            const diffSign = diff > 0 ? '+' : '';
            
            // Define indicator based on efficiency
            let statusBadge = '';
            if (eff >= 65) {
                statusBadge = '<span class="winner-pill" style="background:rgba(16,185,129,0.15); color:var(--color-win); margin-left:0;">CLIENTE</span>';
            } else if (eff <= 35) {
                statusBadge = '<span class="winner-pill" style="background:rgba(239,68,68,0.15); color:var(--color-loss); margin-left:0;">NÉMESIS</span>';
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600; display:flex; flex-direction:column; gap:0.25rem;">
                    <span>${rival.name}</span>
                    ${statusBadge ? `<div>${statusBadge}</div>` : ''}
                </td>
                <td style="text-align: center;">${rival.pj}</td>
                <td style="text-align: center; color: var(--color-text-muted); font-size:0.85rem;">${rival.wins} - ${rival.draws} - ${rival.losses}</td>
                <td style="text-align: center; font-weight:600; color: ${eff >= 50 ? 'var(--color-win)' : (eff < 35 ? 'var(--color-loss)' : 'var(--color-text-main)')}">${eff}%</td>
                <td style="text-align: center;">${rival.gf}:${rival.gc} <span style="font-size:0.75rem; color:${diff >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}">(${diffSign}${diff})</span></td>
            `;
            rivalsBody.appendChild(tr);
        });
    }
}

// Render paginated match log list
function renderMatchLog() {
    const total = activeMatches.length;
    document.getElementById('log-count-badge').innerText = `${total} partido${total !== 1 ? 's' : ''}`;
    
    const body = document.getElementById('match-log-body');
    body.innerHTML = '';
    
    if (total === 0) {
        body.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-text-muted); padding: 2rem;">No se encontraron partidos.</td></tr>`;
        document.getElementById('btn-prev-page').disabled = true;
        document.getElementById('btn-next-page').disabled = true;
        document.getElementById('page-info-label').innerText = 'Página 0 de 0';
        return;
    }
    
    const totalPages = Math.ceil(total / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, total);
    
    // Sort matches in reverse chronological order (newest first)
    const sortedLogMatches = [...activeMatches].reverse();
    const pagedMatches = sortedLogMatches.slice(startIndex, endIndex);
    
    pagedMatches.forEach(match => {
        const badgeClass = match.outcome === 'Victoria' ? 'badge-win' : (match.outcome === 'Derrota' ? 'badge-loss' : 'badge-draw');
        
        let extraInfo = '';
        if (currentPlayer === 'Lucas') {
            extraInfo = match.extra ? `<span class="event-info">${match.extra}</span>` : '-';
        } else {
            extraInfo = match.isWalkover ? `<span class="badge badge-loss" style="font-size:0.65rem;">W.O.</span>` : '<span class="event-info">Normal</span>';
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge badge-draw" style="background:rgba(255,255,255,0.03); color:var(--color-text-main); font-weight:600;">T${match.season}</span></td>
            <td style="color: var(--color-text-muted); font-size:0.85rem;">${match.date || '-'}</td>
            <td style="font-weight: 600;">${match.team}</td>
            <td style="font-weight: 500;">${match.rival}</td>
            <td style="text-align: center;" class="score-cell">${match.score}</td>
            <td style="text-align: center;"><span class="badge ${badgeClass}">${match.outcome}</span></td>
            <td style="text-align: center; font-weight:600; color:var(--color-primary);">Div ${match.division}</td>
            <td style="text-align: center;">${extraInfo}</td>
        `;
        body.appendChild(tr);
    });
    
    // Update pagination controls
    document.getElementById('btn-prev-page').disabled = currentPage === 1;
    document.getElementById('btn-next-page').disabled = currentPage === totalPages;
    document.getElementById('page-info-label').innerText = `Página ${currentPage} de ${totalPages}`;
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderMatchLog();
    }
}

function nextPage() {
    const totalPages = Math.ceil(activeMatches.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderMatchLog();
    }
}

// Compare Lucas vs Tommy metrics
function renderComparisonView() {
    const lucasTotal = lucasMatches.length;
    const tommyTotal = tommyMatches.length;
    
    const lucasWins = lucasMatches.filter(m => m.outcome === 'Victoria').length;
    const lucasDraws = lucasMatches.filter(m => m.outcome === 'Empate').length;
    const lucasLosses = lucasMatches.filter(m => m.outcome === 'Derrota').length;
    const lucasPoints = lucasMatches.reduce((sum, m) => sum + m.points, 0);
    const lucasEff = lucasTotal > 0 ? ((lucasPoints / (lucasTotal * 3)) * 100).toFixed(1) : 0;
    
    const tommyWins = tommyMatches.filter(m => m.outcome === 'Victoria').length;
    const tommyDraws = tommyMatches.filter(m => m.outcome === 'Empate').length;
    const tommyLosses = tommyMatches.filter(m => m.outcome === 'Derrota').length;
    const tommyPoints = tommyMatches.reduce((sum, m) => sum + m.points, 0);
    const tommyEff = tommyTotal > 0 ? ((tommyPoints / (tommyTotal * 3)) * 100).toFixed(1) : 0;
    
    const lucasGf = lucasMatches.reduce((sum, m) => sum + m.gf, 0);
    const lucasGc = lucasMatches.reduce((sum, m) => sum + m.gc, 0);
    const lucasAvgGf = lucasTotal > 0 ? (lucasGf / lucasTotal).toFixed(2) : 0;
    const lucasAvgGc = lucasTotal > 0 ? (lucasGc / lucasTotal).toFixed(2) : 0;
    const lucasDiff = lucasGf - lucasGc;
    
    const tommyGf = tommyMatches.reduce((sum, m) => sum + m.gf, 0);
    const tommyGc = tommyMatches.reduce((sum, m) => sum + m.gc, 0);
    const tommyAvgGf = tommyTotal > 0 ? (tommyGf / tommyTotal).toFixed(2) : 0;
    const tommyAvgGc = tommyTotal > 0 ? (tommyGc / tommyTotal).toFixed(2) : 0;
    const tommyDiff = tommyGf - tommyGc;
    
    const lucasDivs = lucasMatches.map(m => m.division).filter(d => !isNaN(d) && d > 0);
    const lucasBestDiv = lucasDivs.length > 0 ? Math.min(...lucasDivs) : 10;
    
    const tommyDivs = tommyMatches.map(m => m.division).filter(d => !isNaN(d) && d > 0);
    const tommyBestDiv = tommyDivs.length > 0 ? Math.min(...tommyDivs) : 10;
    
    // Compare and highlight winners
    const effWinner = parseFloat(lucasEff) > parseFloat(tommyEff) ? 'Lucas' : (parseFloat(lucasEff) < parseFloat(tommyEff) ? 'Tommy' : 'Tie');
    const goalsWinner = parseFloat(lucasAvgGf) > parseFloat(tommyAvgGf) ? 'Lucas' : (parseFloat(lucasAvgGf) < parseFloat(tommyAvgGf) ? 'Tommy' : 'Tie');
    const defenseWinner = parseFloat(lucasAvgGc) < parseFloat(tommyAvgGc) ? 'Lucas' : (parseFloat(lucasAvgGc) > parseFloat(tommyAvgGc) ? 'Tommy' : 'Tie'); // lower is better
    const divWinner = lucasBestDiv < tommyBestDiv ? 'Lucas' : (lucasBestDiv > tommyBestDiv ? 'Tommy' : 'Tie'); // lower is better
    
    const container = document.getElementById('comparison-grid-container');
    container.innerHTML = `
        <!-- Lucas Panel -->
        <div class="compare-card lucas">
            <div class="compare-name">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--color-primary);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                Lucas
            </div>
            
            <div class="compare-stat-row">
                <span class="compare-stat-label">Partidos Jugados</span>
                <span class="compare-stat-value">${lucasTotal}</span>
            </div>
            
            <div class="compare-stat-row">
                <span class="compare-stat-label">Historial (V - E - D)</span>
                <span class="compare-stat-value" style="color: var(--color-text-muted);">${lucasWins} - ${lucasDraws} - ${lucasLosses}</span>
            </div>
            
            <div class="compare-stat-row">
                <span class="compare-stat-label">Efectividad de Puntos</span>
                <span class="compare-stat-value" style="color: ${effWinner === 'Lucas' ? 'var(--color-win)' : 'inherit'}; font-weight:700;">
                    ${lucasEff}%
                    ${effWinner === 'Lucas' ? '<span class="winner-pill">MEJOR</span>' : ''}
                </span>
            </div>
            
            <div class="compare-stat-row">
                <span class="compare-stat-label">Promedio Goles Realizados</span>
                <span class="compare-stat-value" style="color: ${goalsWinner === 'Lucas' ? 'var(--color-win)' : 'inherit'};">
                    ${lucasAvgGf}
                    ${goalsWinner === 'Lucas' ? '<span class="winner-pill">MEJOR</span>' : ''}
                </span>
            </div>
            
            <div class="compare-stat-row">
                <span class="compare-stat-label">Promedio Goles Recibidos</span>
                <span class="compare-stat-value" style="color: ${defenseWinner === 'Lucas' ? 'var(--color-win)' : 'inherit'};">
                    ${lucasAvgGc}
                    ${defenseWinner === 'Lucas' ? '<span class="winner-pill">MEJOR</span>' : ''}
                </span>
            </div>
            
            <div class="compare-stat-row">
                <span class="compare-stat-label">Diferencia de Goles</span>
                <span class="compare-stat-value" style="color: ${lucasDiff >= 0 ? 'var(--color-win)' : 'var(--color-loss)'};">
                    ${lucasDiff > 0 ? '+' : ''}${lucasDiff}
                </span>
            </div>
            
            <div class="compare-stat-row">
                <span class="compare-stat-label">Mejor División Alcanzada</span>
                <span class="compare-stat-value" style="color: ${divWinner === 'Lucas' ? 'var(--color-primary)' : 'inherit'}; font-weight:700;">
                    Div ${lucasBestDiv}
                    ${divWinner === 'Lucas' ? '<span class="winner-pill" style="color: var(--color-primary); border-color: rgba(0, 240, 255, 0.3); background: rgba(0, 240, 255, 0.1);">MEJOR</span>' : ''}
                </span>
            </div>
        </div>
        
        <!-- Tommy Panel -->
        <div class="compare-card tommy">
            <div class="compare-name">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--color-secondary);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                Tommy
            </div>
            
            <div class="compare-stat-row">
                <span class="compare-stat-label">Partidos Jugados</span>
                <span class="compare-stat-value">${tommyTotal}</span>
            </div>
            
            <div class="compare-stat-row">
                <span class="compare-stat-label">Historial (V - E - D)</span>
                <span class="compare-stat-value" style="color: var(--color-text-muted);">${tommyWins} - ${tommyDraws} - ${tommyLosses}</span>
            </div>
            
            <div class="compare-stat-row">
                <span class="compare-stat-label">Efectividad de Puntos</span>
                <span class="compare-stat-value" style="color: ${effWinner === 'Tommy' ? 'var(--color-win)' : 'inherit'}; font-weight:700;">
                    ${tommyEff}%
                    ${effWinner === 'Tommy' ? '<span class="winner-pill">MEJOR</span>' : ''}
                </span>
            </div>
            
            <div class="compare-stat-row">
                <span class="compare-stat-label">Promedio Goles Realizados</span>
                <span class="compare-stat-value" style="color: ${goalsWinner === 'Tommy' ? 'var(--color-win)' : 'inherit'};">
                    ${tommyAvgGf}
                    ${goalsWinner === 'Tommy' ? '<span class="winner-pill">MEJOR</span>' : ''}
                </span>
            </div>
            
            <div class="compare-stat-row">
                <span class="compare-stat-label">Promedio Goles Recibidos</span>
                <span class="compare-stat-value" style="color: ${defenseWinner === 'Tommy' ? 'var(--color-win)' : 'inherit'};">
                    ${tommyAvgGc}
                    ${defenseWinner === 'Tommy' ? '<span class="winner-pill">MEJOR</span>' : ''}
                </span>
            </div>
            
            <div class="compare-stat-row">
                <span class="compare-stat-label">Diferencia de Goles</span>
                <span class="compare-stat-value" style="color: ${tommyDiff >= 0 ? 'var(--color-win)' : 'var(--color-loss)'};">
                    ${tommyDiff > 0 ? '+' : ''}${tommyDiff}
                </span>
            </div>
            
            <div class="compare-stat-row">
                <span class="compare-stat-label">Mejor División Alcanzada</span>
                <span class="compare-stat-value" style="color: ${divWinner === 'Tommy' ? 'var(--color-secondary)' : 'inherit'}; font-weight:700;">
                    Div ${tommyBestDiv}
                    ${divWinner === 'Tommy' ? '<span class="winner-pill" style="color: var(--color-secondary); border-color: rgba(168, 85, 247, 0.3); background: rgba(168, 85, 247, 0.1);">MEJOR</span>' : ''}
                </span>
            </div>
        </div>
    `;
    
    // Render Comparative Charts (only if Chart is loaded)
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js no está cargado. Se omitirá el renderizado de gráficos comparativos.');
        return;
    }

    const ctxWinrate = document.getElementById('compare-winrate-chart').getContext('2d');
    if (compareWinrateChartInstance) compareWinrateChartInstance.destroy();
    
    const lucasWinRate = ((lucasWins / lucasTotal) * 100).toFixed(0);
    const lucasDrawRate = ((lucasDraws / lucasTotal) * 100).toFixed(0);
    const lucasLossRate = ((lucasLosses / lucasTotal) * 100).toFixed(0);
    
    const tommyWinRate = ((tommyWins / tommyTotal) * 100).toFixed(0);
    const tommyDrawRate = ((tommyDraws / tommyTotal) * 100).toFixed(0);
    const tommyLossRate = ((tommyLosses / tommyTotal) * 100).toFixed(0);
    
    compareWinrateChartInstance = new Chart(ctxWinrate, {
        type: 'bar',
        data: {
            labels: ['Victorias (%)', 'Empates (%)', 'Derrotas (%)'],
            datasets: [
                {
                    label: 'Lucas',
                    data: [lucasWinRate, lucasDrawRate, lucasLossRate],
                    backgroundColor: 'rgba(0, 240, 255, 0.85)',
                    borderColor: '#00f0ff',
                    borderWidth: 1.5,
                    borderRadius: 6
                },
                {
                    label: 'Tommy',
                    data: [tommyWinRate, tommyDrawRate, tommyLossRate],
                    backgroundColor: 'rgba(168, 85, 247, 0.85)',
                    borderColor: '#a855f7',
                    borderWidth: 1.5,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) { return value + '%'; }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
    
    const ctxGoals = document.getElementById('compare-goals-chart').getContext('2d');
    if (compareGoalsChartInstance) compareGoalsChartInstance.destroy();
    
    compareGoalsChartInstance = new Chart(ctxGoals, {
        type: 'bar',
        data: {
            labels: ['Goles Realizados (Prom.)', 'Goles Recibidos (Prom.)'],
            datasets: [
                {
                    label: 'Lucas',
                    data: [lucasAvgGf, lucasAvgGc],
                    backgroundColor: 'rgba(0, 240, 255, 0.85)',
                    borderColor: '#00f0ff',
                    borderWidth: 1.5,
                    borderRadius: 6
                },
                {
                    label: 'Tommy',
                    data: [tommyAvgGf, tommyAvgGc],
                    backgroundColor: 'rgba(168, 85, 247, 0.85)',
                    borderColor: '#a855f7',
                    borderWidth: 1.5,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}
