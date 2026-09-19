/* =========================================================
   ALEXANDRE CYBER ACADEMY - SCRIPT 2.0 (5ème)
   Cybersécurité, IA Tuteur & Analytique Scolaire
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    let chatHistory = [];
    let messageCount = 0;
    let activeSpreadsheetId = null; // Stocke l'ID renvoyé par n8n

    function generateSessionId() {
        return 'cyber_session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    let sessionId = generateSessionId();
    console.log("Console Initialisée - Session ID:", sessionId);
    // Session timer & evaluation state
    let sessionStartTime = null;
    let sessionInterval = null;
    let isTimerPaused = false;
    let elapsedSeconds = 0;
    let sessionCharacters = 0; // Caractères tapés durant la session active

    // === GLOBAL REFS & CHARTS ===
    let progressionChart = null;
    let distributionChart = null;
    let activityChart = null;
    let radarChart = null;
    let cachedAllGrades = [];
    let currentSortColumn = 'date';
    let currentSortDirection = 'desc';
    let currentTableType = 'all'; // 'all' | 'ecole' | 'maison'
    let currentRadarSource = 'ecole'; // 'ecole' | 'maison' | 'all'
    let selectedSchoolYear = 'all';
    let currentProgressionMode = 'monthly'; // 'monthly' | 'recent'
    let currentProgressionSubject = 'all';
    const rewardGoalMinutes = 60;
    const rewardStorageKey = 'alexandre-playstation-rewards';
    let rewardState = loadRewardState();
    const gradeForm = document.getElementById('grade-form');
    const gradesTbody = document.getElementById('grades-tbody');
    const recentGradesList = document.getElementById('recent-grades-list');

    function getRewardWeekKey(date = new Date()) {
        const monday = new Date(date);
        monday.setHours(0, 0, 0, 0);
        const daysSinceMonday = (monday.getDay() + 6) % 7;
        monday.setDate(monday.getDate() - daysSinceMonday);
        return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    }

    function loadRewardState() {
        try {
            const saved = JSON.parse(localStorage.getItem(rewardStorageKey) || 'null');
            const cleanState = state => {
                const history = state.history.filter(item => {
                    if (item.kind !== 'homework') return true;
                    const match = String(item.detail || '').match(/([0-9]+(?:[.,][0-9]+)?)\s*\/\s*20/);
                    return !match || parseFloat(match[1].replace(',', '.')) > 12;
                });
                const removedMinutes = state.history
                    .filter(item => !history.includes(item))
                    .reduce((total, item) => total + Math.max(0, Number(item.minutes) || 0), 0);
                const cleanedState = {
                    ...state,
                    history,
                    minutes: Math.max(0, (Number(state.minutes) || 0) - removedMinutes)
                };
                if (cleanedState.minutes !== state.minutes || history.length !== state.history.length) {
                    localStorage.setItem(rewardStorageKey, JSON.stringify(cleanedState));
                }
                return cleanedState;
            };
            if (saved && saved.week === getRewardWeekKey() && Array.isArray(saved.history)) return cleanState(saved);
            if (saved && saved.day && getRewardWeekKey(new Date(`${saved.day}T12:00:00`)) === getRewardWeekKey() && Array.isArray(saved.history)) {
                return cleanState({ week: getRewardWeekKey(), minutes: saved.minutes || 0, history: saved.history });
            }
        } catch (error) {
            console.warn('Impossible de charger le contrat de jeu:', error);
        }
        return { week: getRewardWeekKey(), minutes: 0, history: [] };
    }

    function saveRewardState() {
        localStorage.setItem(rewardStorageKey, JSON.stringify(rewardState));
    }

    function formatPlaytime(minutes) {
        const safeMinutes = Math.max(0, Math.round(minutes));
        return `${String(Math.floor(safeMinutes / 60)).padStart(2, '0')}:${String(safeMinutes % 60).padStart(2, '0')}`;
    }

    function renderRewardState() {
        const minutes = Math.max(0, Math.round(rewardState.minutes));
        const percentage = Math.min(100, Math.round((minutes / rewardGoalMinutes) * 100));
        const total = document.getElementById('playtime-total');
        const clock = document.getElementById('playtime-clock');
        const fill = document.getElementById('playtime-progress-fill');
        const label = document.getElementById('playtime-progress-label');
        const message = document.getElementById('playtime-message');
        const status = document.getElementById('reward-status');
        const history = document.getElementById('reward-history');
        const count = document.getElementById('reward-history-count');
        const dashboardTotal = document.getElementById('dashboard-playtime');
        const dashboardFill = document.getElementById('dashboard-playtime-fill');
        const dashboardLabel = document.getElementById('dashboard-playtime-label');

        if (total) total.textContent = minutes;
        if (clock) clock.textContent = formatPlaytime(minutes);
        if (fill) fill.style.width = `${percentage}%`;
        if (label) label.textContent = `${percentage}%`;
        if (dashboardTotal) dashboardTotal.textContent = minutes;
        if (dashboardFill) dashboardFill.style.width = `${percentage}%`;
        if (dashboardLabel) dashboardLabel.textContent = `${minutes} / ${rewardGoalMinutes} min cette semaine`;
        if (message) message.textContent = minutes >= rewardGoalMinutes
            ? 'Objectif atteint. Le temps supplémentaire est un bonus mérité.'
            : `Encore ${rewardGoalMinutes - minutes} min pour atteindre l'objectif de la semaine.`;
        if (status) {
            status.textContent = minutes >= rewardGoalMinutes ? 'Objectif atteint' : 'En construction';
            status.classList.toggle('reward-complete', minutes >= rewardGoalMinutes);
        }
        if (count) count.textContent = `${rewardState.history.length} action${rewardState.history.length > 1 ? 's' : ''}`;
        if (history) {
            history.innerHTML = rewardState.history.length === 0
                ? '<p class="reward-empty">Aucune action enregistrée cette semaine.</p>'
                : rewardState.history.slice().reverse().map(item => `
                    <div class="reward-history-item">
                        <span class="reward-history-icon ${item.kind}"><i class="fa-solid ${item.kind === 'homework' ? 'fa-house' : 'fa-school'}"></i></span>
                        <div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></div>
                        <b class="reward-history-minutes">+${item.minutes} min</b>
                    </div>`).join('');
        }
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character]);
    }

    function addReward(minutes, kind, label, detail) {
        const safeMinutes = Math.max(0, Math.round(minutes));
        rewardState.minutes += safeMinutes;
        rewardState.history.push({ minutes: safeMinutes, kind, label, detail });
        saveRewardState();
        renderRewardState();
        return safeMinutes;
    }

    renderRewardState();

    const rewardFeedback = document.getElementById('reward-feedback');

    function rebuildRewardsFromGrades(grades) {
        const currentWeek = getRewardWeekKey();
        const history = [];

        grades
            .filter(grade => grade.dateObj && !isNaN(grade.dateObj.getTime()) && getRewardWeekKey(grade.dateObj) === currentWeek)
            .forEach(grade => {
                const note = Number(grade.normalized20);
                if (!Number.isFinite(note)) return;

                if (grade.entryType === 'maison') {
                    const minutes = note > 12 ? Math.round((note - 12) * 5) : 0;
                    if (minutes > 0) {
                        history.push({
                            minutes,
                            kind: 'homework',
                            label: `Session ${grade.matière}`,
                            detail: `${note}/20 • devoir maison terminé`
                        });
                    }
                    return;
                }

                if (grade.moyenne > 0) {
                    const difference = note - grade.normalizedAvg;
                    const minutes = Math.max(0, Math.round(difference * 5));
                    if (minutes > 0) {
                        history.push({
                            minutes,
                            kind: 'school',
                            label: `Note de ${grade.matière}`,
                            detail: `${note.toFixed(1)}/20 contre ${grade.normalizedAvg.toFixed(1)}/20 pour la classe`
                        });
                    }
                }
            });

        rewardState = {
            week: currentWeek,
            minutes: history.reduce((total, item) => total + item.minutes, 0),
            history
        };
        saveRewardState();
        renderRewardState();
    }

    const resetRewardsButton = document.getElementById('reset-rewards-btn');
    if (resetRewardsButton) {
        resetRewardsButton.addEventListener('click', () => {
            if (!confirm('Commencer une nouvelle semaine et remettre le compteur à zéro ?')) return;
            rewardState = { week: getRewardWeekKey(), minutes: 0, history: [] };
            saveRewardState();
            renderRewardState();
            if (rewardFeedback) rewardFeedback.textContent = 'Nouvelle semaine ouverte.';
        });
    }

    // === NAVIGATION ===
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    const pageTitle = document.getElementById('page-title');
    const rightSidebar = document.querySelector('.sidebar-right');

    function showView(targetId) {
        // Remove active class from all nav items
        navItems.forEach(nav => nav.classList.remove('active'));
        // Hide all views
        views.forEach(view => {
            view.classList.remove('active-view');
            view.style.display = 'none';
        });

        // Activate specific nav item
        const activeNav = document.querySelector(`.nav-item[data-target="${targetId}"]`);
        if (activeNav) activeNav.classList.add('active');

        // Show specific view
        const targetView = document.getElementById(targetId);
        if (targetView) {
            targetView.classList.add('active-view');
            targetView.style.display = 'block';
        }

        // Sidebar Visibility Logic
        const appContainer = document.querySelector('.app-container');
        if (rightSidebar) {
            if (targetId === 'dashboard') {
                rightSidebar.classList.remove('hidden-sidebar');
                rightSidebar.style.display = 'flex';
                if (appContainer) appContainer.classList.remove('no-right-sidebar');
            } else {
                rightSidebar.classList.add('hidden-sidebar');
                rightSidebar.style.display = 'none';
                if (appContainer) appContainer.classList.add('no-right-sidebar');
            }

            if (targetId === 'grades' || targetId === 'dashboard') {
                fetchGradesFromN8N();
            }
        }

        updateTitle(targetId);
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            showView(item.dataset.target);
        });
    });

    // Initial State Check
    const defaultView = document.querySelector('.nav-item.active')?.dataset.target || 'dashboard';
    showView(defaultView);

    function updateTitle(viewId) {
        const titles = {
            'dashboard': 'Centre de Contrôle',
            'chat': 'Le Professeur',
            'grades': 'Carnet de Notes & Métriques',
            'achievements': 'Défi PlayStation'
        };
        if (pageTitle) {
            pageTitle.textContent = titles[viewId] || 'Alexandre Cyber Academy';
        }
    }

    // === THEME SWITCHER (Cyber Sentinel, Matrix Lab, Quantum Light) ===
    const themeToggle = document.getElementById('theme-toggle');
    const themes = ['default', 'theme-matrix', 'theme-quantum'];
    let currentThemeIndex = 0;

    // Load saved theme
    const savedTheme = localStorage.getItem('app-cyber-theme') || 'default';
    currentThemeIndex = themes.indexOf(savedTheme);
    if (currentThemeIndex === -1) currentThemeIndex = 0;
    applyTheme(themes[currentThemeIndex]);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            currentThemeIndex = (currentThemeIndex + 1) % themes.length;
            const newTheme = themes[currentThemeIndex];
            applyTheme(newTheme);
            localStorage.setItem('app-cyber-theme', newTheme);
        });
    }

    function applyTheme(themeName) {
        document.body.classList.remove('theme-matrix', 'theme-quantum');
        if (themeName !== 'default') {
            document.body.classList.add(themeName);
        }
        console.log(`Thème appliqué : ${themeName}`);
        
        // Rafraîchir les graphiques si instanciés pour adapter les couleurs
        if (progressionChart || distributionChart || activityChart || radarChart) {
            refreshChartStyles();
        }
    }

    // === REFRESH GRADES BUTTON & CLEAR CHAT BUTTON ===
    const btnRefreshGrades = document.getElementById('btn-refresh-grades');
    if (btnRefreshGrades) {
        btnRefreshGrades.addEventListener('click', () => {
            btnRefreshGrades.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Actualisation...';
            fetchGradesFromN8N().finally(() => {
                setTimeout(() => {
                    btnRefreshGrades.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Actualiser';
                }, 600);
            });
        });
    }

    const btnClearChat = document.getElementById('btn-clear-chat');
    if (btnClearChat) {
        btnClearChat.addEventListener('click', () => {
            if (confirm("Effacer la session actuelle du professeur IA ?")) {
                clearChatHistory();
            }
        });
    }

    // === CHAT SYSTEM ===
    const chatInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('chat-messages');

    // Send on Enter
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleUserMessage();
            }
        });
    }

    // Send on Click
    if (sendBtn) {
        sendBtn.addEventListener('click', handleUserMessage);
    }

    async function handleUserMessage() {
        const selectedSubject = subjectSelect?.value || '';
        if (!selectedSubject) {
            subjectSelect?.focus();
            alert('Sélectionne une matière avant de discuter avec le professeur IA.');
            return;
        }

        const text = chatInput.value.trim();
        if (text === "") return;

        // Démarrer le timer si ce n'est pas déjà fait
        if (!sessionStartTime) startSessionTimer();

        // 1. Add User Message
        addMessage(text, 'user');
        chatInput.value = "";

        // Show typing indicator
        const loadingId = showTypingIndicator();

        // 2. Send to N8N and get response
        const responseText = await sendMessageToN8N(text);

        // Remove typing indicator
        removeTypingIndicator(loadingId);

        // 3. Display Response
        displayResponse(responseText);
    }

    function clearChatHistory() {
        chatHistory = [];
        messageCount = 0;
        activeSpreadsheetId = null;
        sessionId = generateSessionId();
        console.log("Nouvelle session de chat - ID:", sessionId);
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="message bot">
                    <div class="avatar-speaker"><i class="fa-solid fa-shield-virus"></i></div>
                    <div class="bubble">
                        Bonjour Alexandre ! Je suis ton tuteur d'entraînement et de cyberdéfense scolaire pour la 5ème.
                        <br><br>
                        Choisis une matière à gauche ou pose-moi directement ta question sur ton cours de maths, tes devoirs ou tes exercices !
                    </div>
                </div>
            `;
        }
    }

    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);

        if (sender === 'bot') {
            const avatar = document.createElement('div');
            avatar.classList.add('avatar-speaker');
            avatar.innerHTML = '<i class="fa-solid fa-shield-virus"></i>';
            messageDiv.appendChild(avatar);
        }

        const bubble = document.createElement('div');
        bubble.classList.add('bubble');

        if (sender === 'bot') {
            bubble.innerHTML = parseMarkdown(text);

            // Add Text-to-Speech audio button
            const speechBtn = document.createElement('button');
            speechBtn.classList.add('speech-btn');
            speechBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Écouter';
            speechBtn.onclick = () => toggleSpeech(text, speechBtn);
            bubble.appendChild(speechBtn);

            // Render Math with KaTeX
            if (window.renderMathInElement) {
                renderMathInElement(bubble, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false
                });
            }
        } else {
            bubble.textContent = text;
        }

        messageDiv.appendChild(bubble);
        // Compter les caractères tapés pour le score de session (uniquement utilisateur)
        if (sender === 'user') {
            try { sessionCharacters += (text || '').length; } catch (e) { sessionCharacters = sessionCharacters || 0; }
        }
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        chatHistory.push({
            role: sender === 'user' ? 'user' : 'assistant',
            text: text
        });
    }

    // === TEXT-TO-SPEECH (SYNTHÈSE VOCALE) ===
    let currentUtterance = null;
    let activeSpeechBtn = null;

    function toggleSpeech(textToRead, btnElement, subjectOverride = null, labels = {}, languageOverride = null) {
        if (!('speechSynthesis' in window)) {
            alert("La synthèse vocale n'est pas prise en charge sur ce navigateur.");
            return;
        }

        const playLabel = labels.playLabel || 'Écouter';
        const stopLabel = labels.stopLabel || 'Arrêter';
        const playIcon = labels.playIcon || 'fa-volume-high';
        const stopIcon = labels.stopIcon || 'fa-stop';

        // Si déjà en cours d'écoute sur ce bouton -> Pause/Arrêt
        if (window.speechSynthesis.speaking && activeSpeechBtn === btnElement) {
            window.speechSynthesis.cancel();
            btnElement.classList.remove('speaking');
            btnElement.innerHTML = `<i class="fa-solid ${playIcon}"></i> ${playLabel}`;
            activeSpeechBtn = null;
            return;
        }

        // Si un autre audio tourne, on coupe
        window.speechSynthesis.cancel();
        if (activeSpeechBtn) {
            activeSpeechBtn.classList.remove('speaking');
            activeSpeechBtn.innerHTML = `<i class="fa-solid ${playIcon}"></i> ${playLabel}`;
        }

        // Nettoyer les balises Markdown / KaTeX pour la voix
        const cleanText = textToRead
            .replace(/\$\$[\s\S]*?\$\$/g, 'formule mathématique')
            .replace(/\$([^\$]+)\$/g, '$1')
            .replace(/[#*_`~-]/g, ' ')
            .replace(/!\[(.*?)\]\(.*?\)/g, '')
            .trim();

        currentUtterance = new SpeechSynthesisUtterance(cleanText);

        currentUtterance.lang = languageOverride || getSpeechLanguage(subjectOverride);

        currentUtterance.rate = 1.0;
        currentUtterance.pitch = 1.05;

        btnElement.classList.add('speaking');
        btnElement.innerHTML = `<i class="fa-solid ${stopIcon}"></i> ${stopLabel}`;
        activeSpeechBtn = btnElement;

        currentUtterance.onend = () => {
            btnElement.classList.remove('speaking');
            btnElement.innerHTML = `<i class="fa-solid ${playIcon}"></i> ${playLabel}`;
            activeSpeechBtn = null;
        };

        currentUtterance.onerror = () => {
            btnElement.classList.remove('speaking');
            btnElement.innerHTML = `<i class="fa-solid ${playIcon}"></i> ${playLabel}`;
            activeSpeechBtn = null;
        };

        window.speechSynthesis.speak(currentUtterance);
    }

    function getSpeechLanguage(subject) {
        const normalizedSubject = String(subject || document.getElementById('subject-select')?.value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        if (normalizedSubject.includes('anglais') || normalizedSubject.includes('english')) return 'en-US';
        if (normalizedSubject.includes('italien') || normalizedSubject.includes('italian')) return 'it-IT';
        return 'fr-FR';
    }

    // === SPEECH-TO-TEXT (RECONNAISSANCE VOCALE DU MICRO) ===
    const micBtn = document.getElementById('mic-btn');
    let recognition = null;
    let isListening = false;

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRec();
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isListening = true;
            if (micBtn) {
                micBtn.classList.add('listening');
                micBtn.title = "En écoute... Parle maintenant";
            }
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (chatInput) {
                chatInput.value = (chatInput.value ? chatInput.value + ' ' : '') + transcript;
                chatInput.focus();
            }
        };

        recognition.onerror = (event) => {
            console.warn("Erreur Speech Recognition:", event.error);
            stopListening();
        };

        recognition.onend = () => {
            stopListening();
        };
    }

    function stopListening() {
        isListening = false;
        if (micBtn) {
            micBtn.classList.remove('listening');
            micBtn.title = "Activer la reconnaissance vocale";
        }
    }

    if (micBtn) {
        micBtn.addEventListener('click', () => {
            if (!recognition) {
                alert("La reconnaissance vocale n'est pas disponible sur votre navigateur (veuillez utiliser Chrome ou Edge).");
                return;
            }

            if (isListening) {
                recognition.stop();
                stopListening();
            } else {
                const currentSubject = document.getElementById('subject-select')?.value || '';
                if (currentSubject === 'anglais') {
                    recognition.lang = 'en-US';
                } else if (currentSubject === 'italien') {
                    recognition.lang = 'it-IT';
                } else {
                    recognition.lang = 'fr-FR';
                }
                try {
                    recognition.start();
                } catch (e) {
                    console.error("Erreur lancement écoute:", e);
                }
            }
        });
    }

    // === SESSION TIMER ===
    function startSessionTimer() {
        if (sessionInterval) clearInterval(sessionInterval);

        sessionStartTime = Date.now();
        elapsedSeconds = 0;
        sessionCharacters = 0;
        isTimerPaused = false;

        updateSessionGauge(); // Initial reset

        const timerEl = document.getElementById('session-timer');
        const timeDisplay = document.getElementById('session-time');
        const pauseBtn = document.getElementById('pause-timer-btn');

        if (pauseBtn) {
            pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            pauseBtn.onclick = togglePauseTimer;
        }

        if (timerEl) timerEl.style.display = 'flex';
        if (timeDisplay) timeDisplay.textContent = '00:00';

        sessionInterval = setInterval(() => {
            if (!isTimerPaused) {
                elapsedSeconds++;
                const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
                const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
                if (timeDisplay) timeDisplay.textContent = `${minutes}:${seconds}`;
                updateSessionGauge();
            }
        }, 1000);
    }

    function updateSessionGauge() {
        const gaugeFill = document.getElementById('gauge-fill');
        const gaugePercent = document.getElementById('gauge-percent');
        const gaugeContainer = document.getElementById('session-gauge');
        if (!gaugeFill || !gaugeContainer) return;
        gaugeContainer.style.display = (sessionStartTime) ? 'flex' : 'none';
        if (!sessionStartTime) return;

        // 1. Temps (Max 50 pts si >= 30 min / 1800s)
        const timeScore = Math.min(50, (elapsedSeconds / 1800) * 50);
        // 2. Effort/Texte (Max 50 pts si >= 1500 chars)
        const chatScore = Math.min(50, (sessionCharacters / 1500) * 50);
        const totalScore = Math.round(timeScore + chatScore);

        gaugeFill.style.width = `${Math.max(5, totalScore)}%`;
        if (gaugePercent) gaugePercent.textContent = `${totalScore}%`;

        if (totalScore < 30) {
            gaugeFill.style.background = '#ff4d4d';
            gaugeFill.style.boxShadow = '0 0 15px rgba(255, 77, 77, 0.4)';
        } else if (totalScore < 60) {
            gaugeFill.style.background = '#ff9f43';
            gaugeFill.style.boxShadow = '0 0 15px rgba(255, 159, 67, 0.4)';
        } else if (totalScore < 85) {
            gaugeFill.style.background = '#f3f91d';
            gaugeFill.style.boxShadow = '0 0 15px rgba(243, 249, 29, 0.4)';
        } else {
            gaugeFill.style.background = '#2ecc71';
            gaugeFill.style.boxShadow = '0 0 15px rgba(46, 204, 113, 0.4)';
        }
    }

    function togglePauseTimer(e) {
        if (e) e.stopPropagation();
        isTimerPaused = !isTimerPaused;
        const pauseBtn = document.getElementById('pause-timer-btn');
        if (pauseBtn) {
            pauseBtn.innerHTML = isTimerPaused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
            pauseBtn.title = isTimerPaused ? 'Reprendre' : 'Pause';
        }
    }

    function resumeTimer() {
        if (isTimerPaused) togglePauseTimer();
    }

    function stopSessionTimer() {
        if (sessionInterval) {
            clearInterval(sessionInterval);
            sessionInterval = null;
        }
        sessionStartTime = null;
        elapsedSeconds = 0;
        sessionCharacters = 0;
        isTimerPaused = false;
        updateSessionGauge();
        const timerEl = document.getElementById('session-timer');
        if (timerEl) timerEl.style.display = 'none';
    }

    // === EVALUATION SYSTEM ===
    const evaluateBtn = document.getElementById('evaluate-btn');
    const evalModal = document.getElementById('evaluation-modal');
    const closeEvalBtn = document.getElementById('close-eval-modal');
    const evalSpeechBtn = document.getElementById('eval-speech-btn');
    const evalLanguageSelect = document.getElementById('eval-language-select');
    const evalLanguageButtons = document.querySelectorAll('#eval-language-buttons .language-option');
    const evalTranslationStatus = document.getElementById('eval-translation-status');
    let evaluationSpeechText = '';
    let evaluationSpeechSubject = '';
    let evaluationTranslatedText = '';
    let evaluationTranslationKey = '';
    let evaluationOriginalHtml = '';
    const savedEvaluationReportsKey = 'alexandre-evaluation-reports';

    if (evaluateBtn) {
        evaluateBtn.addEventListener('click', () => {
            let durationMinutes = 0;
            if (sessionStartTime) {
                const measuredSeconds = Math.max(elapsedSeconds, Math.floor((Date.now() - sessionStartTime) / 1000));
                durationMinutes = Math.max(1, Math.ceil(measuredSeconds / 60));
                if (durationMinutes < 1) durationMinutes = 1;
                console.log(`⏱️ Fin session. Durée: ${measuredSeconds}s = ${durationMinutes} min`);
            } else {
                console.warn("⚠️ sessionStartTime était null. Durée mise à 0.");
            }
            stopSessionTimer();
            evaluateSession(durationMinutes);
        });
    }

    if (closeEvalBtn) {
        closeEvalBtn.addEventListener('click', () => {
            if (evalModal) evalModal.style.display = 'none';
            stopEvaluationSpeech();
        });
    }

    if (evalModal) {
        evalModal.addEventListener('click', (event) => {
            if (event.target === evalModal) {
                evalModal.style.display = 'none';
                stopEvaluationSpeech();
            }
        });
    }

    if (evalSpeechBtn) {
        evalSpeechBtn.addEventListener('click', async () => {
            if (!evaluationSpeechText) return;
            if (window.speechSynthesis?.speaking && activeSpeechBtn === evalSpeechBtn) {
                stopEvaluationSpeech();
                return;
            }

            const targetLanguage = evalLanguageSelect?.value || 'fr-FR';
            const translationKey = `${targetLanguage}:${evaluationSpeechText}`;
            let speechText = evaluationSpeechText;

            if (targetLanguage !== 'fr-FR') {
                if (evaluationTranslationKey === translationKey && evaluationTranslatedText) {
                    speechText = evaluationTranslatedText;
                } else {
                    setEvaluationTranslationStatus('Translation in progress...');
                    evalSpeechBtn.disabled = true;
                    try {
                        speechText = await translateEvaluationText(evaluationSpeechText, targetLanguage);
                        evaluationTranslatedText = speechText;
                        evaluationTranslationKey = translationKey;
                        showEvaluationTranslation(speechText);
                        setEvaluationTranslationStatus(`Translated to ${targetLanguage.slice(0, 2).toUpperCase()}`);
                    } catch (error) {
                        console.error('Evaluation translation error:', error);
                        setEvaluationTranslationStatus('Translation unavailable. Original text will be read.');
                        speechText = evaluationSpeechText;
                        restoreEvaluationText();
                    } finally {
                        evalSpeechBtn.disabled = false;
                    }
                }
            } else {
                restoreEvaluationText();
                setEvaluationTranslationStatus('Original feedback');
            }

            toggleSpeech(speechText, evalSpeechBtn, evaluationSpeechSubject, {
                playLabel: 'Play',
                stopLabel: 'Stop'
            }, targetLanguage);
        });
    }

    if (evalLanguageSelect) {
        evalLanguageSelect.addEventListener('change', stopEvaluationSpeech);
    }

    evalLanguageButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (evalLanguageSelect) evalLanguageSelect.value = button.dataset.language;
            updateEvaluationLanguageButtons(button.dataset.language);
            stopEvaluationSpeech();
        });
    });

    function updateEvaluationLanguageButtons(language) {
        evalLanguageButtons.forEach(button => {
            const isActive = button.dataset.language === language;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    function stopEvaluationSpeech() {
        if (activeSpeechBtn === evalSpeechBtn && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            evalSpeechBtn.classList.remove('speaking');
            evalSpeechBtn.innerHTML = '<i class="fa-solid fa-play"></i> Play';
            activeSpeechBtn = null;
        }
    }

    function setEvaluationTranslationStatus(message) {
        if (evalTranslationStatus) evalTranslationStatus.textContent = message;
    }

    function showEvaluationTranslation(text) {
        const appreciationDiv = document.getElementById('eval-appreciation');
        if (!appreciationDiv) return;
        appreciationDiv.textContent = text;
        appreciationDiv.classList.add('translated-feedback');
    }

    function restoreEvaluationText() {
        const appreciationDiv = document.getElementById('eval-appreciation');
        if (!appreciationDiv || !evaluationOriginalHtml) return;
        appreciationDiv.innerHTML = evaluationOriginalHtml;
        appreciationDiv.classList.remove('translated-feedback');
    }

    async function translateEvaluationText(text, targetLanguage) {
        const languagePair = `fr|${targetLanguage.slice(0, 2).toLowerCase()}`;
        const chunks = splitTranslationText(text, 450);
        const translatedChunks = [];

        for (const chunk of chunks) {
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${languagePair}`);
            if (!response.ok) throw new Error(`Translation HTTP ${response.status}`);
            const data = await response.json();
            const translatedChunk = data?.responseData?.translatedText;
            if (!translatedChunk) throw new Error('Empty translation response');
            translatedChunks.push(translatedChunk.trim());
        }

        return translatedChunks.join('\n\n');
    }

    function splitTranslationText(text, maxLength) {
        const sentences = String(text || '').match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g) || [String(text || '')];
        const chunks = [];
        let current = '';

        const addPart = (part) => {
            const normalizedPart = part.trim();
            if (!normalizedPart) return;
            if (!current) {
                current = normalizedPart;
                return;
            }
            if ((current.length + normalizedPart.length + 1) <= maxLength) {
                current += ` ${normalizedPart}`;
            } else {
                chunks.push(current);
                current = normalizedPart;
            }
        };

        sentences.forEach(sentence => {
            if (sentence.length <= maxLength) {
                addPart(sentence);
                return;
            }

            sentence.trim().split(/\s+/).forEach(word => {
                if (word.length > maxLength) {
                    if (current) {
                        chunks.push(current);
                        current = '';
                    }
                    for (let index = 0; index < word.length; index += maxLength) {
                        chunks.push(word.slice(index, index + maxLength));
                    }
                    return;
                }
                addPart(word);
            });
        });

        if (current) chunks.push(current);
        return chunks.length ? chunks : [''];
    }

    async function evaluateSession(durationMinutes) {
        if (!evalModal) return;
        evalModal.style.display = 'flex';

        const loadingEl = document.getElementById('eval-loading');
        const resultEl = document.getElementById('eval-result');
        if (loadingEl) loadingEl.style.display = 'block';
        if (resultEl) resultEl.style.display = 'none';

        const subject = document.getElementById('subject-select')?.value || 'Général';
        const exchanges = chatHistory.filter(message => message.role === 'user').length;

        const payload = {
            history: chatHistory,
            subject: subject,
            duration: durationMinutes,
            exchanges: exchanges,
            sessionId: sessionId,
            timestamp: new Date().toISOString()
        };

        try {
            console.log("Envoi de la demande d'évaluation...");
            const response = await fetch('https://n8n.n8n-sbf-avocats.fr/webhook/evaluate-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            console.log('Statut réponse webhook:', response.status);
            if (!response.ok) {
                const errText = await response.text();
                console.error('Erreur serveur:', errText);
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            const rawText = await response.text();
            console.log('Réponse brute reçue:', rawText);
            let data;
            try {
                data = JSON.parse(rawText);
            } catch (e) {
                console.error('Erreur parsing JSON:', e);
                throw new Error('Réponse invalide (pas du JSON)');
            }
            if (Array.isArray(data)) data = data[0];

            if (loadingEl) loadingEl.style.display = 'none';
            if (resultEl) resultEl.style.display = 'block';

            console.log('Parsed evaluation object keys:', Object.keys(data || {}));

            function pick(obj, keys) {
                for (const k of keys) {
                    if (!obj) continue;
                    if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
                    // try normalized key without accents/spaces
                    const normalized = k.normalize('NFD').replace(/\p{Diacritic}/gu, "").replace(/\s+/g, "");
                    for (const ok of Object.keys(obj)) {
                        const normOk = ok.normalize('NFD').replace(/\p{Diacritic}/gu, "").replace(/\s+/g, "");
                        if (normOk.toLowerCase() === normalized.toLowerCase()) return obj[ok];
                    }
                }
                return undefined;
            }

            const note = pick(data, ['grade', 'note', 'note ', 'barème', 'bareme', 'score', 'result', 'note/20']) || 0;
            const appreciation = pick(data, ['appreciation', 'message', 'commentaire', 'comment', 'feedback']) || 'Session enregistrée.';
            const itemSubject = pick(data, ['subject', 'matière', 'matiere', 'matière ', 'matiere ']) || subject;

            const gradeEl = document.getElementById('eval-grade');
            if (gradeEl) gradeEl.textContent = note;
            document.getElementById('eval-exchanges').textContent = exchanges;
            document.getElementById('eval-duration').textContent = durationMinutes;
            document.getElementById('eval-subject').textContent = itemSubject;

            const appreciationDiv = document.getElementById('eval-appreciation');
            let appreciationHtml = '';
            try {
                const appText = (typeof appreciation === 'string') ? appreciation : JSON.stringify(appreciation, null, 2);
                appreciationHtml = `<p>${appText.replace(/\n/g, '<br>')}</p>`;
            } catch (e) {
                appreciationHtml = `<pre style="white-space:pre-wrap">${JSON.stringify(appreciation)}</pre>`;
            }
            if (appreciationDiv) {
                appreciationDiv.innerHTML = appreciationHtml;
                evaluationOriginalHtml = appreciationHtml;
                appreciationDiv.classList.remove('translated-feedback');
            }
            evaluationSpeechText = (typeof appreciation === 'string') ? appreciation : JSON.stringify(appreciation);
            evaluationSpeechSubject = itemSubject;
            evaluationTranslatedText = '';
            evaluationTranslationKey = '';
            if (evalLanguageSelect) {
                evalLanguageSelect.value = getSpeechLanguage(itemSubject);
                updateEvaluationLanguageButtons(evalLanguageSelect.value);
            }
            setEvaluationTranslationStatus('');
            saveEvaluationReport({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                date: new Date().toISOString(),
                subject: itemSubject,
                grade: note,
                duration: durationMinutes,
                exchanges: exchanges,
                appreciation: evaluationSpeechText
            });
            if (evalSpeechBtn) {
                evalSpeechBtn.classList.remove('speaking');
                evalSpeechBtn.innerHTML = '<i class="fa-solid fa-play"></i> Play';
            }

            const gradeCircle = document.querySelector('.grade-circle');
            if (gradeCircle) {
                gradeCircle.textContent = note;
                gradeCircle.style.borderColor = note >= 15 ? '#2ecc71' : (note >= 10 ? '#f3f91d' : '#ff4d4d');
                gradeCircle.style.color = gradeCircle.style.borderColor;
            }

            // If modal fields still empty, show raw response for debugging
            if ((!document.getElementById('eval-appreciation')?.textContent || document.getElementById('eval-appreciation')?.textContent.trim()==='') && rawText) {
                const dbg = document.createElement('pre');
                dbg.style.whiteSpace = 'pre-wrap';
                dbg.style.marginTop = '8px';
                dbg.style.fontSize = '0.9rem';
                dbg.textContent = 'Réponse brute:\n' + rawText;
                appreciationDiv.appendChild(dbg);
            }

            fetchGradesFromN8N();
        } catch (error) {
            console.error('Evaluation error:', error);
            const loadingEl = document.getElementById('eval-loading');
            if (loadingEl) loadingEl.innerHTML = `<p style="color:#ff4d4d">Erreur lors de l'évaluation.<br>Réessaie plus tard.</p>`;
        }
    }

    function getSavedEvaluationReports() {
        try {
            const stored = JSON.parse(localStorage.getItem(savedEvaluationReportsKey) || '[]');
            return Array.isArray(stored) ? stored : [];
        } catch (error) {
            console.error('Evaluation history error:', error);
            return [];
        }
    }

    function saveEvaluationReport(report) {
        const reports = getSavedEvaluationReports().filter(item => item.id !== report.id);
        reports.unshift(report);
        try {
            localStorage.setItem(savedEvaluationReportsKey, JSON.stringify(reports.slice(0, 30)));
        } catch (error) {
            console.error('Unable to save evaluation report:', error);
        }
    }

    function openEvaluationReport(report) {
        if (!evalModal || !report) return;
        const appreciationDiv = document.getElementById('eval-appreciation');
        const resultEl = document.getElementById('eval-result');
        const loadingEl = document.getElementById('eval-loading');
        const reportDate = new Date(report.date);

        evalModal.style.display = 'flex';
        if (loadingEl) loadingEl.style.display = 'none';
        if (resultEl) resultEl.style.display = 'block';
        document.getElementById('eval-grade').textContent = report.grade ?? 0;
        document.getElementById('eval-subject').textContent = report.subject || 'Général';
        document.getElementById('eval-duration').textContent = report.duration || 0;
        document.getElementById('eval-exchanges').textContent = report.exchanges || 0;

        if (appreciationDiv) {
            appreciationDiv.textContent = report.appreciation || 'Session enregistrée.';
            appreciationDiv.classList.remove('translated-feedback');
            evaluationOriginalHtml = appreciationDiv.innerHTML;
        }
        evaluationSpeechText = report.appreciation || 'Session enregistrée.';
        evaluationSpeechSubject = report.subject || 'Général';
        evaluationTranslatedText = '';
        evaluationTranslationKey = '';
        if (evalLanguageSelect) {
            evalLanguageSelect.value = getSpeechLanguage(evaluationSpeechSubject);
            updateEvaluationLanguageButtons(evalLanguageSelect.value);
        }
        setEvaluationTranslationStatus(reportDate.toLocaleDateString('fr-FR') + ' - Rapport sauvegardé');
        if (evalSpeechBtn) {
            evalSpeechBtn.classList.remove('speaking');
            evalSpeechBtn.innerHTML = '<i class="fa-solid fa-play"></i> Play';
        }
    }

    // === MARKDOWN PARSER ===
    function parseMarkdown(text) {
        // Défensive: s'assurer qu'on travaille toujours sur une string
        if (typeof text !== 'string') {
            if (text == null) {
                text = '';
            } else if (Array.isArray(text)) {
                text = text.map(t => (typeof t === 'string' ? t : (t && t.text) ? t.text : JSON.stringify(t))).join('\n\n');
            } else if (typeof text === 'object') {
                if (text.text) text = text.text;
                else text = JSON.stringify(text);
            } else {
                text = String(text);
            }
        }

        let html = text;

        // 1. Images: ![Alt](URL)
        html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" title="$1" style="max-width:100%; border-radius:8px; margin:8px 0;">');

        // 2. Bold: **text**
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--cyber-cyan);">$1</strong>');

        // 3. Italics: *text*
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // 4. Headers: ### Title
        html = html.replace(/^### (.*$)/gim, '<h3 style="margin:8px 0 4px 0; font-size:1.05rem; color:var(--cyber-cyan);">$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2 style="margin:10px 0 6px 0; font-size:1.15rem; color:#fff;">$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1 style="margin:12px 0 8px 0; font-size:1.25rem; color:#fff;">$1</h1>');

        // 5. Code: `text`
        html = html.replace(/`(.*?)`/g, '<code style="background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px; font-family:var(--font-mono); color:var(--cyber-cyan);">$1</code>');

        // 6. Horizontal Rules: ---
        html = html.replace(/^---$/gim, '<hr style="border:none; border-top:1px solid var(--border-subtle); margin:10px 0;">');

        // 7. Lists
        html = html.replace(/^\* (.*$)/gim, '<li style="margin-left:18px;">$1</li>');
        html = html.replace(/^- (.*$)/gim, '<li style="margin-left:18px;">$1</li>');

        // 8. Line breaks
        html = html.replace(/\n\n/g, '<br><br>');
        html = html.replace(/\n(?!(?:<h|<hr|<li|<img))/g, '<br>');

        return html;
    }

    // === FILE EXPLORER & DRIVE FOLDERS LOGIC ===
    let activeFileId = null;
    let activeFileName = null;

    const matiereFolderIds = {
        'mathematiques': '19Vs0a7oJqJXxFq_KCT02YQjpJ5Ldf7vT',
        'francais': '1k8eQKIa7P-5SQpB14ZwAd6CWVOZ4xdKi',
        'svt': '1p2Ejj0SO9sYMbGSyQlubtggSdVdF2By_',
        'anglais': '1MGcH5CHXdvpFdbpITILDkNY18DBd4Lxi',
        'histoire': '1S1VL9NVn9pveMgLUG0oaHsryCKcAuuVr',
        'italien': '1yrBYXVzNvKqLKOQbXIToELdi1DcacJok',
        'physique': '1Dy7dl-IHezoMHbefsXvnwYqz_y4NyM4a',
        'technologie': ''
    };

    // Subject Select Listener
    const subjectSelect = document.getElementById('subject-select');
    if (subjectSelect) {
        subjectSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            clearChatHistory();
            fetchFiles(val);
            resetSelection();
            if (window.updateTranslatorVisibility) {
                window.updateTranslatorVisibility(val);
            }
        });
    }

    async function fetchFiles(matiere) {
        if (!matiere) return;
        const filesList = document.getElementById('files-list');
        filesList.innerHTML = '<div class="files-empty-state"><i class="fa-solid fa-circle-notch fa-spin pulse-icon"></i> <span>Interrogation du coffre-fort Drive...</span></div>';

        const folderId = matiereFolderIds[matiere] || '';
        const webhookUrl = 'https://n8n.n8n-sbf-avocats.fr/webhook/get-files';

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderId: folderId, matiere: matiere })
            });

            if (!response.ok) {
                console.error(`Fetch files error: ${response.status}`);
                filesList.innerHTML = `<div style="color:var(--cyber-pink); font-size: 0.82rem; padding:15px; text-align:center;">Erreur de connexion serveur (${response.status}).</div>`;
                return;
            }

            const text = await response.text();
            if (!text) {
                renderFiles([]);
                return;
            }

            const data = JSON.parse(text);
            console.log('Fichiers reçus de n8n:', data);

            let files = [];
            if (Array.isArray(data)) {
                files = data;
            } else if (data.files && Array.isArray(data.files)) {
                files = data.files;
            } else if (data.data && Array.isArray(data.data)) {
                files = data.data;
            } else if (data && typeof data === 'object' && data.id && data.name) {
                files = [data];
            }

            renderFiles(files);
        } catch (error) {
            console.error('Error fetching files:', error);
            filesList.innerHTML = '<div style="color:var(--cyber-pink); padding:15px; text-align:center; font-size:0.82rem;">Erreur de chargement du coffre-fort.</div>';
        }
    }

    function renderFiles(files) {
        const filesList = document.getElementById('files-list');
        filesList.innerHTML = '';

        if (files.length === 0) {
            filesList.innerHTML = '<div class="files-empty-state"><i class="fa-solid fa-folder-open"></i> <span>Aucun fichier dans ce dossier pour le moment.</span></div>';
            return;
        }

        files.forEach(file => {
            const card = document.createElement('div');
            card.classList.add('file-card');
            card.dataset.id = file.id;
            card.onclick = () => selectFile(file.id, file.name, card);

            card.innerHTML = `
                <i class="fa-solid fa-file-shield" style="color: var(--cyber-cyan); font-size: 1.2rem;"></i>
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-meta">Document sécurisé</span>
                </div>
                <i class="fa-solid fa-chevron-right" style="font-size: 0.75rem; opacity: 0.4;"></i>
            `;
            filesList.appendChild(card);
        });
    }

    function selectFile(fileId, fileName, cardElement) {
        activeFileId = fileId;
        activeFileName = fileName;

        // UI Updates
        document.querySelectorAll('.file-card').forEach(c => c.classList.remove('active'));
        cardElement.classList.add('active');

        const activeBadge = document.getElementById('active-lesson-name');
        if (activeBadge) activeBadge.textContent = fileName;

        // System Message
        addMessage(`🛡️ **Document activé** : *${fileName}*.\nJe suis synchronisé avec ce cours. Pose-moi toutes tes questions !`, 'bot');
    }

    function resetSelection() {
        activeFileId = null;
        activeFileName = null;
        const activeBadge = document.getElementById('active-lesson-name');
        if (activeBadge) activeBadge.textContent = 'Aucun (Session libre)';
    }

    // === N8N INTEGRATION: ENVOI DE MESSAGE AU CHAT ===
    async function sendMessageToN8N(message) {
        const subjectSelect = document.getElementById('subject-select');
        const subject = subjectSelect?.value || '';
        if (!subject) {
            return 'Sélectionne une matière avant de discuter avec le professeur IA.';
        }

        const selectedModeEl = document.querySelector('input[name="work-mode"]:checked');
        const workMode = selectedModeEl ? selectedModeEl.value : 'revision';

        const webhookUrl = `https://n8n.n8n-sbf-avocats.fr/webhook/${subject}`;

        try {
            messageCount++;

            const body = {
                chatInput: message,
                subject: subject,
                workMode: workMode,
                activeFileId: activeFileId || '',
                activeFileName: activeFileName || '',
                history: chatHistory,
                sessionId: sessionId,
                messageCount: messageCount,
                spreadsheetId: activeSpreadsheetId || ''
            };

            console.log(`Transmission n8n [${webhookUrl}]`, body);
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`ERROR Webhook: ${response.status}`, errorText);
                return `Désolé Alexandre, une alerte technique est survenue (Code ${response.status}). Vérifie que le canal "**${subject}**" est bien actif dans n8n !`;
            }

            // Lire la réponse brute et la logger pour debug
            const raw = await response.text();
            console.log('Raw webhook response:', raw);

            let data;
            try {
                data = JSON.parse(raw);
            } catch (e) {
                console.warn('Webhook returned non-JSON response, returning raw text');
                // Retourner la chaîne brute (utile pour debug et affichage immédiat)
                return raw;
            }

            const item = (Array.isArray(data) && data.length > 0) ? data[0] : data;

            // Capture de l'ID Google Sheets
            if (item?.spreadsheetId) {
                activeSpreadsheetId = item.spreadsheetId;
                console.log("ID Spreadsheet mémorisé :", activeSpreadsheetId);
            }

            // Helper: tenter d'extraire du texte assistant depuis plusieurs structures possibles
            function extractAssistantText(obj) {
                if (!obj) return '';
                if (typeof obj === 'string') return obj;
                if (Array.isArray(obj)) {
                    for (const el of obj) {
                        const t = extractAssistantText(el);
                        if (t) return t;
                    }
                    return '';
                }

                // cas: item.response = [ { content: [ { text: '...' } ] } ]
                if (obj.response) {
                    if (typeof obj.response === 'string') return obj.response;
                    if (Array.isArray(obj.response)) {
                        for (const r of obj.response) {
                            if (r?.content && Array.isArray(r.content)) {
                                for (const c of r.content) {
                                    if (c?.text) return c.text;
                                    if (c?.output_text) return c.output_text;
                                }
                            }
                            if (r?.text) return r.text;
                        }
                    } else if (typeof obj.response === 'object' && obj.response.text) {
                        return obj.response.text;
                    }
                }

                if (obj.content && Array.isArray(obj.content)) {
                    for (const c of obj.content) {
                        if (c?.text) return c.text;
                        if (c?.output_text) return c.output_text;
                    }
                }

                if (obj.text) return obj.text;
                if (obj.output_text) return obj.output_text;
                if (obj.output && typeof obj.output === 'string') return obj.output;
                if (obj.Réponse || obj.reponse) return obj.Réponse || obj.reponse;

                // Fallback: stringify
                try {
                    return JSON.stringify(obj);
                } catch (e) {
                    return '';
                }
            }

            const assistantText = extractAssistantText(data) || extractAssistantText(item);
            if (assistantText) return assistantText;

            return "Réponse reçue du serveur.";
        } catch (error) {
            console.error('Erreur chat n8n:', error);
            return "Une erreur de communication est survenue avec le professeur IA.";
        }
    }

    function showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const msgDiv = document.createElement('div');
        msgDiv.id = id;
        msgDiv.classList.add('message', 'bot');
        msgDiv.innerHTML = `
            <div class="avatar-speaker"><i class="fa-solid fa-shield-virus"></i></div>
            <div class="bubble" style="color: var(--cyber-cyan); font-family: var(--font-mono); font-size: 0.85rem;">
                <i class="fa-solid fa-circle-notch fa-spin"></i> Traitement de la requête...
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return id;
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    window.displayResponse = function (text) {
        addMessage(text, 'bot');
    };

    // === GLOBAL HELPER FUNCTIONS ===
    window.navigateTo = function (targetId, initialMessage = null) {
        const navItem = document.querySelector(`.nav-item[data-target="${targetId}"]`);
        if (navItem) navItem.click();

        if (initialMessage && targetId === 'chat') {
            setTimeout(() => {
                displayResponse(initialMessage);
            }, 400);
        }
    };

    window.startSubject = function (subject) {
        navigateTo('chat');

        const subjectMap = {
            'Mathématiques': 'mathematiques',
            'Français': 'francais',
            'Histoire-Géo': 'histoire',
            'Histoire': 'histoire',
            'Sciences': 'svt',
            'SVT': 'svt',
            'Anglais': 'anglais',
            'Italien': 'italien',
            'Physique/Chimie': 'physique',
            'Technologie': 'technologie'
        };

        const val = subjectMap[subject] || 'mathematiques';
        const select = document.getElementById('subject-select');
        if (select) {
            select.value = val;
            clearChatHistory();
            fetchFiles(val);
            if (window.updateTranslatorVisibility) {
                window.updateTranslatorVisibility(val);
            }
        }
    };

    // === GRADE BOOK & ADVANCED METRICS LOGIC ===
    if (gradeForm) {
        gradeForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const subject = document.getElementById('grade-subject').value;
            if (!subject) {
                alert("Sélectionne la matière avant de valider. 😉");
                return;
            }

            const title = document.getElementById('grade-title').value || "";
            const value = document.getElementById('grade-value').value;
            const scale = document.getElementById('grade-scale').value || 20;
            const classAverage = document.getElementById('grade-class-average').value || "";
            const rawDate = document.getElementById('grade-date').value;
            const coefficient = document.getElementById('grade-coefficient').value || 1;

            let formattedDate = rawDate;
            if (rawDate) {
                const [y, m, d] = rawDate.split('-');
                formattedDate = `${d}/${m}/${y}`;
            }

            const gradeMin = document.getElementById('grade-min').value || "";
            const gradeMax = document.getElementById('grade-max').value || "";

            const gradeData = {
                matière: subject,
                date: formattedDate,
                note: value,
                barème: scale,
                moyenne_classe: classAverage,
                moyenne: classAverage,
                "note la plus basse": gradeMin,
                min: gradeMin,
                "note la plus haute": gradeMax,
                max: gradeMax,
                commentaire: title,
                coefficient: coefficient,
                timestamp: new Date().toISOString()
            };

            // 1. UI Update
            addGradeToTable(gradeData);
            updateRecentGrades(gradeData);
            gradeForm.reset();

            // 2. Send to N8N
            const success = await sendGradeToN8N(gradeData);
            if (success) {
                if (classAverage === '' && rewardFeedback) {
                    rewardFeedback.innerHTML = '<i class="fa-solid fa-circle-info"></i> Note enregistrée. Ajoute la moyenne de classe pour calculer le temps de jeu.';
                }
                alert('Protocole validé : Note synchronisée avec succès ! 🛡️');
                fetchGradesFromN8N(); // Re-fetch to recalculate averages and update charts
            } else {
                alert("Erreur lors de l'envoi de la note vers n8n.");
            }
        });
    }

    function addGradeToTable(data) {
        if (!data || !gradesTbody) return;

        if (gradesTbody.innerText.includes('Chargement') || gradesTbody.innerText.includes('Aucune')) {
            gradesTbody.innerHTML = '';
        }

        const tr = document.createElement('tr');
        const subjectClass = getSubjectClass(data.matière);
        const noteDisplay = (data.note !== undefined && data.note !== null) ? data.note : '?';

        tr.innerHTML = `
            <td><span style="font-family: var(--font-mono);">${data.date || '?'}</span></td>
            <td><span class="subject-tag ${subjectClass}">${data.matière || 'Général'}</span></td>
            <td>${data.commentaire || '<span style="opacity:0.4;">-</span>'}</td>
            <td><span class="coef-val">x${data.coefficient || 1}</span></td>
            <td><span class="grade-val">${noteDisplay}/${data.barème || 20}</span></td>
            <td style="opacity:0.8; font-family: var(--font-mono);">${data.moyenne || '-'}</td>
            <td style="opacity:0.6; font-family: var(--font-mono);">${data.min || data["note la plus basse"] || '-'}</td>
            <td style="opacity:0.6; font-family: var(--font-mono);">${data.max || data["note la plus haute"] || '-'}</td>
        `;
        gradesTbody.prepend(tr);
    }

    function updateRecentGrades(data) {
        if (!recentGradesList) return;

        const div = document.createElement('div');
        div.classList.add('stat-item');
        const subjectTextClass = getSubjectTextClass(data.matière);
        const subjectBgClass = getSubjectBgClass(data.matière);
        const scale = data.barème || 20;
        const percentage = Math.min(100, Math.max(0, (data.note / scale) * 100));

        div.innerHTML = `
            <div class="stat-header">
                <span class="subject-label ${subjectTextClass}">${data.matière}</span>
                <span class="xp-val">${data.note}/${scale}</span>
            </div>
            <div class="progress-bar">
                <div class="fill ${subjectBgClass}" style="width: ${percentage}%"></div>
            </div>
        `;

        recentGradesList.prepend(div);
        if (recentGradesList.children.length > 5) {
            recentGradesList.removeChild(recentGradesList.lastChild);
        }
    }

    function formatActivityTime(date) {
        if (!date || isNaN(date.getTime())) return 'Date inconnue';
        const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
        if (elapsedMinutes < 1) return "À l'instant";
        if (elapsedMinutes < 60) return `Il y a ${elapsedMinutes} min`;
        if (elapsedMinutes < 1440) return `Il y a ${Math.floor(elapsedMinutes / 60)} h`;
        if (elapsedMinutes < 2880) return 'Hier';
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    function getActivityIcon(subject, isHomework) {
        if (isHomework) return 'fa-house-chimney';
        const icons = {
            math: 'fa-square-root-variable',
            french: 'fa-language',
            history: 'fa-monument',
            science: 'fa-flask',
            physique: 'fa-flask',
            technologie: 'fa-microchip',
            english: 'fa-language',
            italien: 'fa-language'
        };
        return icons[getSubjectBase(subject)] || 'fa-file-circle-check';
    }

    function renderRecentActivity() {
        const activityList = document.getElementById('recent-activity-list');
        if (!activityList) return;

        const activities = [...cachedAllGrades]
            .filter(item => item.dateObj && !isNaN(item.dateObj.getTime()))
            .sort((a, b) => b.dateObj - a.dateObj)
            .slice(0, 5);

        if (activities.length === 0) {
            activityList.innerHTML = '<li class="activity-empty"><i class="fa-solid fa-inbox"></i> Aucune activité récente enregistrée.</li>';
            return;
        }

        activityList.innerHTML = activities.map(item => {
            const isHomework = item.entryType === 'maison';
            const subject = item.matière || 'Général';
            const title = item.evaluationReport
                ? 'Session évaluée avec le Professeur'
                : (item.commentaire || `Note enregistrée en ${subject}`);
            const activityType = isHomework ? 'Devoir maison' : 'Évaluation scolaire';
            return `
                <li class="activity-entry ${getSubjectBase(subject)}">
                    <div class="entry-icon"><i class="fa-solid ${getActivityIcon(subject, isHomework)}"></i></div>
                    <div class="entry-info">
                        <div class="entry-title">${escapeHtml(title)}</div>
                        <div class="entry-meta">${escapeHtml(subject)} • ${activityType} • ${item.note}/${item.barème || 20}</div>
                    </div>
                    <span class="entry-time">${formatActivityTime(item.dateObj)}</span>
                </li>`;
        }).join('');
    }

    function getSubjectBase(subject) {
        if (!subject) return 'default';
        const s = subject.toLowerCase();
        if (s.includes('math')) return 'math';
        if (s.includes('franç') || s.includes('franc')) return 'french';
        if (s.includes('hist') || s.includes('géo')) return 'history';
        if (s.includes('svt') || s.includes('scienc')) return 'science';
        if (s.includes('techn')) return 'technologie';
        if (s.includes('angl')) return 'english';
        if (s.includes('ital') || s.includes('ita')) return 'italien';
        if (s.includes('phys') || s.includes('chim')) return 'physique';
        return 'default';
    }

    function getSubjectClass(subject) {
        const base = getSubjectBase(subject);
        const maps = {
            'math': 'st-math',
            'french': 'st-french',
            'history': 'st-history',
            'science': 'st-science',
            'english': 'st-english',
            'italien': 'st-italien',
            'physique': 'st-physique',
            'technologie': 'st-technologie'
        };
        return maps[base] || '';
    }

    function getSubjectTextClass(subject) {
        return getSubjectBase(subject) + '-text';
    }

    function getSubjectBgClass(subject) {
        return getSubjectBase(subject) + '-bg';
    }

    function getSubjectColor(subject) {
        const base = getSubjectBase(subject);
        const maps = {
            'math': '#ec4899',       // Rose fluo
            'french': '#00e5ff',     // Cyan
            'history': '#f59e0b',    // Ambre
            'science': '#10b981',    // Émeraude
            'english': '#8b5cf6',    // Violet
            'italien': '#14b8a6',    // Sarcelle
            'physique': '#06b6d4',   // Cyan électrique
            'technologie': '#f97316' // Orange technologie
        };
        return maps[base] || '#3b82f6';
    }

    async function sendGradeToN8N(data) {
        const webhookUrl = 'https://n8n.n8n-sbf-avocats.fr/webhook/add-grade';
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.ok;
        } catch (error) {
            console.error('Error sending grade:', error);
            return false;
        }
    }

    // === GESTION DU TRI ET DE L'ANNÉE SCOLAIRE ===
    function getSchoolYearFromDate(dateObj) {
        if (!dateObj || isNaN(dateObj.getTime())) return 'Autre';
        const y = dateObj.getFullYear();
        const m = dateObj.getMonth(); // 0 = Janvier, 7 = Août, 8 = Septembre
        return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    }

    function populateSchoolYearFilter(grades) {
        const yearFilter = document.getElementById('school-year-filter');
        if (!yearFilter) return;

        const currentVal = yearFilter.value || 'all';
        const yearsSet = new Set();
        grades.forEach(g => {
            if (g.schoolYear && g.schoolYear !== 'Autre') {
                yearsSet.add(g.schoolYear);
            }
        });

        // Always offer the global "Toutes les années" option
        yearFilter.innerHTML = '<option value="all">Toutes les années</option>';

        // Compute current school year (ex: 2025-2026) and add it first if missing
        try {
            const now = new Date();
            const currentSchoolYear = getSchoolYearFromDate(now);
            if (currentSchoolYear && currentSchoolYear !== 'Autre') yearsSet.add(currentSchoolYear);
        } catch (e) {
            // ignore
        }

        // Convert to array and sort descending (most recent first)
        const sortedYears = Array.from(yearsSet).filter(Boolean).sort((a, b) => (a > b ? -1 : 1));

        // Helper to display friendly labels (year -> grade level hint)
        // We use 2026-2027 => 5ème as reference (Alexandre entre en 5ème cette année)
        const labelFor = (y) => {
            let label = y;
            try {
                const start = parseInt(y.split('-')[0], 10);
                const refStart = 2026; // school year starting 2026-2027
                const refGrade = 5; // Alexandre is in 5ème in 2026-2027
                const delta = start - refStart; // years difference
                const grade = refGrade - delta; // grade number for that start year
                if (grade >= 3 && grade <= 6) {
                    label += ` (${grade}ème)`;
                }
            } catch (e) {
                // fallback: do nothing
            }
            return label;
        };

        sortedYears.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = labelFor(y);
            yearFilter.appendChild(opt);
        });

        // If any grades have schoolYear 'Autre', add a specific option
        const hasAutre = grades.some(g => g.schoolYear === 'Autre');
        if (hasAutre) {
            const opt = document.createElement('option');
            opt.value = 'Autre';
            opt.textContent = 'Autres / Non datés';
            yearFilter.appendChild(opt);
        }

        // Determine default selection:
        // - If user had a previous selection (currentVal) and it's available, keep it
        // - Otherwise prefer the current school year (ex: 2026-2027) if present
        // - Fallback to 'all'
        const available = Array.from(yearFilter.options).some(o => o.value === currentVal && currentVal !== 'all');
        const now = new Date();
        const currentSchoolYear = getSchoolYearFromDate(now);
        if (available) {
            yearFilter.value = currentVal;
            selectedSchoolYear = currentVal;
        } else if (currentSchoolYear && Array.from(yearFilter.options).some(o => o.value === currentSchoolYear)) {
            yearFilter.value = currentSchoolYear;
            selectedSchoolYear = currentSchoolYear;
        } else {
            yearFilter.value = 'all';
            selectedSchoolYear = 'all';
        }
        // Disable selector if there is nothing to choose (only 'all')
        if (yearFilter.options.length <= 1) {
            yearFilter.disabled = true;
            yearFilter.title = 'Aucune année scolaire détectée';
        } else {
            yearFilter.disabled = false;
            yearFilter.title = 'Filtrer par année scolaire';
        }
    }

    function renderGradesView() {
        const tbody = document.getElementById('grades-tbody');
        if (!tbody) return;

        // 1. Filtrer par année scolaire
        let displayGrades = [...cachedAllGrades];
        // 0. Filtrer par type de source (Tous / École / Maison)
        if (currentTableType === 'ecole') {
            displayGrades = displayGrades.filter(g => (g.entryType || 'ecole') === 'ecole');
        } else if (currentTableType === 'maison') {
            displayGrades = displayGrades.filter(g => (g.entryType || 'ecole') === 'maison');
        }
        if (selectedSchoolYear !== 'all') {
            displayGrades = displayGrades.filter(g => g.schoolYear === selectedSchoolYear);
        }

        // 2. Trier
        displayGrades.sort((a, b) => {
            let res = 0;
            if (currentSortColumn === 'date') {
                const tA = (a.dateObj && !isNaN(a.dateObj.getTime())) ? a.dateObj.getTime() : 0;
                const tB = (b.dateObj && !isNaN(b.dateObj.getTime())) ? b.dateObj.getTime() : 0;
                res = tA - tB;
            } else if (currentSortColumn === 'subject') {
                res = (a.matière || '').localeCompare(b.matière || '');
            } else if (currentSortColumn === 'coef') {
                res = (a.coefficient || 1) - (b.coefficient || 1);
            } else if (currentSortColumn === 'grade') {
                res = (a.normalized20 || 0) - (b.normalized20 || 0);
            }
            return currentSortDirection === 'asc' ? res : -res;
        });

        // 3. Rendu du tableau
        tbody.innerHTML = '';
        if (displayGrades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="table-empty-row">Aucune note pour cette année scolaire.</td></tr>';
        } else {
            displayGrades.forEach(g => {
                const tr = document.createElement('tr');
                const subjectClass = getSubjectClass(g.matière);
                const noteDisplay = (g.note !== undefined && g.note !== null) ? g.note : '?';

                const safeComment = (g.commentaire || '').replace(/"/g, '&quot;');
                const reportToOpen = g.evaluationReport || (g.commentaire ? {
                    subject: g.matière,
                    grade: g.note,
                    duration: 0,
                    exchanges: 0,
                    appreciation: g.commentaire,
                    date: g.dateObj?.toISOString?.() || new Date().toISOString()
                } : null);
                const reportAction = reportToOpen
                    ? '<button type="button" class="report-open-btn"><i class="fa-solid fa-book-open"></i> Ouvrir</button>'
                    : '';
                tr.innerHTML = `
                    <td><span style="font-family: var(--font-mono);">${g.dateDisplay || '?'}</span></td>
                    <td><span class="subject-tag ${subjectClass}">${g.matière || 'Général'}</span></td>
                    <td class="cell-comment" title="${safeComment}">${g.commentaire || '<span style="opacity:0.4;">-</span>'}</td>
                    <td class="report-cell">${reportAction || '<span class="no-report">-</span>'}</td>
                    <td><span class="coef-val">x${g.coefficient || 1}</span></td>
                    <td><span class="grade-val">${noteDisplay}/${g.barème || 20}</span></td>
                    <td style="opacity:0.85; font-family: var(--font-mono); font-weight: 600;">${g.moyenne !== undefined && g.moyenne !== 0 ? g.moyenne : '-'}</td>
                    <td style="opacity:0.65; font-family: var(--font-mono);">${g.min !== undefined && g.min !== 0 ? g.min : '-'}</td>
                    <td style="opacity:0.65; font-family: var(--font-mono);">${g.max !== undefined && g.max !== 0 ? g.max : '-'}</td>
                `;
                if (reportToOpen) {
                    if (g.evaluationReport) tr.classList.add('evaluation-report-row');
                    tr.querySelector('.report-open-btn')?.addEventListener('click', (event) => {
                        event.stopPropagation();
                        openEvaluationReport(reportToOpen);
                    });
                }
                tbody.appendChild(tr);
            });
        }

        // 4. Recalcul des KPIs sur la sélection filtrée
        let totalPoints = 0;
        let totalCoefficients = 0;
        let bestNormalizedGrade = 0;

        displayGrades.forEach(g => {
            totalPoints += g.normalized20 * g.coefficient;
            totalCoefficients += g.coefficient;
            if (g.normalized20 > bestNormalizedGrade) {
                bestNormalizedGrade = g.normalized20;
            }
        });

        const overallAverage = totalCoefficients > 0 ? (totalPoints / totalCoefficients).toFixed(2) : '--';

        const globalBadge = document.getElementById('global-average-badge');
        if (globalBadge) globalBadge.textContent = overallAverage !== '--' ? `${overallAverage}/20` : '--/20';

        const dashOverall = document.getElementById('dashboard-overall-grade');
        if (dashOverall) dashOverall.textContent = overallAverage;

        const gradesPageAvg = document.getElementById('grades-page-average');
        if (gradesPageAvg) gradesPageAvg.textContent = overallAverage !== '--' ? `${overallAverage}/20` : '--/20';

        const gradesPageBest = document.getElementById('grades-page-best');
        if (gradesPageBest) gradesPageBest.textContent = bestNormalizedGrade > 0 ? `${bestNormalizedGrade.toFixed(2)}/20` : '--/20';

        const gradesPageCount = document.getElementById('grades-page-count');
        if (gradesPageCount) gradesPageCount.textContent = displayGrades.length;

        // 5. Mise à jour des icônes de tri des en-têtes
        document.querySelectorAll('.sortable-th').forEach(th => {
            const col = th.dataset.sort;
            const icon = th.querySelector('i');
            if (col === currentSortColumn) {
                th.classList.add('active-sort');
                if (icon) {
                    icon.className = currentSortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
                }
            } else {
                th.classList.remove('active-sort');
                if (icon) icon.className = 'fa-solid fa-sort';
            }
        });

        // 6. Mise à jour des graphiques Chart.js (ordonnés par date)
        const chartData = [...displayGrades]
            .filter(d => d.dateObj && !isNaN(d.dateObj.getTime()))
            .sort((a, b) => a.dateObj - b.dateObj)
            .map(d => ({
                date: d.dateObj,
                note: d.normalized20,
                min: d.normalizedMin,
                max: d.normalizedMax,
                avg: d.normalizedAvg,
                matiere: d.matière,
                entryType: d.entryType,
                commentaire: d.commentaire,
                coefficient: d.coefficient,
                rawNote: d.note,
                bareme: d.barème
            }));

        updateProgressionChart(chartData);

        const aboveAvg = chartData.filter(d => d.note >= d.avg).length;
        const belowAvg = chartData.filter(d => d.note < d.avg).length;
        updateGradeDistributionChart(aboveAvg, belowAvg);

        // Build monthly counts per subject for stacked bar chart
        const monthlySubjectCounts = {};
        chartData.forEach(d => {
            // Ne compter que les devoirs faits à la maison
            if (d.entryType && d.entryType !== 'maison') return;
            const monthKey = d.date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
            const subjKey = d.matiere ? d.matiere.trim() : 'Général';
            if (!monthlySubjectCounts[monthKey]) monthlySubjectCounts[monthKey] = {};
            monthlySubjectCounts[monthKey][subjKey] = (monthlySubjectCounts[monthKey][subjKey] || 0) + 1;
        });
        updateActivityChart(monthlySubjectCounts);

        // Update radar chart using current radar source selection
        computeAndUpdateRadar();
    }

    // Écouteurs de tri sur les colonnes du tableau
    document.querySelectorAll('.sortable-th').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (currentSortColumn === col) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = col;
                currentSortDirection = (col === 'subject') ? 'asc' : 'desc';
            }
            renderGradesView();
        });
    });

    // Écouteur de filtre d'année scolaire
    const yearFilterSelect = document.getElementById('school-year-filter');
    if (yearFilterSelect) {
        yearFilterSelect.addEventListener('change', (e) => {
            selectedSchoolYear = e.target.value;
            renderGradesView();
        });
    }

    // Table type toggles: Tous | École | Maison
    const tableTypeBtns = document.querySelectorAll('.table-type-btn');
    if (tableTypeBtns && tableTypeBtns.length > 0) {
        // initialise currentTableType depuis le bouton actif si présent
        const activeBtn = Array.from(tableTypeBtns).find(b => b.classList.contains('active'));
        if (activeBtn) currentTableType = activeBtn.dataset.type || 'all';

        tableTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tableTypeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentTableType = btn.dataset.type || 'all';
                renderGradesView();
            });
        });
    }

    // Écouteurs de bascule pour le graphique de progression (Mensuelle vs 15 Devoirs)
    const chartToggleBtns = document.querySelectorAll('.chart-toggle-btn');
    chartToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            chartToggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentProgressionMode = btn.dataset.mode || 'monthly';
            renderGradesView();
        });
    });

    const chartSubjectFilter = document.getElementById('chart-subject-filter');
    if (chartSubjectFilter) {
        chartSubjectFilter.addEventListener('change', (e) => {
            currentProgressionSubject = e.target.value;
            renderGradesView();
        });
    }

    // Radar source buttons
    const radarSourceBtns = document.querySelectorAll('.radar-source-btn');
    if (radarSourceBtns && radarSourceBtns.length > 0) {
        radarSourceBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                radarSourceBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentRadarSource = btn.dataset.source || 'ecole';
                computeAndUpdateRadar();
            });
        });
    }

    async function fetchGradesFromN8N() {
        console.log("Synchronisation des métriques n8n...");
        const webhookUrl = 'https://n8n.n8n-sbf-avocats.fr/webhook/get-grade';
        const tbody = document.getElementById('grades-tbody');

        if (tbody && (tbody.innerText.includes('Aucune') || tbody.innerText.trim() === '')) {
            tbody.innerHTML = '<tr><td colspan="9" class="table-empty-row"><i class="fa-solid fa-circle-notch fa-spin"></i> Récupération des notes sécurisées...</td></tr>';
        }

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            const data = await response.json();
            console.log("Données reçues de n8n:", data);

            let rawItems = [];
            if (Array.isArray(data)) {
                rawItems = data;
            } else if (data && typeof data === 'object') {
                if (Array.isArray(data.data)) rawItems = data.data;
                else if (Array.isArray(data.grades)) rawItems = data.grades;
                else if (Array.isArray(data.items)) rawItems = data.items;
                else if (Array.isArray(data.json)) rawItems = data.json;
                else {
                    const foundArray = Object.values(data).find(v => Array.isArray(v));
                    rawItems = foundArray ? foundArray : [data];
                }
            }

            let allGrades = rawItems.map(item => (item && item.json) ? item.json : item);

            const validGrades = allGrades.filter(g => {
                const s = g.matière || g.subject || g.Matière || g.Subject || g["matière "] || "";
                const n = g.note || g.grade || g.Note || g.Grade || g["note "] || g.valeur || "";
                return s.trim() !== "" && n !== undefined && n !== null && n.toString().trim() !== "";
            });

            const savedReports = getSavedEvaluationReports();
            if (validGrades.length > 0 || savedReports.length > 0) {
                const parseGrade = (val) => {
                    if (val === undefined || val === null || val === "") return 0;
                    if (typeof val === 'string') return parseFloat(val.replace(',', '.'));
                    return parseFloat(val);
                };

                const parseDate = (dateStr) => {
                    if (!dateStr) return new Date(NaN);
                    if (typeof dateStr !== 'string') return new Date(dateStr);
                    if (dateStr.includes('/')) {
                        const parts = dateStr.split('/');
                        if (parts.length === 3) {
                            const d = parseInt(parts[0], 10);
                            const m = parseInt(parts[1], 10) - 1;
                            const y = parseInt(parts[2], 10);
                            return new Date(y, m, d);
                        }
                    }
                    return new Date(dateStr);
                };

                // Mise en mémoire cache complète
                const remoteGrades = validGrades.map(g => {
                    const matiere = g.matière || g.subject || g.Matière || g.Subject || g["matière "] || 'Général';
                    const noteStr = g.note || g.grade || g.Note || g.Grade || g["note "] || g.valeur || "0";
                    const barèmeStr = g.barème || g.scale || g.Barème || g.Scale || g["barème "] || "20";
                    const minStr = g["note la plus basse"] || g.min || g.Min || "";
                    const maxStr = g["note la plus haute"] || g.max || g.Max || "";
                    const avgStr = g.moyenne_classe || g.moyenne || g.avg || g.Moyenne || "";
                    const coef = parseGrade(g.coefficient || g.coef || g.Coefficient || 1) || 1;

                    const rawNote = parseGrade(noteStr);
                    const scale = parseGrade(barèmeStr) || 20;
                    const normalized20 = (rawNote / scale) * 20;

                    const dObj = parseDate(g.date || g.Date || g.timestamp || '');
                    let displayDate = (g.date || g.Date || g.timestamp || '');
                    if (!isNaN(dObj.getTime())) {
                        displayDate = dObj.toLocaleDateString('fr-FR');
                    }

                    const schoolYear = getSchoolYearFromDate(dObj);

                    // Détecter si l'entrée vient de la maison (Home) ou de l'école
                    let entryType = 'ecole';
                    try {
                        const typeFields = [g.type, g.source, g.location, g.origin, g.where, g.devoirType, g.devoir_type, g.Type];
                        const matLower = (matiere || '').toString().toLowerCase();
                        for (const f of typeFields) {
                            if (!f) continue;
                            const s = f.toString().toLowerCase();
                            if (s.includes('home') || s.includes('maison')) { entryType = 'maison'; break; }
                            if (s.includes('ecole') || s.includes('school')) { entryType = 'ecole'; break; }
                        }
                        if (matLower.startsWith('home') || matLower.includes('home-') || matLower.includes('home ')) entryType = 'maison';
                    } catch (e) {
                        entryType = 'ecole';
                    }

                    return {
                        matière: matiere,
                        dateDisplay: displayDate || '?',
                        dateObj: dObj,
                        schoolYear: schoolYear,
                        note: rawNote,
                        barème: scale,
                        normalized20: normalized20,
                        min: parseGrade(minStr),
                        max: parseGrade(maxStr),
                        moyenne: parseGrade(avgStr),
                        normalizedMin: (parseGrade(minStr) / scale) * 20,
                        normalizedMax: (parseGrade(maxStr) / scale) * 20,
                        normalizedAvg: (parseGrade(avgStr) / scale) * 20,
                        commentaire: g.commentaire || g.title || g.Commentaire || '',
                        coefficient: coef,
                        entryType: entryType
                    };
                });
                const savedReportGrades = savedReports.map(report => {
                    const reportDate = new Date(report.date);
                    const grade = parseGrade(report.grade);
                    return {
                        matière: report.subject || 'Général',
                        dateDisplay: isNaN(reportDate.getTime()) ? '?' : reportDate.toLocaleDateString('fr-FR'),
                        dateObj: reportDate,
                        schoolYear: getSchoolYearFromDate(reportDate),
                        note: grade,
                        barème: 20,
                        normalized20: grade,
                        min: 0,
                        max: 0,
                        moyenne: 0,
                        normalizedMin: 0,
                        normalizedMax: 0,
                        normalizedAvg: 0,
                        commentaire: 'Rapport de session avec le professeur IA',
                        coefficient: 1,
                        entryType: 'maison',
                        evaluationReport: report
                    };
                });

                // Une session évaluée peut être présente à la fois dans n8n et dans
                // l'historique local. Fusionner ces deux représentations évite un doublon.
                const sameDay = (firstDate, secondDate) => (
                    firstDate && secondDate && !isNaN(firstDate.getTime()) && !isNaN(secondDate.getTime())
                    && firstDate.toDateString() === secondDate.toDateString()
                );
                const sameSubject = (firstSubject, secondSubject) => {
                    const normalize = value => String(value || '')
                        .toLowerCase()
                        .replace(/^home(?:work)?[-_ ]*/, '')
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-z0-9]/g, '');
                    return normalize(firstSubject) === normalize(secondSubject);
                };
                const unmatchedReports = [];
                const availableRemoteGrades = [...remoteGrades];

                savedReportGrades.forEach(reportGrade => {
                    const matchingRemoteIndex = availableRemoteGrades.findIndex(remoteGrade => (
                        sameDay(remoteGrade.dateObj, reportGrade.dateObj)
                        && sameSubject(remoteGrade.matière, reportGrade.matière)
                        && Math.abs(remoteGrade.normalized20 - reportGrade.normalized20) < 0.01
                    ));
                    const matchingRemote = matchingRemoteIndex >= 0
                        ? availableRemoteGrades.splice(matchingRemoteIndex, 1)[0]
                        : null;

                    if (matchingRemote) {
                        matchingRemote.evaluationReport = reportGrade.evaluationReport;
                        if (!matchingRemote.commentaire) {
                            matchingRemote.commentaire = reportGrade.commentaire;
                        }
                    } else {
                        unmatchedReports.push(reportGrade);
                    }
                });

                cachedAllGrades = remoteGrades.concat(unmatchedReports);
                rebuildRewardsFromGrades(cachedAllGrades);
                renderRecentActivity();

                // Remplir le filtre des années scolaires
                populateSchoolYearFilter(cachedAllGrades);

                // Mettre à jour la sidebar avec les 5 plus récentes absolues
                if (recentGradesList) {
                    recentGradesList.innerHTML = '';
                    const sortedByDate = [...cachedAllGrades]
                        .filter(d => d.dateObj && !isNaN(d.dateObj.getTime()))
                        .sort((a, b) => b.dateObj - a.dateObj);
                    sortedByDate.slice(0, 5).reverse().forEach(g => {
                        updateRecentGrades(g);
                    });
                }

                // Lancer le rendu du tableau, KPIs et graphiques
                renderGradesView();
            } else {
                cachedAllGrades = [];
                renderRecentActivity();
                if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="table-empty-row">Aucune note enregistrée dans la base de données.</td></tr>';
            }
        } catch (error) {
            console.error('Erreur fetch grades:', error);
            cachedAllGrades = [];
            renderRecentActivity();
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="table-empty-row" style="color:var(--cyber-pink);"><i class="fa-solid fa-triangle-exclamation"></i> Connexion aux métriques impossible.</td></tr>';
        }
    }

    // === CHART.JS CONFIGURATIONS (CYBER SENTINEL AESTHETICS & THEME AWARE) ===
    function getChartThemeColors() {
        const isLight = document.body.classList.contains('theme-quantum');
        return {
            isLight: isLight,
            textMain: isLight ? '#0f172a' : '#f8fafc',
            textMuted: isLight ? '#1e293b' : '#cbd5e1',
            textDim: isLight ? '#475569' : '#94a3b8',
            gridColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)',
            tooltipBg: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(14, 20, 34, 0.95)',
            tooltipTitle: isLight ? '#0f172a' : '#ffffff',
            tooltipBody: isLight ? '#0284c7' : '#00e5ff',
            doughnutBorder: isLight ? '#ffffff' : 'rgba(22, 28, 38, 0.95)',
            radarGrid: isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)',
            fontFamily: 'Outfit, sans-serif',
            fontMono: 'JetBrains Mono, monospace'
        };
    }

    function refreshChartStyles() {
        if (cachedAllGrades && cachedAllGrades.length > 0) {
            renderGradesView();
        }
    }

    function updateProgressionChart(rawChartData) {
        const ctx = document.getElementById('progressionChart');
        if (!ctx || typeof Chart === 'undefined') return;

        if (progressionChart) progressionChart.destroy();

        const theme = getChartThemeColors();

        // 1. Exclusion stricte des devoirs "Home" (sessions d'entraînement IA / devoirs maison sans moyenne de classe)
        let data = rawChartData.filter(d => {
            const mat = (d.matiere || '').toLowerCase().trim();
            return !mat.startsWith('home');
        });

        // 2. Filtrage optionnel par matière
        if (currentProgressionSubject !== 'all') {
            data = data.filter(d => {
                if (!d.matiere) return false;
                const base = getSubjectBase(d.matiere);
                const targetBase = getSubjectBase(currentProgressionSubject);
                return base === targetBase || d.matiere.toLowerCase().includes(currentProgressionSubject.toLowerCase());
            });
        }

        if (data.length === 0) {
            progressionChart = new Chart(ctx, {
                type: 'line',
                data: { labels: ['Aucune donnée'], datasets: [] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: 'Aucune évaluation enregistrée pour cette sélection',
                            color: theme.textMuted,
                            font: { family: theme.fontFamily, size: 13, weight: '600' }
                        }
                    }
                }
            });
            return;
        }

        if (currentProgressionMode === 'monthly') {
            // ==========================================
            // MODE 1 : TENDANCE MENSUELLE LISSÉE
            // ==========================================
            const monthMap = new Map();
            data.forEach(d => {
                const y = d.date.getFullYear();
                const m = d.date.getMonth();
                const key = `${y}-${String(m + 1).padStart(2, '0')}`;
                const monthLabel = d.date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
                if (!monthMap.has(key)) {
                    monthMap.set(key, {
                        key: key,
                        label: monthLabel,
                        items: [],
                        timestamp: new Date(y, m, 1).getTime()
                    });
                }
                monthMap.get(key).items.push(d);
            });

            const sortedMonths = Array.from(monthMap.values()).sort((a, b) => a.timestamp - b.timestamp);

            const monthLabels = [];
            const alexAverages = [];
            const classAverages = [];
            const testCounts = [];

            sortedMonths.forEach(m => {
                let totalPts = 0;
                let totalCoef = 0;
                let classTotal = 0;
                let classCount = 0;

                m.items.forEach(it => {
                    const c = it.coefficient || 1;
                    totalPts += it.note * c;
                    totalCoef += c;
                    if (it.avg && it.avg > 0) {
                        classTotal += it.avg;
                        classCount++;
                    }
                });

                const alexAvg = totalCoef > 0 ? parseFloat((totalPts / totalCoef).toFixed(2)) : null;
                const classAvg = classCount > 0 ? parseFloat((classTotal / classCount).toFixed(2)) : null;

                monthLabels.push(m.label);
                alexAverages.push(alexAvg);
                classAverages.push(classAvg);
                testCounts.push(m.items.length);
            });

            // Détection des mois où Alexandre est en-dessous de la moyenne classe -> ROUGE
            const pointColors = alexAverages.map((note, idx) => {
                const cAvg = classAverages[idx];
                return (cAvg !== null && note < cAvg) ? '#ef4444' : '#00e5ff';
            });

            const pointBorderColors = alexAverages.map((note, idx) => {
                const cAvg = classAverages[idx];
                return (cAvg !== null && note < cAvg) ? '#ff9999' : (theme.isLight ? '#ffffff' : '#050811');
            });

            const pointRadii = alexAverages.map((note, idx) => {
                const cAvg = classAverages[idx];
                return (cAvg !== null && note < cAvg) ? 8 : 6;
            });

            progressionChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: monthLabels,
                    datasets: [
                        {
                            label: 'Moyenne Alexandre',
                            data: alexAverages,
                            borderColor: '#00e5ff',
                            backgroundColor: 'rgba(0, 229, 255, 0.12)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.35,
                            segment: {
                                borderColor: (ctx) => {
                                    const p1 = ctx.p1DataIndex;
                                    if (alexAverages[p1] !== null && classAverages[p1] !== null && alexAverages[p1] < classAverages[p1]) {
                                        return '#ef4444'; // Ligne rouge quand inférieure à la moyenne
                                    }
                                    return '#00e5ff';
                                }
                            },
                            pointBackgroundColor: pointColors,
                            pointBorderColor: pointBorderColors,
                            pointBorderWidth: 2,
                            pointRadius: pointRadii,
                            pointHoverRadius: 9
                        },
                        {
                            label: 'Moyenne Classe',
                            data: classAverages,
                            borderColor: theme.isLight ? '#2563eb' : '#3b82f6',
                            backgroundColor: 'transparent',
                            borderWidth: 2.5,
                            borderDash: [5, 5],
                            tension: 0.35,
                            pointBackgroundColor: theme.isLight ? '#2563eb' : '#3b82f6',
                            pointRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 20.5,
                            grid: { color: theme.gridColor },
                            ticks: {
                                stepSize: 2,
                                callback: (val) => val <= 20 ? val : '',
                                color: theme.textMuted,
                                font: { family: theme.fontMono, size: 11, weight: '600' }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: theme.textMuted,
                                font: { family: theme.fontFamily, size: 11, weight: '600' }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                color: theme.textMain,
                                font: { family: theme.fontFamily, size: 12, weight: '700' },
                                usePointStyle: true,
                                padding: 16
                            }
                        },
                        tooltip: {
                            backgroundColor: theme.tooltipBg,
                            borderColor: 'rgba(0, 229, 255, 0.4)',
                            borderWidth: 1,
                            padding: 12,
                            titleColor: theme.tooltipTitle,
                            bodyColor: theme.tooltipBody,
                            titleFont: { family: theme.fontFamily, weight: 'bold' },
                            bodyFont: { family: theme.fontMono },
                            callbacks: {
                                afterTitle: function(context) {
                                    const idx = context[0].dataIndex;
                                    return `${testCounts[idx]} évaluation${testCounts[idx] > 1 ? 's' : ''} ce mois-ci`;
                                },
                                label: function(context) {
                                    const idx = context.dataIndex;
                                    const val = context.parsed.y !== null ? context.parsed.y + '/20' : '-';
                                    if (context.datasetIndex === 0) {
                                        const cAvg = classAverages[idx];
                                        const isBelow = (cAvg !== null && alexAverages[idx] < cAvg);
                                        const alertTxt = isBelow ? ` (⚠️ -${(cAvg - alexAverages[idx]).toFixed(2)} pts sous la classe)` : '';
                                        return `Moyenne Alexandre : ${val}${alertTxt}`;
                                    } else {
                                        return `Moyenne Classe : ${val}`;
                                    }
                                }
                            }
                        }
                    }
                }
            });

        } else {
            // ==========================================
            // MODE 2 : 15 DERNIERS DEVOIRS DÉTAILLÉS (COMBO BARRES PAR MATIÈRE)
            // ==========================================
            const recentItems = data.slice(-15);

            const recentLabels = recentItems.map(d => {
                const dateStr = d.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                let subj = (d.matiere || 'Général');
                if (subj.length > 10) subj = subj.substring(0, 9) + '.';
                return `${dateStr} ${subj}`;
            });

            // Si la note est en dessous de la moyenne de classe -> Barre Rouge d'alerte
            const barColors = recentItems.map(d => {
                if (d.avg && d.avg > 0 && d.note < d.avg) {
                    return '#ef4444'; // ROUGE sous la moyenne de classe
                }
                return getSubjectColor(d.matiere); // Couleur matière si >= moyenne
            });

            const barBorders = recentItems.map(d => {
                if (d.avg && d.avg > 0 && d.note < d.avg) {
                    return '#b91c1c';
                }
                return theme.isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.2)';
            });

            const noteValues = recentItems.map(d => d.note);
            const classValues = recentItems.map(d => (d.avg && d.avg > 0 ? d.avg : null));

            progressionChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: recentLabels,
                    datasets: [
                        {
                            label: 'Note Alexandre (/20)',
                            data: noteValues,
                            backgroundColor: barColors,
                            borderColor: barBorders,
                            borderRadius: 6,
                            borderWidth: 1.5,
                            order: 2
                        },
                        {
                            label: 'Moyenne Classe',
                            data: classValues,
                            type: 'line',
                            borderColor: theme.isLight ? '#2563eb' : '#38bdf8',
                            backgroundColor: 'transparent',
                            borderWidth: 2.5,
                            borderDash: [5, 5],
                            pointBackgroundColor: '#ffffff',
                            pointBorderColor: theme.isLight ? '#2563eb' : '#38bdf8',
                            pointBorderWidth: 2,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 20.5,
                            grid: { color: theme.gridColor },
                            ticks: {
                                stepSize: 2,
                                callback: (val) => val <= 20 ? val : '',
                                color: theme.textMuted,
                                font: { family: theme.fontMono, size: 11, weight: '600' }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: theme.textMuted,
                                font: { family: theme.fontFamily, size: 10, weight: '600' },
                                maxRotation: 45,
                                minRotation: 30
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                color: theme.textMain,
                                font: { family: theme.fontFamily, size: 12, weight: '700' },
                                usePointStyle: true,
                                padding: 16
                            }
                        },
                        tooltip: {
                            backgroundColor: theme.tooltipBg,
                            borderColor: 'rgba(0, 229, 255, 0.4)',
                            borderWidth: 1,
                            padding: 12,
                            titleColor: theme.tooltipTitle,
                            bodyColor: theme.tooltipBody,
                            callbacks: {
                                title: function(context) {
                                    const idx = context[0].dataIndex;
                                    const item = recentItems[idx];
                                    return `${item.matiere || 'Devoir'} • ${item.date.toLocaleDateString('fr-FR')}`;
                                },
                                afterTitle: function(context) {
                                    const idx = context[0].dataIndex;
                                    const item = recentItems[idx];
                                    return item.commentaire ? `« ${item.commentaire} »` : '';
                                },
                                label: function(context) {
                                    const idx = context.dataIndex;
                                    const item = recentItems[idx];
                                    if (context.datasetIndex === 0) {
                                        const noteBrute = item.rawNote !== undefined ? `${item.rawNote}/${item.bareme || 20}` : `${item.note}/20`;
                                        const isBelow = item.avg && item.avg > 0 && item.note < item.avg;
                                        const alertText = isBelow ? ` • ⚠️ Sous la moyenne (-${(item.avg - item.note).toFixed(1)} pts)` : '';
                                        return `Note : ${item.note}/20 (Brut : ${noteBrute} • Coef x${item.coefficient || 1})${alertText}`;
                                    } else {
                                        return `Moyenne classe : ${item.avg && item.avg > 0 ? item.avg + '/20' : 'Non renseignée'}`;
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    function updateGradeDistributionChart(above, below) {
        const ctx = document.getElementById('distributionChart');
        if (!ctx || typeof Chart === 'undefined') return;

        if (distributionChart) distributionChart.destroy();

        const theme = getChartThemeColors();

        const centerMsgPlugin = {
            id: 'centerMsgCyber',
            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;
                ctx.save();
                const total = above + below;
                const ratio = total > 0 ? (above / total) : 0;

                let emoji = "👾";
                let text = "BOSS FIGHT";
                let color = "#ef4444";

                if (ratio >= 0.9) { emoji = "🛡️"; text = "PARE-FEU 100%"; color = "#10b981"; }
                else if (ratio >= 0.75) { emoji = "⚡"; text = "DÉFENSE ACTIVE"; color = theme.isLight ? "#0284c7" : "#00e5ff"; }
                else if (ratio >= 0.5) { emoji = "💻"; text = "EN PROGRESSION"; color = "#f59e0b"; }
                else { emoji = "⚠️"; text = "ALERTE SÉCURITÉ"; color = "#ef4444"; }

                ctx.font = "34px Outfit, sans-serif";
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(emoji, width / 2, height / 2 - 14);

                ctx.font = "bold 13px JetBrains Mono, monospace";
                ctx.fillStyle = color;
                ctx.fillText(text, width / 2, height / 2 + 24);
                ctx.restore();
            }
        };

        distributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['> Moyenne Classe', '< Moyenne Classe'],
                datasets: [{
                    data: [above, below],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderColor: theme.doughnutBorder,
                    borderWidth: 4,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '76%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: theme.textMain,
                            font: { family: theme.fontFamily, size: 12, weight: '700' },
                            padding: 14
                        }
                    },
                    tooltip: {
                        backgroundColor: theme.tooltipBg,
                        borderColor: 'rgba(0, 229, 255, 0.4)',
                        borderWidth: 1,
                        padding: 10,
                        titleColor: theme.tooltipTitle,
                        bodyColor: theme.tooltipBody
                    }
                }
            },
            plugins: [centerMsgPlugin]
        });
    }

    function updateActivityChart(monthlyData) {
        const ctx = document.getElementById('activityChart');
        if (!ctx || typeof Chart === 'undefined') return;

        if (activityChart) activityChart.destroy();

        const theme = getChartThemeColors();
        // monthlyData expected: { monthLabel: { subject: count, ... }, ... }
        const months = Object.keys(monthlyData);
        // gather all subjects across months in stable order
        const subjectSet = new Set();
        months.forEach(m => {
            const obj = monthlyData[m] || {};
            Object.keys(obj).forEach(s => subjectSet.add(s));
        });
        const subjects = Array.from(subjectSet);

        const datasets = subjects.map((s) => {
            const color = getSubjectColor(s) || '#8b5cf6';
            // create rgba for fill
            const bg = color.replace('#', '');
            const r = parseInt(bg.substring(0,2),16);
            const g = parseInt(bg.substring(2,4),16);
            const b = parseInt(bg.substring(4,6),16);
            const backgroundColor = `rgba(${r}, ${g}, ${b}, 0.75)`;
            return {
                label: s,
                data: months.map(m => (monthlyData[m] && monthlyData[m][s]) ? monthlyData[m][s] : 0),
                backgroundColor: backgroundColor,
                borderColor: color,
                borderWidth: 1,
                borderRadius: 6
            };
        });

        activityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { color: theme.textMuted, font: { family: theme.fontFamily, size: 11 } } },
                    y: { stacked: true, beginAtZero: true, grid: { color: theme.gridColor }, ticks: { color: theme.textMuted, stepSize: 1, font: { family: theme.fontMono, size: 11 } } }
                },
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 10, padding: 12, color: theme.textMain, font: { family: theme.fontFamily } } },
                    tooltip: { backgroundColor: theme.tooltipBg, borderColor: theme.tooltipBg, bodyColor: theme.tooltipBody }
                }
            }
        });
    }

    function updateRadarChart(subjectAvg) {
        const ctx = document.getElementById('radarChart');
        if (!ctx || typeof Chart === 'undefined') return;

        if (radarChart) radarChart.destroy();

        const theme = getChartThemeColors();
        const hasData = Object.keys(subjectAvg).length > 0;
        const radarLabels = hasData ? Object.keys(subjectAvg) : ['Aucune donnée'];
        const radarValues = hasData ? Object.values(subjectAvg) : [0];

        radarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: radarLabels,
                datasets: [{
                    label: hasData ? 'Moyenne /20' : 'En attente de notes',
                    data: radarValues,
                    backgroundColor: 'rgba(139, 92, 246, 0.25)',
                    borderColor: '#8b5cf6',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#00e5ff',
                    pointBorderColor: theme.doughnutBorder,
                    pointRadius: 4.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 20,
                        grid: { color: theme.radarGrid },
                        angleLines: { color: theme.radarGrid },
                        ticks: { display: false },
                        pointLabels: {
                            color: theme.textMain,
                            font: { family: theme.fontFamily, size: 12, weight: '700' }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    title: {
                        display: !hasData,
                        text: 'Ajoute une note pour activer le radar',
                        color: theme.textMuted,
                        font: { family: theme.fontFamily, size: 13, weight: '600' }
                    },
                    tooltip: {
                        backgroundColor: theme.tooltipBg,
                        borderColor: 'rgba(139, 92, 246, 0.4)',
                        borderWidth: 1,
                        padding: 10,
                        titleColor: theme.tooltipTitle,
                        bodyColor: theme.tooltipBody
                    }
                }
            }
        });
    }

    // Compute radar averages based on currentRadarSource and selectedSchoolYear
    function computeAndUpdateRadar() {
        if (!cachedAllGrades || cachedAllGrades.length === 0) {
            updateRadarChart({});
            return;
        }

        const filtered = cachedAllGrades.filter(g => {
            if (!g) return false;
            // filter by radar source
            if (currentRadarSource === 'ecole' && g.entryType !== 'ecole') return false;
            if (currentRadarSource === 'maison' && g.entryType !== 'maison') return false;
            // filter by selectedSchoolYear
            if (selectedSchoolYear && selectedSchoolYear !== 'all' && g.schoolYear !== selectedSchoolYear) return false;
            return true;
        });

        const subjectSums = {};
        filtered.forEach(d => {
            if (!d.matière) return;
            const key = d.matière.trim().toUpperCase().replace(/-/g, ' ');
            if (!subjectSums[key]) subjectSums[key] = { total: 0, count: 0 };
            subjectSums[key].total += (d.normalized20 || 0);
            subjectSums[key].count += 1;
        });

        const subjectAverages = {};
        Object.keys(subjectSums).forEach(k => {
            const v = subjectSums[k];
            subjectAverages[k] = v.count > 0 ? parseFloat((v.total / v.count).toFixed(2)) : 0;
        });

        // If no subjects, ensure radar gets an empty object
        updateRadarChart(subjectAverages);
    }

    // === MAGIC DECODER / TRANSLATOR ===
    function setupTranslator() {
        const transInput = document.getElementById('trans-input');
        const transBtn = document.getElementById('trans-btn');
        const transLang = document.getElementById('trans-lang');
        const transResult = document.getElementById('trans-result');
        const transWidget = document.getElementById('translator-widget');
        const filesPanel = document.querySelector('.files-panel');
        const filesHeader = document.querySelector('.files-panel .files-header');

        if (!transBtn || !transInput) return;

        // Keep the translator visible while the Professor view hides the right sidebar.
        if (transWidget && filesPanel && filesHeader) {
            filesHeader.insertAdjacentElement('afterend', transWidget);
        }

        transBtn.addEventListener('click', async () => {
            const text = transInput.value.trim();
            const langPair = transLang.value;
            if (!text) return;

            transBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            transBtn.disabled = true;

            try {
                const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`);
                const data = await response.json();

                if (data.responseData) {
                    transResult.textContent = data.responseData.translatedText;
                    transResult.style.display = 'block';
                } else {
                    transResult.textContent = "Erreur de décodage.";
                    transResult.style.display = 'block';
                }
            } catch (error) {
                console.error("Trans Error:", error);
                transResult.textContent = "Erreur de connexion au service linguistique.";
                transResult.style.display = 'block';
            } finally {
                transBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
                transBtn.disabled = false;
            }
        });

        window.updateTranslatorVisibility = function (subject) {
            const languages = ['anglais', 'italien'];
            if (languages.includes(subject)) {
                transWidget.style.display = 'block';
            } else {
                transWidget.style.display = 'none';
            }
        };
    }

    // === OCR & LESSON UPLOAD ===
    const uploadBtn = document.getElementById('upload-lesson-btn');
    const fileInput = document.getElementById('lesson-file-input');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => {
            const subject = subjectSelect ? subjectSelect.value : '';
            if (!subject) {
                alert("Choisis d'abord une matière avant de scanner ou d'importer un cours ! 📁");
                return;
            }
            fileInput.click();
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const subject = subjectSelect.value;
            const folderId = matiereFolderIds[subject] || '';

            uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyse en cours...';
            uploadBtn.disabled = true;

            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Content = event.target.result.split(',')[1];
                const fileName = `Scan_${Date.now()}_${file.name}`;

                try {
                    const response = await fetch('https://n8n.n8n-sbf-avocats.fr/webhook/upload-lesson', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fileName: fileName,
                            fileContent: base64Content,
                            mimeType: file.type,
                            folderId: folderId,
                            subject: subject,
                            sessionId: sessionId
                        })
                    });

                    if (!response.ok) throw new Error("Erreur serveur upload");

                    const data = await response.json();
                    addMessage(`✅ **Document téléversé & analysé !**\n\nJ'ai extrait le texte de ton document :\n\n${data.ocrText || 'Analyse OCR terminée.'}`, 'bot');
                    fetchFiles(subject);
                } catch (error) {
                    console.error("Upload error:", error);
                    alert("Erreur lors de l'envoi de la leçon. Vérifie ta connexion.");
                } finally {
                    uploadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> <span>Scanner / Importer un cours</span>';
                    uploadBtn.disabled = false;
                    fileInput.value = "";
                }
            };
            reader.readAsDataURL(file);
        });
    }

    setupTranslator();

    if (subjectSelect && window.updateTranslatorVisibility) {
        window.updateTranslatorVisibility(subjectSelect.value);
    }
});
