document.addEventListener('DOMContentLoaded', () => {
    let chatHistory = [];
    let messageCount = 0;
    let activeSpreadsheetId = null; // Stocke l'ID renvoyé par n8n
    let activeSheetId = null; // Stocke le numéro de sheet (gid) renvoyé par n8n

    function generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    let sessionId = generateSessionId();
    let sessionStartTime = null;
    let sessionInterval = null;
    let isTimerPaused = false;
    let elapsedSeconds = 0;
    let currentGradesData = []; // Stockage local des notes pour le tri
    let sessionCharacters = 0; // Caractères tapés durant la session active

    // === HELPERS DÉPORTÉS POUR ACCÈS GLOBAL ===
    const translateAndSpeak = async (text, langPrefix) => {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();

        const cleanText = text.replace(/[*_#`~\[\]]/g, '').replace(/!(.*?\))/g, '');
        let textToSpeak = cleanText;

        if (langPrefix === 'en' || langPrefix === 'it') {
            try {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=${langPrefix}&dt=t&q=${encodeURIComponent(cleanText)}`;
                const response = await fetch(url);
                const data = await response.json();
                textToSpeak = data[0].map(item => item[0]).join('');
            } catch (e) {
                console.error('Erreur traduction:', e);
            }
        }

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        if (langPrefix === 'fr') utterance.lang = 'fr-FR';
        else if (langPrefix === 'en') utterance.lang = 'en-US';
        else if (langPrefix === 'it') utterance.lang = 'it-IT';

        // Paramètres de vitesse et tonalité
        utterance.rate = (langPrefix === 'en' || langPrefix === 'it') ? 0.8 : 1.5; // Un peu plus lent en langues étrangères
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.startsWith(langPrefix));
        if (voice) utterance.voice = voice;

        window.speechSynthesis.speak(utterance);
    };

    const addDualTTSButtons = (containerElement, textToRead, subject = '') => {
        if (!('speechSynthesis' in window) || !textToRead || textToRead.trim() === '') return;

        const ttsContainer = document.createElement('div');
        ttsContainer.style.marginTop = '15px';
        ttsContainer.style.display = 'flex';
        ttsContainer.style.gap = '10px';
        ttsContainer.style.justifyContent = 'center';

        const createBtn = (flag, langPrefix, titleText) => {
            const btn = document.createElement('button');
            btn.innerHTML = `<i class="fa-solid fa-volume-high"></i> ${flag}`;
            btn.className = 'tts-btn';
            btn.style.width = 'auto';
            btn.style.padding = '5px 15px';
            btn.style.borderRadius = '20px';
            btn.style.fontSize = '0.9rem';
            btn.title = titleText;

            btn.onclick = () => {
                const icon = btn.querySelector('i');
                const oldClass = icon.className;
                icon.className = 'fa-solid fa-spinner fa-spin'; // Indicateur de chargement

                translateAndSpeak(textToRead, langPrefix).finally(() => {
                    icon.className = oldClass;
                });
            };
            return btn;
        };

        ttsContainer.appendChild(createBtn('🇫🇷', 'fr', 'Écouter en Français'));
        
        let normalizedSubject = subject ? subject.toLowerCase() : '';
        if (normalizedSubject === 'italien') {
            ttsContainer.appendChild(createBtn('🇮🇹', 'it', 'Écouter en Italien'));
        } else {
            ttsContainer.appendChild(createBtn('🇬🇧', 'en', 'Écouter en Anglais'));
        }
        
        containerElement.appendChild(ttsContainer);
    };

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

    function normalizeGrade(g) {
        if (!g) return null;

        // Détection flexible des champs (Matière)
        const matiere = g.matière || g.subject || g.Matière || g.Subject || g["matière "] || g["subject "] || 'Général';

        // Détection flexible des champs (Note)
        const getVal = (obj, keys, def) => {
            for (let k of keys) {
                // On vérifie la clé exacte ET la clé avec un espace final (classique de n8n/Excel)
                const val = (obj[k] !== undefined) ? obj[k] : obj[k + " "];
                if (val !== undefined && val !== null && val.toString().trim() !== "") return val;
                if (val === 0) return 0;
            }
            return def;
        };

        const noteVal = getVal(g, ['note', 'grade', 'Note', 'Grade', 'valeur'], "0");
        const baremeVal = getVal(g, ['barème', 'scale', 'Barème', 'Scale', 'sur'], "20");
        const minVal = getVal(g, ['note la plus basse', 'min', 'Min', 'minimum'], "");
        const maxVal = getVal(g, ['note la plus haute', 'max', 'Max', 'maximum'], "");
        const avgVal = getVal(g, ['moyenne_classe', 'moyenne', 'avg', 'Moyenne', 'moyenne '], "");
        const coefVal = getVal(g, ['coefficient', 'coef', 'Coefficient', 'Coef'], 1);
        const commentVal = g.commentaire || g.title || g.Commentaire || g.Comment || g["commentaire "] || '';
        const dateVal = g.date || g.Date || g.timestamp || g.Timestamp || g["date "] || '';

        const dObj = parseDate(dateVal);
        let displayDate = dateVal;
        if (!isNaN(dObj.getTime())) {
            displayDate = dObj.toLocaleDateString('fr-FR');
        }

        return {
            matière: matiere,
            date: displayDate || '?',
            note: parseGrade(noteVal),
            barème: parseGrade(baremeVal),
            min: minVal !== "" ? parseGrade(minVal) : null,
            max: maxVal !== "" ? parseGrade(maxVal) : null,
            moyenne: avgVal !== "" ? parseGrade(avgVal) : null,
            commentaire: commentVal,
            coefficient: parseGrade(coefVal),
            timestamp: dateVal
        };
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
            view.style.display = 'none'; // Force hide
        });

        // Activate specific nav item
        const activeNav = document.querySelector(`.nav-item[data-target="${targetId}"]`);
        if (activeNav) activeNav.classList.add('active');

        // Show specific view
        const targetView = document.getElementById(targetId);
        if (targetView) {
            targetView.classList.add('active-view');
            targetView.style.display = 'block'; // Force show
        }

        // Sidebar Visibility Logic
        if (rightSidebar) {
            if (targetId === 'dashboard' || targetId === 'grades' || targetId === 'chat') {
                rightSidebar.classList.remove('hidden-sidebar');
                rightSidebar.style.display = 'block';
            } else {
                rightSidebar.classList.add('hidden-sidebar');
                rightSidebar.style.display = 'none';
            }
        }

        // Si on va sur la page des notes, succès ou historique, on rafraîchit les données
        if (targetId === 'grades' || targetId === 'achievements') {
            fetchGradesFromN8N();
        }
        if (targetId === 'history') {
            refreshHistory();
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

    // === THEME SWITCHER ===
    const themeToggle = document.getElementById('theme-toggle');
    const themes = ['default', 'theme-clouds', 'theme-space'];
    let currentThemeIndex = 0;

    // Load saved theme
    const savedTheme = localStorage.getItem('app-theme') || 'default';
    currentThemeIndex = themes.indexOf(savedTheme);
    if (currentThemeIndex === -1) currentThemeIndex = 0;
    applyTheme(themes[currentThemeIndex]);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            currentThemeIndex = (currentThemeIndex + 1) % themes.length;
            const newTheme = themes[currentThemeIndex];
            applyTheme(newTheme);
            localStorage.setItem('app-theme', newTheme);
        });
    }

    function applyTheme(themeName) {
        // Remove all theme classes
        document.body.classList.remove('theme-clouds', 'theme-space', 'theme-superhero');

        // Add new class if not default
        if (themeName !== 'default') {
            document.body.classList.add(themeName);
        }

        console.log(`Thème appliqué : ${themeName}`);
    }

    function updateTitle(viewId) {
        const titles = {
            'dashboard': 'Tableau de Bord',
            'chat': 'Le Professeur',
            'grades': 'Carnet de Notes',
            'achievements': 'Succès & Évaluations'
        };
        pageTitle.textContent = titles[viewId] || 'Alexandre Academy';
    }

    // === CHAT SYSTEM ===
    const chatInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('chat-messages');

    // Send on Enter
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleUserMessage();
        }
    });

    // Send on Click
    sendBtn.addEventListener('click', handleUserMessage);

    async function handleUserMessage() {
        const text = chatInput.value.trim();
        if (text === "") return;

        // 1. Add User Message
        addMessage(text, 'user');
        sessionCharacters += text.length;
        chatInput.value = "";

        // Démarrage automatique du timer si pas encore lancé
        if (!sessionStartTime) {
            startSessionTimer();
        } else {
            resumeTimer(); // Reprendre automatiquement si en pause
        }

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
        messageCount = 0; // Reset du compteur
        activeSpreadsheetId = null; // Reset de l'ID Google Sheet
        activeSheetId = null; // Reset du numéro de sheet
        sessionId = generateSessionId(); // Nouveau ID pour n8n
        sessionStartTime = null; // Reset du timer
        stopSessionTimer();
        console.log("Nouveau Chat - Session ID:", sessionId);
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="message bot">
                    <div class="bubble">
                        Bonjour Alexandre ! Choisis une leçon sur la gauche pour commencer à travailler.
                    </div>
                </div>
            `;
        }
    }

    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        const bubble = document.createElement('div');
        bubble.classList.add('bubble');

        if (sender === 'bot') {
            bubble.innerHTML = parseMarkdown(text);

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

            // --- TEXT TO SPEECH (Pour la partie anglais et italien) ---
            const subjectSelect = document.getElementById('subject-select');
            const subject = subjectSelect ? subjectSelect.value : '';

            if ((subject === 'anglais' || subject === 'italien') && 'speechSynthesis' in window) {
                const ttsContainer = document.createElement('div');
                ttsContainer.style.marginTop = '10px';
                ttsContainer.style.textAlign = 'right';

                const langPrefix = subject === 'anglais' ? 'en' : 'it';
                const langTitle = subject === 'anglais' ? 'anglais' : 'italien';

                const ttsBtn = document.createElement('button');
                ttsBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
                ttsBtn.className = 'tts-btn';
                ttsBtn.title = `Écouter la réponse en ${langTitle}`;

                const playAudio = async () => {
                    const icon = ttsBtn.querySelector('i');
                    if (icon) {
                        icon.className = 'fa-solid fa-spinner fa-spin';
                    }

                    await translateAndSpeak(text, langPrefix);

                    if (icon) {
                        icon.className = 'fa-solid fa-volume-high';
                    }
                };

                ttsBtn.onclick = playAudio;

                ttsContainer.appendChild(ttsBtn);
                bubble.appendChild(ttsContainer);

                // Lecture automatique
                setTimeout(playAudio, 300);
            }
        } else {
            bubble.textContent = text;
        }

        messageDiv.appendChild(bubble);
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        chatHistory.push({
            role: sender === 'user' ? 'user' : 'assistant',
            text: text
        });
    }

    // === MARKDOWN PARSER ===
    function parseMarkdown(text) {
        let html = text;

        // 1. Images: ![Alt](URL)
        html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" title="$1">');

        // 2. Bold: **text**
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // 3. Italics: *text*
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // 4. Headers: ### Title
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // 5. Code: `text`
        html = html.replace(/`(.*?)`/g, '<code>$1</code>');

        // 6. Horizontal Rules: ---
        html = html.replace(/^---$/gim, '<hr>');

        // 7. Lists: * item or - item
        // Replace list items at start of lines
        html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
        html = html.replace(/^- (.*$)/gim, '<li>$1</li>');

        // Wrap <li> in <ul> if needed (simplified)
        // Note: For a more robust solution, a real Markdown parser would be better,
        // but this handles basic bot responses.

        // 8. Line breaks (preserve existing <br> and add for single newlines)
        html = html.replace(/\n\n/g, '<br><br>');
        html = html.replace(/\n(?!(?:<h|<hr|<li|<img))/g, '<br>');

        return html;
    }

    // === N8N INTEGRATION STUB ===
    // This function is ready to be connected to a real Webhook
    // === N8N INTEGRATION ===
    // === FILE EXPLORER LOGIC ===
    let activeFileId = null;
    let activeFileName = null;

    const matiereFolderIds = {
        'mathematiques': '19Vs0a7oJqJXxFq_KCT02YQjpJ5Ldf7vT',
        'francais': '1k8eQKIa7P-5SQpB14ZwAd6CWVOZ4xdKi',
        'svt': '1p2Ejj0SO9sYMbGSyQlubtggSdVdF2By_',
        'anglais': '1MGcH5CHXdvpFdbpITILDkNY18DBd4Lxi',
        'histoire': '1S1VL9NVn9pveMgLUG0oaHsryCKcAuuVr',
        'italien': '1yrBYXVzNvKqLKOQbXIToELdi1DcacJok',
        'physique': '1Dy7dl-IHezoMHbefsXvnwYqz_y4NyM4a'
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
        filesList.innerHTML = '<div class="file-loader"><i class="fa-solid fa-circle-notch fa-spin"></i> Chargement...</div>';

        const folderId = matiereFolderIds[matiere] || '';
        const webhookUrl = 'https://n8n.n8n-sbf-avocats.fr/webhook/get-files'; // Placeholder

        try {
            // Simulate API call or real call
            // For now, mocking response if folderId is empty, or trying real fetch
            // Call n8n Webhook
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderId: folderId, matiere: matiere })
            });

            if (!response.ok) {
                console.error(`Fetch files error: ${response.status}`);
                filesList.innerHTML = `<div style="color:var(--fn-pink); font-size: 0.8rem;">Erreur serveur (${response.status}).</div>`;
                return;
            }

            const text = await response.text();
            if (!text) {
                console.warn('Réponse vide du serveur n8n');
                renderFiles([]);
                return;
            }

            const data = JSON.parse(text);
            console.log('Données reçues de n8n:', data);

            // Handle different possible response structures from n8n
            // Array directly: [{name: '...', ...}, ...]
            // Object with key: { files: [...] } or { data: [...] }
            let files = [];
            if (Array.isArray(data)) {
                files = data;
            } else if (data.files && Array.isArray(data.files)) {
                files = data.files;
            } else if (data.data && Array.isArray(data.data)) {
                files = data.data;
            } else if (data && typeof data === 'object' && data.id && data.name) {
                // Fallback: Single file object
                files = [data];
            } else {
                console.warn('Structure de réponse inconnue:', data);
            }

            renderFiles(files);

        } catch (error) {
            console.error('Error fetching files:', error);
            filesList.innerHTML = '<div style="color:red; padding:10px;">Erreur de chargement.</div>';
        }
    }

    function generateMockFiles(matiere) {
        // Just for demo purposes until Webhook is ready
        const common = [
            { id: '1', name: 'Leçon 1: Introduction', type: 'pdf' },
            { id: '2', name: 'Exercices Pratiques', type: 'doc' },
            { id: '3', name: 'Correction du contrôle', type: 'pdf' }
        ];
        return common.map(f => ({ ...f, name: `${f.name} - ${matiere.toUpperCase()}`, id: Math.random().toString(36).substr(2, 9) }));
    }

    function renderFiles(files) {
        const filesList = document.getElementById('files-list');
        filesList.innerHTML = '';

        if (files.length === 0) {
            filesList.innerHTML = '<div style="padding:15px; color:#aaa;">Aucun fichier trouvé.</div>';
            return;
        }

        files.forEach(file => {
            const card = document.createElement('div');
            card.classList.add('file-card');
            card.dataset.id = file.id;
            card.onclick = () => selectFile(file.id, file.name, card);

            card.innerHTML = `
                <i class="fa-solid fa-file-pdf"></i>
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-meta">PDF • 2.4 MB</span>
                </div>
                <i class="fa-solid fa-chevron-right" style="font-size: 0.8rem; opacity: 0.5;"></i>
            `;
            filesList.appendChild(card);
        });
    }

    let activeFileSent = false; // Flag to track if file ID was sent

    function selectFile(fileId, fileName, cardElement) {
        activeFileId = fileId;
        activeFileName = fileName;
        activeFileSent = false; // Reset when new file selected

        // UI Updates
        document.querySelectorAll('.file-card').forEach(c => c.classList.remove('active'));
        cardElement.classList.add('active');

        document.getElementById('active-lesson-name').textContent = fileName;

        // System Message
        addMessage(`📂 Fichier sélectionné : **${fileName}**. Je suis prêt à t'aider !`, 'bot');

        // Start Session Timer
        startSessionTimer();
    }

    function resetSelection() {
        activeFileId = null;
        activeFileName = null;
        activeFileSent = false;
        document.getElementById('active-lesson-name').textContent = 'Aucune (Chat libre)';
        stopSessionTimer();
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

        timerEl.style.display = 'flex';
        timeDisplay.textContent = "00:00";

        sessionInterval = setInterval(() => {
            if (!isTimerPaused) {
                elapsedSeconds++;
                const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
                const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
                timeDisplay.textContent = `${minutes}:${seconds}`;
                updateSessionGauge();
            }
        }, 1000);
    }

    function updateSessionGauge() {
        const gaugeFill = document.getElementById('gauge-fill');
        const gaugePercent = document.getElementById('gauge-percent');
        const gaugeContainer = document.getElementById('session-gauge');

        if (!gaugeFill || !gaugeContainer) return;

        // On affiche la jauge seulement si une session est active
        gaugeContainer.style.display = (sessionStartTime) ? 'flex' : 'none';
        if (!sessionStartTime) return;

        // LOGIQUE D'ESTIMATION (Sur 100 points)
        // 1. Temps (Max 50 pts si >= 30 min / 1800s)
        const timeScore = Math.min(50, (elapsedSeconds / 1800) * 50);
        // 2. Effort/Texte (Max 50 pts si >= 1500 chars)
        const chatScore = Math.min(50, (sessionCharacters / 1500) * 50);

        const totalScore = Math.round(timeScore + chatScore);

        // Update UI
        gaugeFill.style.width = `${Math.max(5, totalScore)}%`;
        if (gaugePercent) gaugePercent.textContent = `${totalScore}%`;

        // Color mapping
        if (totalScore < 30) {
            gaugeFill.style.background = '#ff4d4d'; // Rouge
            gaugeFill.style.boxShadow = '0 0 15px rgba(255, 77, 77, 0.4)';
        } else if (totalScore < 60) {
            gaugeFill.style.background = '#ff9f43'; // Orange
            gaugeFill.style.boxShadow = '0 0 15px rgba(255, 159, 67, 0.4)';
        } else if (totalScore < 85) {
            gaugeFill.style.background = '#f3f91d'; // Jaune
            gaugeFill.style.boxShadow = '0 0 15px rgba(243, 249, 29, 0.4)';
        } else {
            gaugeFill.style.background = '#2ecc71'; // Vert
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
        if (isTimerPaused) {
            togglePauseTimer();
        }
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

    if (evaluateBtn) {
        evaluateBtn.addEventListener('click', () => {
            // Stop timer but keep start time for calculation
            const endTime = Date.now();
            let durationMinutes = 0;

            if (elapsedSeconds > 0) {
                durationMinutes = Math.ceil(elapsedSeconds / 60); // Arrondi supérieur
                if (durationMinutes < 1) durationMinutes = 1; // Minimum 1 min
                console.log(`⏱️ Fin session. Durée: ${elapsedSeconds}s = ${durationMinutes} min`);
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
        });
    }

    async function evaluateSession(durationMinutes) {
        if (!evalModal) return;
        evalModal.style.display = 'flex';

        document.getElementById('eval-loading').style.display = 'block';
        document.getElementById('eval-result').style.display = 'none';

        // Collect Data
        const subjectSelect = document.getElementById('subject-select');
        const subject = subjectSelect ? subjectSelect.value : 'Général';
        const exchanges = Math.floor(chatHistory.length / 2); // Roughly user + bot pairs

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

            console.log("Statut réponse webhook:", response.status);

            if (!response.ok) {
                const errText = await response.text();
                console.error("Erreur serveur:", errText);
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const rawText = await response.text();
            console.log("Réponse brute reçue:", rawText);

            let data;
            try {
                data = JSON.parse(rawText);
            } catch (e) {
                console.error("Erreur parsing JSON:", e);
                throw new Error("Réponse invalide (pas du JSON)");
            }

            // Handle array response (take first item)
            if (Array.isArray(data)) {
                data = data[0];
            }

            // Display Results
            document.getElementById('eval-loading').style.display = 'none';
            document.getElementById('eval-result').style.display = 'block';

            // Update UI with data from N8N (Flexible mapping)
            // Fields: "note ", "commentaire", "matière" OR "grade", "appreciation", "subject"
            const note = data.grade || data.note || data["note "] || 0;
            const appreciation = data.appreciation || data.message || data.commentaire || "Session enregistrée.";
            const itemSubject = data.subject || data.matière || data.matiere || subject;

            document.getElementById('eval-grade').textContent = note;
            document.getElementById('eval-exchanges').textContent = exchanges;
            document.getElementById('eval-duration').textContent = durationMinutes;
            document.getElementById('eval-subject').textContent = itemSubject;

            const appreciationDiv = document.getElementById('eval-appreciation');
            appreciationDiv.innerHTML = `<p>${appreciation.replace(/\n/g, '<br>')}</p>`;
            addDualTTSButtons(appreciationDiv, appreciation, itemSubject);

            // Colorize grade circle based on note
            const gradeCircle = document.querySelector('.grade-circle');
            if (gradeCircle) {
                gradeCircle.style.borderColor = note >= 15 ? '#2ecc71' : (note >= 10 ? '#f3f91d' : '#ff4d4d');
                gradeCircle.style.color = note >= 15 ? '#2ecc71' : (note >= 10 ? '#f3f91d' : '#ff4d4d');
            }

            // Refresh grades to show the new one if added
            fetchGradesFromN8N();

        } catch (error) {
            console.error("Evaluation error:", error);
            document.getElementById('eval-loading').innerHTML = `<p style="color:#ff4d4d">Erreur lors de l'évaluation.<br>Réessaie plus tard.</p>`;
        }
    }

    // === N8N INTEGRATION ===
    async function sendMessageToN8N(message) {
        const subjectSelect = document.getElementById('subject-select');
        const subject = subjectSelect ? subjectSelect.value : 'mathematiques';

        // Get Selected Work Mode
        const selectedModeEl = document.querySelector('input[name="work-mode"]:checked');
        const workMode = selectedModeEl ? selectedModeEl.value : 'revision';

        const webhookUrl = `https://n8n.n8n-sbf-avocats.fr/webhook/${subject}`;

        try {
            messageCount++; // Incrémentation à chaque envoi

            // Logic to send file ID only once per active selection
            let fileIdToSend = "";
            if (activeFileId && !activeFileSent) {
                fileIdToSend = activeFileId;
                activeFileSent = true;
            }

            const body = {
                chatInput: message,
                subject: subject,
                workMode: workMode,
                activeFileId: fileIdToSend,
                activeFileName: activeFileName || '',
                history: chatHistory,
                sessionId: sessionId,
                messageCount: messageCount,
                spreadsheetId: activeSpreadsheetId || '',
                sheetId: activeSheetId || ''
            };

            console.log(`DEBUG Fetching: ${webhookUrl}`);
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`ERROR Webhook: ${response.status} ${response.statusText}`, errorText);
                return `Désolé, j'ai une erreur technique (Code ${response.status}). Vérifie que le webhook "**${subject}**" est bien actif dans n8n !`;
            }

            const data = await response.json();
            console.log('DEBUG Response:', data);

            // --- RECHERCHE INTELLIGENTE DANS LA RÉPONSE ---
            let items = Array.isArray(data) ? data : [data];
            let responseText = null;

            items.forEach(item => {
                // 1. Recherche de l'ID Spreadsheet ou URL
                if (item.spreadsheetId) activeSpreadsheetId = item.spreadsheetId;
                if (item.spreadsheetUrl && !activeSpreadsheetId) {
                    // Extraction de l'ID depuis l'URL (entre /d/ et /edit)
                    const match = item.spreadsheetUrl.match(/\/d\/(.*?)(\/|$)/);
                    if (match) activeSpreadsheetId = match[1];
                }

                // 2. Recherche du Sheet ID (GID) - Gestion de votre format spécifique
                if (item.sheetId || item.sheetNumber || item.gid) {
                    activeSheetId = item.sheetId || item.sheetNumber || item.gid;
                } else if (item.sheets && item.sheets[0]?.properties?.sheetId !== undefined) {
                    // Cas spécifique de votre JSON: sheets[0].properties.sheetId
                    activeSheetId = item.sheets[0].properties.sheetId;
                }

                // 3. Recherche de la Réponse IA (on prend la première trouvée)
                if (!responseText) {
                    responseText = item.Réponse || item.reponse || item.response ||
                        item.text || item.output ||
                        item.content?.parts?.[0]?.text;
                }
            });

            if (activeSpreadsheetId) console.log("ID Spreadsheet stocké :", activeSpreadsheetId);
            if (activeSheetId !== null) console.log("ID Sheet stocké :", activeSheetId);

            if (responseText) {
                return typeof responseText === 'string' ? responseText : JSON.stringify(responseText);
            }

            console.warn("Format de réponse non reconnu. Données:", data);
            return "Je n'ai pas compris la réponse du serveur (voir console pour détails).";
        } catch (error) {
            console.error('Erreur:', error);
            return "Une erreur est survenue lors de la communication avec le professeur.";
        }
    }

    function showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const msgDiv = document.createElement('div');
        msgDiv.id = id;
        msgDiv.classList.add('message', 'bot');
        msgDiv.innerHTML = `<div class="bubble" style="color: #aaa; font-style: italic;">...</div>`;
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

    window.sendMessageToN8N = sendMessageToN8N;

    // === GLOBAL FUNCTIONS FOR ONCLICK ===
    window.navigateTo = function (targetId, initialMessage = null) {
        const navItem = document.querySelector(`.nav-item[data-target="${targetId}"]`);
        if (navItem) navItem.click();

        if (initialMessage && targetId === 'chat') {
            setTimeout(() => {
                displayResponse(initialMessage);
            }, 500);
        }
    };

    window.startSubject = function (subject) {
        navigateTo('chat');

        const subjectMap = {
            'Mathématiques': 'mathematiques',
            'Français': 'francais',
            'Histoire-Géo': 'histoire',
            'Sciences': 'svt',
            'Anglais': 'anglais',
            'Italien': 'italien',
            'Physique/Chimie': 'physique',
            'Arts plastiques': 'arts',
            'Sport': 'sport',
            'Éducation musicale': 'musique'
        };

        const val = subjectMap[subject] || 'mathematiques';
        const select = document.getElementById('subject-select');
        if (select) {
            select.value = val;
            clearChatHistory();
            // Trigger fetch
            fetchFiles(val);
            if (window.updateTranslatorVisibility) {
                window.updateTranslatorVisibility(val);
            }
        }
    };

    // --- GRADE FILTERING ---

    window.filterGrades = function (type) {
        // Update UI Tabs
        const tabs = document.querySelectorAll('.filter-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        const activeTab = document.getElementById(`filter-${type}`);
        if (activeTab) activeTab.classList.add('active');

        // Re-render table with filter
        if (!currentGradesData || currentGradesData.length === 0) return;

        // Use the same detection logic as everywhere else
        const detectIsHome = (g) => {
            const subject = (g.matière || g.subject || g.Matière || g.Subject || "").toLowerCase();
            const comment = (g.commentaire || g.title || g.Commentaire || "").toLowerCase();
            return subject.startsWith('home') || comment.startsWith('[home]');
        };

        let filtered = currentGradesData;
        if (type === 'home') {
            filtered = currentGradesData.filter(g => detectIsHome(g));
        } else if (type === 'school') {
            filtered = currentGradesData.filter(g => !detectIsHome(g));
        }

        // We need to re-render. Since we use 'append', we sort DESC (newest first)
        filtered.sort((a, b) => {
            const timeA = parseDate(a.date || a.timestamp || '').getTime();
            const timeB = parseDate(b.date || b.timestamp || '').getTime();
            return timeB - timeA;
        });

        gradesTbody.innerHTML = '';
        if (filtered.length === 0) {
            gradesTbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; opacity: 0.5;">Aucune note correspondant au filtre.</td></tr>';
        } else {
            filtered.forEach(g => {
                addGradeToTable(g, 'append');
            });
        }
    };

    // === GRADE BOOK LOGIC ===
    const gradeForm = document.getElementById('grade-form');
    const gradesTbody = document.getElementById('grades-tbody');
    const recentGradesList = document.getElementById('recent-grades-list');
    let progressionChart = null;
    let distributionChart = null;
    let activityChart = null;
    let radarChart = null;
    let monthlyAverageChart = null;

    if (gradeForm) {
        gradeForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const subject = document.getElementById('grade-subject').value;

            if (!subject || subject === "") {
                alert("Oups ! Tu as oublié de choisir la matière. 😉");
                return;
            }

            const title = document.getElementById('grade-title').value || "";
            const value = document.getElementById('grade-value').value;
            const scale = document.getElementById('grade-scale').value || 20;
            const classAverage = document.getElementById('grade-class-average').value || "";
            const rawDate = document.getElementById('grade-date').value;
            const coefficient = document.getElementById('grade-coefficient').value;
            const gradeMin = document.getElementById('grade-min').value || "";
            const gradeMax = document.getElementById('grade-max').value || "";

            const gradeData = {
                matière: subject,
                commentaire: title,
                date: rawDate,
                note: value,
                barème: scale,
                moyenne: classAverage,
                min: gradeMin,
                max: gradeMax,
                coefficient: coefficient,
                timestamp: new Date().toISOString()
            };

            // 1. UI Update (Local)
            const normalizedNewGrade = normalizeGrade(gradeData);
            if (normalizedNewGrade) {
                currentGradesData.push(normalizedNewGrade);
            }
            addGradeToTable(normalizedNewGrade || gradeData);
            updateRecentGrades(normalizedNewGrade || gradeData);
            updatePlaystationTime(currentGradesData); // Refresh calculations
            gradeForm.reset();

            // 2. Send to N8N
            const success = await sendGradeToN8N(gradeData);

            if (success) {
                alert('Note enregistrée avec succès !');
            } else {
                alert('Erreur lors de l\'envoi de la note.');
            }
        });
    }

    function addGradeToTable(data, method = 'prepend') {
        if (!data) return;

        // On ne vide que si c'est vraiment le message par défaut
        if (gradesTbody.innerText.includes('Aucune pour le moment') || gradesTbody.innerText.includes('Aucune note trouvée')) {
            gradesTbody.innerHTML = '';
        }

        const tr = document.createElement('tr');
        const subjectClass = getSubjectClass(data.matière);
        const noteDisplay = (data.note !== undefined && data.note !== null) ? data.note : '?';
        const avgDisplay = (data.moyenne !== undefined && data.moyenne !== null) ? data.moyenne : '-';
        const minDisplay = (data.min !== undefined && data.min !== null) ? data.min : '-';
        const maxDisplay = (data.max !== undefined && data.max !== null) ? data.max : '-';

        const fullComment = data.commentaire || '';
        const shortComment = fullComment.length > 50 ? fullComment.substring(0, 50) + '...' : fullComment;

        // Detection of Home vs School via prefix "home"
        const matiere = (data.matière || "").toLowerCase();
        const isHome = matiere.startsWith('home') || fullComment.toLowerCase().startsWith('[home]');
        const locationBadge = isHome
            ? '<span class="location-badge badge-home" title="Travail Maison"><i class="fa-solid fa-house"></i></span>'
            : '<span class="location-badge badge-school" title="Travail École"><i class="fa-solid fa-school"></i></span>';

        tr.innerHTML = `
            <td>${data.date || '?'}</td>
            <td>
                <div style="display:flex; align-items:center; gap:5px;">
                    ${locationBadge}
                    <span class="subject-tag ${subjectClass}">${data.matière || 'Autre'}</span>
                </div>
            </td>
            <td class="clickable-comment" title="Voir le détail">${shortComment}</td>
            <td><span class="coef-val">x${data.coefficient || 1}</span></td>
            <td><span class="grade-val">${noteDisplay}/${data.barème || 20}</span></td>
            <td style="opacity:0.8">${avgDisplay}</td>
            <td style="opacity:0.7">${minDisplay}</td>
            <td style="opacity:0.7">${maxDisplay}</td>
        `;

        // Add listener to open modal
        const commentCell = tr.querySelector('.clickable-comment');
        if (fullComment && commentCell) {
            commentCell.addEventListener('click', () => {
                openGradeDetail(data);
            });
            commentCell.style.cursor = 'pointer';
            commentCell.style.textDecoration = 'underline dotted rgba(255,255,255,0.5)';
        }

        if (method === 'prepend') {
            gradesTbody.prepend(tr);
        } else {
            gradesTbody.appendChild(tr);
        }
    }

    // === GRADE DETAIL MODAL ===
    const gradeDetailModal = document.getElementById('grade-detail-modal');
    const closeGradeDetailBtn = document.getElementById('close-detail-modal');

    if (closeGradeDetailBtn) {
        closeGradeDetailBtn.addEventListener('click', () => {
            if (gradeDetailModal) gradeDetailModal.style.display = 'none';
        });
    }

    function openGradeDetail(data) {
        if (!gradeDetailModal) return;

        const note = (data.note !== undefined && data.note !== null) ? data.note : '?';
        const subject = data.matière || 'Autre';
        const date = data.date || '?';
        const comment = data.commentaire || 'Aucun commentaire.';

        document.getElementById('detail-modal-grade').textContent = note;
        document.getElementById('detail-modal-subject').textContent = subject;
        document.getElementById('detail-modal-date').textContent = date;
        const detailCommentDiv = document.getElementById('detail-modal-comment');
        detailCommentDiv.innerHTML = `<p>${comment.replace(/\n/g, '<br>')}</p>`;
        addDualTTSButtons(detailCommentDiv, comment);

        // Colorize
        const gradeCircle = gradeDetailModal.querySelector('.grade-circle');
        if (gradeCircle && typeof note === 'number') {
            gradeCircle.style.borderColor = note >= 15 ? '#2ecc71' : (note >= 10 ? '#f3f91d' : '#ff4d4d');
            gradeCircle.style.color = note >= 15 ? '#2ecc71' : (note >= 10 ? '#f3f91d' : '#ff4d4d');
        }

        gradeDetailModal.style.display = 'flex';
    }

    function updateRecentGrades(data) {
        if (!recentGradesList) return;

        const div = document.createElement('div');
        div.classList.add('stat-item');
        const subjectTextClass = getSubjectTextClass(data.matière);
        const subjectBgClass = getSubjectBgClass(data.matière);
        const scale = data.barème || 20;
        const normalizedNote = (data.note / scale) * 20;
        const percentage = (data.note / scale) * 100;

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
        if (recentGradesList.children.length > 4) {
            recentGradesList.removeChild(recentGradesList.lastChild);
        }
    }

    function getSubjectBase(subject) {
        if (!subject) return 'default';
        const s = subject.toLowerCase();
        if (s.includes('math')) return 'math';
        if (s.includes('franç') || s.includes('franc')) return 'french';
        if (s.includes('hist') || s.includes('géo')) return 'history';
        if (s.includes('svt') || s.includes('scienc')) return 'science';
        if (s.includes('angl')) return 'english';
        if (s.includes('ital') || s.includes('ita')) return 'italien';
        if (s.includes('phys') || s.includes('chim')) return 'physique';
        if (s.includes('musi')) return 'music';
        if (s.includes('sport') || s.includes('eps')) return 'sport';
        if (s.includes('art')) return 'arts';
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
            'music': 'st-music',
            'sport': 'st-sport',
            'arts': 'st-arts'
        };
        return maps[base] || '';
    }

    function getSubjectTextClass(subject) {
        const base = getSubjectBase(subject);
        return base + '-text';
    }

    function getSubjectBgClass(subject) {
        const base = getSubjectBase(subject);
        return base + '-bg';
    }

    window.fetchGradesFromN8N = async function () {
        console.log("Tentative de récupération des notes...");
        const webhookUrl = 'https://n8n.n8n-sbf-avocats.fr/webhook/get-grade';
        const tbody = document.getElementById('grades-tbody');

        // Indicateur de chargement
        if (tbody.innerText.includes('Aucune') || tbody.innerText.trim() === '') {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Récupération des données...</td></tr>';
        }

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            console.log("Données brutes reçues de n8n:", data);

            let rawItems = [];
            // Normalisation : on veut un tableau d'objets
            if (Array.isArray(data)) {
                rawItems = data;
            } else if (data && typeof data === 'object') {
                if (Array.isArray(data.data)) rawItems = data.data;
                else if (Array.isArray(data.grades)) rawItems = data.grades;
                else if (Array.isArray(data.items)) rawItems = data.items;
                else if (Array.isArray(data.json)) rawItems = data.json;
                else {
                    const foundArray = Object.values(data).find(v => Array.isArray(v));
                    rawItems = foundArray || [data];
                }
            }

            // Extraction des données (gestion du format {json: {...}} de n8n)
            currentGradesData = rawItems.map(item => normalizeGrade((item && item.json) ? item.json : item)).filter(g => {
                return g && g.matière && g.note !== undefined;
            });

            console.log("DEBUG: Nombre de notes normalisées:", currentGradesData.length);
            if (currentGradesData.length > 0) console.log("DEBUG: Exemple de note normalisée:", currentGradesData[0]);

            const validGrades = currentGradesData;

            if (validGrades.length > 0) {
                // VIDAGE DU TABLEAU UNE SEULE FOIS AVANT LA BOUCLE
                tbody.innerHTML = '';
                if (recentGradesList) recentGradesList.innerHTML = '';

                // On trie les notes par date croissante car addGradeToTable utilise prepend()
                validGrades.sort((a, b) => {
                    const dateA = parseDate(a.timestamp);
                    const dateB = parseDate(b.timestamp);
                    const timeA = dateA.getTime();
                    const timeB = dateB.getTime();

                    if (isNaN(timeA) && isNaN(timeB)) return 0;
                    if (isNaN(timeA)) return -1;
                    if (isNaN(timeB)) return 1;
                    return timeA - timeB;
                });

                // On traite chaque note
                validGrades.forEach((formattedGrade) => {
                    addGradeToTable(formattedGrade);
                    updateRecentGrades(formattedGrade);
                });

                // --- UPDATE CHART ---
                // Sort by date for the chart
                const chartData = validGrades.map(g => {
                    const scale = g.barème || 20;
                    const rawNote = g.note;
                    const rawMin = g.min || 0;
                    const rawMax = g.max || scale;
                    const rawAvg = g.moyenne || 0;

                    return {
                        date: parseDate(g.date || g.timestamp),
                        note: (rawNote / scale) * 20,
                        min: (rawMin !== null ? (rawMin / scale) * 20 : null),
                        max: (rawMax !== null ? (rawMax / scale) * 20 : null),
                        avg: (rawAvg !== null ? (rawAvg / scale) * 20 : null),
                        matiere: g.matière
                    };
                })


                    .filter(d => !isNaN(d.date.getTime()))
                    .sort((a, b) => a.date - b.date);

                updateProgressionChart(chartData);

                // --- UPDATE DISTRIBUTION CHART ---
                const aboveAvg = chartData.filter(d => d.note >= d.avg).length;
                const belowAvg = chartData.filter(d => d.note < d.avg).length;
                updateGradeDistributionChart(aboveAvg, belowAvg);

                // --- UPDATE ACTIVITY CHART (Assiduité) ---
                const targetSubjectBases = ['english', 'italien', 'math', 'french', 'physique'];
                const monthlyActivity = {};
                
                validGrades.forEach(g => {
                    const subjectRaw = (g.matière || "").toLowerCase();
                    const commentRaw = (g.commentaire || g.title || "").toLowerCase();
                    const isHome = subjectRaw.startsWith('home') || commentRaw.startsWith('[home]');

                    if (!isHome) return; // Ne compte que les travaux à la maison

                    const baseSubject = getSubjectBase(subjectRaw); // Map ex: 'home - physique' -> 'physique'
                    if (!targetSubjectBases.includes(baseSubject)) return; // On ignore les autres matières

                    const dateObj = parseDate(g.date || g.timestamp);
                    if (isNaN(dateObj.getTime())) return;

                    const monthKey = dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                    const formattedMonth = monthKey.charAt(0).toUpperCase() + monthKey.slice(1);
                    
                    if (!monthlyActivity[formattedMonth]) {
                        monthlyActivity[formattedMonth] = { 'english': 0, 'italien': 0, 'math': 0, 'french': 0, 'physique': 0 };
                    }
                    
                    monthlyActivity[formattedMonth][baseSubject] += 1;
                });
                
                updateActivityChart(monthlyActivity);

                // --- UPDATE MONTHLY AVERAGE CHART ---
                const monthlyAverages = {};
                validGrades.forEach(g => {
                    // Check if it's a home work
                    const subject = (g.matière || g.subject || g.Matière || "").toLowerCase();
                    const comment = (g.commentaire || g.title || "").toLowerCase();
                    const isHome = subject.startsWith('home') || comment.startsWith('[home]');
                    
                    if (isHome) return; // Skip home work

                    const dateObj = parseDate(g.date || g.timestamp);
                    if (isNaN(dateObj.getTime())) return;
                    
                    const monthKey = dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                    const formattedMonth = monthKey.charAt(0).toUpperCase() + monthKey.slice(1);
                    
                    if (!monthlyAverages[formattedMonth]) {
                        monthlyAverages[formattedMonth] = { sumWeighted: 0, sumCoef: 0 };
                    }
                    
                    const scale = g.barème || 20;
                    if (g.note !== null && g.note !== undefined) {
                        const coef = g.coefficient || 1;
                        monthlyAverages[formattedMonth].sumWeighted += ((g.note / scale) * 20) * coef;
                        monthlyAverages[formattedMonth].sumCoef += coef;
                    }
                });
                updateMonthlyAverageChart(monthlyAverages);

                // --- UPDATE RADAR CHART (Équilibre des matières) ---
                // --- UPDATE RADAR CHART ---
                // Le graphique radar est maintenant géré dans updatePlaystationTime pour séparer École/Maison
                // updateRadarChart(subjectAverages); <- SUPPRIMÉ CAR FAISAIT PLANTER (argument manquant)
                updatePlaystationTime(validGrades);

                console.log("DEBUG: Affichage terminé pour " + validGrades.length + " notes.");
            } else {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; opacity: 0.5;">Aucune note trouvée dans les données reçues.</td></tr>';
            }
        } catch (error) {
            console.error('Erreur lors de la récupération:', error);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--fn-pink);">Erreur de connexion aux serveurs.</td></tr>';
        }
    }

    window.sortGrades = function (criteria) {
        if (!currentGradesData || currentGradesData.length === 0) return;


        let sorted = [...currentGradesData];

        if (criteria === 'date') {
            sorted.sort((a, b) => {
                const dateA = parseDate(a.date || a.timestamp || '');
                const dateB = parseDate(b.date || b.timestamp || '');
                return dateB - dateA; // Décroissant par défaut
            });
        } else if (criteria === 'subject') {
            sorted.sort((a, b) => {
                const subA = (a.matière || a.subject || '').toLowerCase();
                const subB = (b.matière || b.subject || '').toLowerCase();
                return subA.localeCompare(subB);
            });
        } else if (criteria === 'grade') {
            sorted.sort((a, b) => {
                const gradeA = (a.note || 0) / (a.barème || 20);
                const gradeB = (b.note || 0) / (b.barème || 20);
                return gradeB - gradeA; // Meilleures notes d'abord
            });
        }

        // Ré-affichage
        const tbody = document.getElementById('grades-tbody');
        tbody.innerHTML = '';

        sorted.forEach(g => {
            addGradeToTable(g, 'append');
        });
    };

    function updatePlaystationTime(grades) {
        const psHoursEl = document.getElementById('ps-hours');
        const psMyAvgEl = document.getElementById('ps-my-avg');
        const psClassAvgEl = document.getElementById('ps-class-avg');
        const psHomeBonusEl = document.getElementById('ps-home-bonus');
        const psRatioValEl = document.getElementById('ps-ratio-val');
        const psProgressFillEl = document.getElementById('ps-progress-fill');
        const psMsgEl = document.getElementById('ps-status-msg');
        const psDetailsTbody = document.getElementById('ps-details-tbody');

        if (!psHoursEl || grades.length === 0) return;

        // Coefficients definition
        const coefficients = {
            'math': 4,
            'physique': 4,
            'anglais': 3,
            'italien': 2,
            'français': 2,
            'histoire': 2,
            'svt': 1,
            'sport': 1,
            'musique': 1,
            'arts plastiques': 1,
            'art plastique': 1,
            'default': 1
        };

        const getCoefKey = (subject) => {
            const s = subject.toLowerCase();
            if (s.includes('math')) return 'math';
            if (s.includes('phys') && !s.includes('sport')) return 'physique';
            if (s.includes('angl')) return 'anglais';
            if (s.includes('ital') || s.includes('ita')) return 'italien';
            if (s.includes('franç') || s.includes('franc')) return 'français';
            if (s.includes('hist') || s.includes('géo')) return 'histoire';
            if (s.includes('svt') || s.includes('scienc')) return 'svt';
            if (s.includes('sport') || s.includes('eps')) return 'sport';
            if (s.includes('musi')) return 'musique';
            if (s.includes('art')) return 'arts plastiques';
            return 'default';
        };

        const parseGradeLocal = (val) => {
            if (val === undefined || val === null || val === "") return 0;
            if (typeof val === 'string') return parseFloat(val.replace(',', '.'));
            return parseFloat(val);
        };

        // Aggregation par matière
        const subjectData = {}; // GLOBAL (Merged)
        const tableData = {};   // TABLE (Separated)

        // Data for Radar Chart (Separate Home vs School)
        const radarSchoolRaw = {};
        const radarHomeRaw = {};

        grades.forEach(g => {
            const matiere = g.matière;
            const rawNote = g.note;
            const scale = g.barème || 20;
            const rawClassAvg = g.moyenne;

            const studentNote = (rawNote / scale) * 20;
            const classNote = rawClassAvg > 0 ? (rawClassAvg / scale) * 20 : 12;

            const coefKey = getCoefKey(matiere);
            const coef = coefficients[coefKey] || 1;

            if (!isNaN(studentNote) && studentNote >= 0) {

                // 1. GLOBAL (Fusionné) -> subjectData
                const subjectKey = matiere.trim().toUpperCase();

                if (!subjectData[subjectKey]) {
                    subjectData[subjectKey] = {
                        name: matiere,
                        coef: coef,
                        totalPointsStudent: 0,
                        totalMaxStudent: 0,
                        totalPointsClass: 0,
                        totalMaxClass: 0
                    };
                }

                const gradeCoef = g.coefficient || 1;

                // Calcul élève
                subjectData[subjectKey].totalPointsStudent += rawNote * gradeCoef;
                subjectData[subjectKey].totalMaxStudent += scale * gradeCoef;

                // Calcul classe (seulement si moyenne classe dispo)
                // Note : Pour la classe, on suppose le même barème et coeff que l'élève
                if (rawClassAvg !== undefined && rawClassAvg !== null && rawClassAvg !== "" && !isNaN(rawClassAvg)) {
                    subjectData[subjectKey].totalPointsClass += rawClassAvg * gradeCoef;
                    subjectData[subjectKey].totalMaxClass += scale * gradeCoef;
                }


                // 2. TABLE (Séparé Home/School) -> tableData
                const comment = (g.commentaire || g.title || g.Commentaire || "").toLowerCase();
                let isHome = matiere.toLowerCase().startsWith('home') || comment.startsWith('[home]');
                let aggKey = subjectKey; // Use same key logic

                if (!tableData[aggKey]) {
                    tableData[aggKey] = {
                        name: matiere,
                        coef: coef,
                        totalPointsStudent: 0,
                        totalMaxStudent: 0,
                        totalPointsClass: 0,
                        totalMaxClass: 0
                    };
                }

                tableData[aggKey].totalPointsStudent += rawNote * gradeCoef;
                tableData[aggKey].totalMaxStudent += scale * gradeCoef;

                if (rawClassAvg !== undefined && rawClassAvg !== null && rawClassAvg !== "" && !isNaN(rawClassAvg)) {
                    tableData[aggKey].totalPointsClass += rawClassAvg * gradeCoef;
                    tableData[aggKey].totalMaxClass += scale * gradeCoef;
                }

                // 3. RADAR (Séparé) -> radarRaw
                let radarKey = getCoefKey(matiere); // Keep merging for Radar (Visual grouping) ? Or separate?
                // Le radar est souvent plus joli avec des catégories regroupées (Math, Français...)
                // On garde getCoefKey pour le radar uniquement

                if (isHome) {
                    if (!radarHomeRaw[radarKey]) radarHomeRaw[radarKey] = { totalPoints: 0, totalMax: 0 };
                    radarHomeRaw[radarKey].totalPoints += rawNote * gradeCoef;
                    radarHomeRaw[radarKey].totalMax += scale * gradeCoef;
                } else {
                    if (!radarSchoolRaw[radarKey]) radarSchoolRaw[radarKey] = { totalPoints: 0, totalMax: 0 };
                    radarSchoolRaw[radarKey].totalPoints += rawNote * gradeCoef;
                    radarSchoolRaw[radarKey].totalMax += scale * gradeCoef;
                }
            }
        });

        // --- PHASE 2: FUSION STRICTE & CALCUL MOYENNES ---

        // Reconstruction propre de subjectData pour la fusion Home/School si nécessaire
        // (Note: La logique ci-dessus remplit déjà subjectData correctement en cumulé, 
        //  mais on va s'assurer de recalculer les moyennes finales /20 ici)

        // Calcul des moyennes par ligne (tableData)
        for (const key in tableData) {
            const t = tableData[key];
            // Moyenne Élève /20
            t.avgStudent = t.totalMaxStudent > 0 ? (t.totalPointsStudent / t.totalMaxStudent) * 20 : 0;
            // Moyenne Classe /20
            t.avgClass = t.totalMaxClass > 0 ? (t.totalPointsClass / t.totalMaxClass) * 20 : 0;
        }

        // Calcul des moyennes par matière (subjectData)
        for (const key in subjectData) {
            const s = subjectData[key];
            s.avgStudent = s.totalMaxStudent > 0 ? (s.totalPointsStudent / s.totalMaxStudent) * 20 : 0;
            s.avgClass = s.totalMaxClass > 0 ? (s.totalPointsClass / s.totalMaxClass) * 20 : null; // null si pas de notes classe

            // Fallback classe si vide (très rare, ex: uniquement des devoirs "Home")
            if (s.avgClass === null) s.avgClass = 12; // Valeur par défaut arbitraire pour éviter division par zéro
        }

        // C. Calcul des moyennes pondérées (Comparaison Stricte : QUE Ecole pour les deux)
        let totalWeightedStudent = 0;
        let totalCoefStudent = 0;

        let totalWeightedClass = 0;
        let totalCoefClass = 0;

        // Variable pour stocker le bonus maison à part (si on veut l'utiliser pour le temps de jeu plus tard)
        let totalHomeBonusPoints = 0;
        let totalHomeCoef = 0;

        for (const key in subjectData) {
            const s = subjectData[key];
            const isHome = s.name.toLowerCase().startsWith('home');

            if (isHome) {
                // On stocke les points "Maison" à part, mais on NE LES INCLUT PAS dans la moyenne générale affichée
                if (!isNaN(s.avgStudent)) {
                    totalHomeBonusPoints += s.avgStudent * s.coef;
                    totalHomeCoef += s.coef;
                }
            } else {
                // C'est une matière scolaire : On l'inclut pour l'élève ET la classe

                // 1. Pour l'élève
                if (!isNaN(s.avgStudent)) {
                    totalWeightedStudent += s.avgStudent * s.coef;
                    totalCoefStudent += s.coef;
                }

                // 2. Pour la classe
                // On ne prend que les matières scolaires qui ont une donnée classe valide
                if (s.avgClass !== null && !isNaN(s.avgClass)) {
                    totalWeightedClass += s.avgClass * s.coef;
                    totalCoefClass += s.coef;
                }
            }
        }

        if (totalCoefStudent === 0) return;

        // Moyenne SCOLAIRE Stricte (pour affichage tableau)
        const myAvg = totalWeightedStudent / totalCoefStudent;

        // Calcul moyenne classe 
        const classAvg = totalCoefClass > 0 ? (totalWeightedClass / totalCoefClass) : 12;

        // --- CALCUL DU TEMPS DE JEU (AVEC BONUS PUR) ---
        // Le travail à la maison est un BONUS qui s'ajoute à la moyenne scolaire.
        // Il ne peut JAMAIS la faire baisser.
        let boostAvg = myAvg;

        if (totalHomeCoef > 0) {
            const homeAvgValue = totalHomeBonusPoints / totalHomeCoef;
            // Calcul du bonus : Performance maison (note/20) x Volume de travail (Coefficients)
            // On divise par un facteur (ex: 5) pour que le boost soit significatif mais équilibré.
            const rawBoost = (homeAvgValue / 20) * (totalHomeCoef / 5);
            const cappedBoost = Math.min(4, rawBoost); // Max +4 points sur la moyenne virtuelle
            boostAvg = myAvg + cappedBoost;
        }

        // Le ratio se base sur la performance GLOBALE (Ecole + Maison) vs Classe Scolaire
        // C'est ici qu'on récompense le travail à la maison !
        const ratio = classAvg > 0 ? (boostAvg / classAvg) : 1;

        // NOUVELLE LOGIQUE DE CALCUL (Référence 6h):
        // ratio = 1.0 (moyenne = classe) -> 1.8h (30% de 6h)
        // ratio = 2.0 (2x la classe) -> 3.6h (60%)
        // Formule: hours = 1.8 * ratio, plafonné à 6h
        let hours = Math.min(6, Math.max(0, 1.8 * ratio));

        // Display updates
        psHoursEl.textContent = hours.toFixed(1);

        // 1. Moyenne École Pure
        psMyAvgEl.textContent = myAvg.toFixed(2) + "/20";

        // 2. Moyenne Classe
        psClassAvgEl.textContent = classAvg.toFixed(2) + "/20";

        // 3. Bonus Maison (si existant)
        if (psHomeBonusEl) {
            if (totalHomeCoef > 0) {
                const homeAvgValue = totalHomeBonusPoints / totalHomeCoef;
                const boostVal = (boostAvg - myAvg).toFixed(2);
                psHomeBonusEl.innerHTML = `
                    <div style="font-size:0.9em;">+${boostVal} pts</div>
                    <div style="font-size:0.65em; opacity:0.8; font-weight:normal;">(Note: ${homeAvgValue.toFixed(1)}/20)</div>
                    <div style="font-size:0.6em; opacity:0.6; font-weight:normal;">Poids: ${totalHomeCoef} pts effort</div>
                `;
            } else {
                psHomeBonusEl.textContent = "0";
            }
        }

        // Le ratio affiché doit correspondre à la réalité du calcul (Boosté / Classe)
        const ratioPercent = Math.round((boostAvg / classAvg) * 100);
        psRatioValEl.textContent = ratioPercent + "%";

        // Progress bar basée sur les heures (0-6h = 0-100%)
        const progressPercent = Math.round((hours / 6) * 100);
        psProgressFillEl.style.width = progressPercent + "%";

        // Message updates basés sur le ratio (Utilise le ratio BOOSTÉ)
        if (ratio >= 1.5) {
            psMsgEl.textContent = "Exceptionnel ! Tu as explosé les compteurs ! 🚀";
            psProgressFillEl.style.background = "linear-gradient(90deg, #f3f91d, #2ecc71)";
        } else if (ratio >= 1.0) {
            psMsgEl.textContent = "Bravo ! Tu es au-dessus ou égal à la moyenne de classe ! 😊";
            psProgressFillEl.style.background = "linear-gradient(90deg, #23dbff, #2ecc71)";
        } else if (ratio >= 0.8) {
            psMsgEl.textContent = "Pas mal, mais tu peux faire encore mieux ! 💪";
            psProgressFillEl.style.background = "linear-gradient(90deg, #ff9f43, #23dbff)";
        } else {
            psMsgEl.textContent = "Attention, il va falloir bosser pour la console... 👾";
            psProgressFillEl.style.background = "linear-gradient(90deg, #ff4d4d, #ff9f43)";
        }

        // Fill details table
        if (psDetailsTbody) {
            psDetailsTbody.innerHTML = '';

            // Sort by coefficient (highest first)
            const sortedSubjects = Object.values(subjectData).sort((a, b) => b.coef - a.coef);

            // SÉPARATION : Matières scolaires vs Activités Maison
            const schoolSubjects = sortedSubjects.filter(s => !s.name.toLowerCase().startsWith('home'));
            const homeSubjects = sortedSubjects.filter(s => s.name.toLowerCase().startsWith('home'));

            // 1. Affichage des matières scolaires (Classique)
            schoolSubjects.forEach(s => {
                const row = document.createElement('tr');
                const diff = s.avgStudent - s.avgClass;
                const diffClass = diff >= 0 ? 'positive' : 'negative';
                const diffIcon = diff >= 0 ? '↑' : '↓';

                // Fallback propre pour l'affichage classe si vide
                const displayClassAvg = (s.avgClass !== null && s.avgClass !== undefined) ? s.avgClass.toFixed(1) : '-';

                row.innerHTML = `
                    <td>${s.name}</td>
                    <td class="coef-cell">x${s.coef}</td>
                    <td class="avg-cell ${diffClass}">${s.avgStudent.toFixed(1)} ${diffIcon}</td>
                    <td class="class-cell">${displayClassAvg}</td>
                `;
                psDetailsTbody.appendChild(row);
            });

            // 2. Affichage aggrégé du "Bonus Maison" -> SUPPRIMÉ DU TABLEAU DÉTAIL (Demandé par User)
            // Le bonus n'apparaît que dans l'encart PlayStation du haut.

            // Add total row
            const totalRow = document.createElement('tr');
            totalRow.classList.add('total-row');
            // On affiche le TOTAL SCOLAIRE STRICT dans le tableau détail
            totalRow.innerHTML = `
                <td><strong>TOTAL SCOLAIRE</strong></td>
                <td class="coef-cell">x${totalCoefStudent}</td>
                <td class="avg-cell ${myAvg >= classAvg ? 'positive' : 'negative'}"><strong>${myAvg.toFixed(2)}</strong></td>
                <td class="class-cell"><strong>${classAvg.toFixed(2)}</strong></td>
            `;
            psDetailsTbody.appendChild(totalRow);
        }

        // Update Radar Chart (separating Home vs School)
        const schoolRadarAvg = {};
        for (const k in radarSchoolRaw) {
            schoolRadarAvg[k] = radarSchoolRaw[k].totalMax > 0
                ? ((radarSchoolRaw[k].totalPoints / radarSchoolRaw[k].totalMax) * 20).toFixed(2)
                : 0;
        }

        const homeRadarAvg = {};
        for (const k in radarHomeRaw) {
            homeRadarAvg[k] = radarHomeRaw[k].totalMax > 0
                ? ((radarHomeRaw[k].totalPoints / radarHomeRaw[k].totalMax) * 20).toFixed(2)
                : 0;
        }

        updateRadarChart(schoolRadarAvg, homeRadarAvg);

        // Update Conseil de Classe
        updateConseilClasse(subjectData, myAvg, classAvg, ratio);
    }

    function updateConseilClasse(subjectData, myAvg, classAvg, ratio) {
        const appreciationEl = document.getElementById('conseil-appreciation');
        const pointsFortsEl = document.getElementById('conseil-points-forts');
        const pointsAmeliorerEl = document.getElementById('conseil-points-ameliorer');
        const conseilMsgEl = document.getElementById('conseil-message');

        if (!appreciationEl) return;

        const subjects = Object.values(subjectData);

        // Séparer les matières fortes et faibles
        const pointsForts = subjects.filter(s => s.avgStudent >= s.avgClass).sort((a, b) => (b.avgStudent - b.avgClass) - (a.avgStudent - a.avgClass));
        const pointsFaibles = subjects.filter(s => s.avgStudent < s.avgClass).sort((a, b) => (a.avgStudent - a.avgClass) - (b.avgStudent - b.avgClass));

        // Générer l'appréciation générale
        let appreciation = "";
        let appreciationType = "";

        if (ratio >= 1.3) {
            appreciationType = "excellent";
            const phrases = [
                "Excellent trimestre ! Alexandre fait preuve d'un travail remarquable et d'une grande régularité. Les résultats sont au-dessus des attentes. Félicitations !",
                "Trimestre exceptionnel ! Alexandre démontre une maîtrise solide dans toutes les matières. Continuez sur cette excellente lancée !",
                "Travail exemplaire ! Alexandre surpasse largement les objectifs fixés. Un élève sérieux et impliqué. Toutes nos félicitations !"
            ];
            appreciation = phrases[Math.floor(Math.random() * phrases.length)];
        } else if (ratio >= 1.1) {
            appreciationType = "tres-bien";
            const phrases = [
                "Très bon trimestre ! Alexandre montre un investissement régulier et des résultats supérieurs à la moyenne de classe. Continuez ainsi !",
                "Bon travail ! Les efforts d'Alexandre portent leurs fruits avec des résultats solides. Les encouragements du conseil de classe !",
                "Trimestre satisfaisant avec de bons résultats. Alexandre progresse bien et montre de belles capacités."
            ];
            appreciation = phrases[Math.floor(Math.random() * phrases.length)];
        } else if (ratio >= 0.95) {
            appreciationType = "bien";
            const phrases = [
                "Trimestre correct. Alexandre se situe dans la moyenne de classe. Un peu plus d'investissement permettrait de progresser davantage.",
                "Résultats honorables. Alexandre montre du potentiel mais doit fournir des efforts plus constants pour atteindre ses objectifs.",
                "Travail régulier qui se traduit par des résultats dans la moyenne. Des progrès sont possibles avec plus de rigueur."
            ];
            appreciation = phrases[Math.floor(Math.random() * phrases.length)];
        } else if (ratio >= 0.8) {
            appreciationType = "encouragements";
            const phrases = [
                "Trimestre mitigé. Alexandre doit fournir plus d'efforts pour atteindre le niveau attendu. Des lacunes à combler dans certaines matières.",
                "Résultats insuffisants par rapport au potentiel d'Alexandre. Un travail plus régulier et approfondi est nécessaire.",
                "Le conseil de classe encourage Alexandre à se ressaisir. Les capacités sont là, il faut maintenant les exploiter !"
            ];
            appreciation = phrases[Math.floor(Math.random() * phrases.length)];
        } else {
            appreciationType = "avertissement";
            const phrases = [
                "Le conseil de classe s'inquiète des résultats d'Alexandre. Un sursaut est nécessaire dès maintenant. Travail insuffisant.",
                "Trimestre très difficile. Alexandre doit impérativement changer ses méthodes de travail et s'investir davantage.",
                "Résultats alarmants. Le conseil de classe met en garde Alexandre : sans effort immédiat, le passage sera compromis."
            ];
            appreciation = phrases[Math.floor(Math.random() * phrases.length)];
        }

        appreciationEl.textContent = appreciation;
        appreciationEl.className = 'appreciation-text ' + appreciationType;

        // Remplir les points forts
        pointsFortsEl.innerHTML = '';
        if (pointsForts.length === 0) {
            pointsFortsEl.innerHTML = '<li class="placeholder">Aucun point fort identifié</li>';
        } else {
            pointsForts.slice(0, 3).forEach(s => {
                const diff = (s.avgStudent - s.avgClass).toFixed(1);
                const li = document.createElement('li');
                li.innerHTML = `<strong>${s.name}</strong> <span class="diff-positive">+${diff}</span>`;
                pointsFortsEl.appendChild(li);
            });
        }

        // Remplir les points à améliorer
        pointsAmeliorerEl.innerHTML = '';
        if (pointsFaibles.length === 0) {
            pointsAmeliorerEl.innerHTML = '<li class="placeholder">Aucun point faible ! Bravo !</li>';
        } else {
            pointsFaibles.slice(0, 3).forEach(s => {
                const diff = (s.avgStudent - s.avgClass).toFixed(1);
                const li = document.createElement('li');
                li.innerHTML = `<strong>${s.name}</strong> <span class="diff-negative">${diff}</span>`;
                pointsAmeliorerEl.appendChild(li);
            });
        }

        // Conseil personnalisé
        let conseilMsg = "";
        if (pointsFaibles.length > 0) {
            const worst = pointsFaibles[0];
            const conseils = {
                'math': "Focus sur les exercices quotidiens en mathématiques. La régularité est la clé !",
                'physique': "Revois les formules et fais plus d'exercices pratiques en physique-chimie.",
                'français': "Lis davantage et entraîne-toi à la rédaction. Chaque texte compte !",
                'anglais': "Regarde des séries en anglais et pratique à l'oral tous les jours.",
                'histoire': "Crée des fiches de révision et travaille la chronologie des événements.",
                'italien': "Écoute de la musique italienne et utilise des applis de vocabulaire.",
                'svt': "Revois les schémas et les processus biologiques. La compréhension avant la mémorisation !",
                'default': "Concentre tes efforts sur cette matière en priorité !"
            };
            const coefKey = Object.keys(subjectData).find(k => subjectData[k] === worst) || 'default';
            conseilMsg = conseils[coefKey] || conseils['default'];
        } else if (ratio >= 1.2) {
            conseilMsg = "Continue comme ça ! Tu es sur la bonne voie pour un excellent bulletin ! 🌟";
        } else {
            conseilMsg = "Garde le cap et reste régulier dans ton travail ! 💪";
        }

        if (conseilMsgEl) {
            conseilMsgEl.querySelector('span').textContent = conseilMsg;
        }
    }

    // Toggle function for PS details
    window.togglePsDetails = function () {
        const content = document.getElementById('ps-details-content');
        const icon = document.getElementById('ps-toggle-icon');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        } else {
            content.style.display = 'none';
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    };

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

    function updateGradeDistributionChart(above, below) {
        const ctx = document.getElementById('distributionChart');
        if (!ctx) return;

        if (distributionChart) {
            distributionChart.destroy();
        }

        // --- CUSTOM PLUGIN FOR CENTER TEXT ---
        const centerMsgPlugin = {
            id: 'centerMsg',
            beforeDraw: (chart) => {
                const { ctx, width, height } = chart;
                ctx.save();

                const total = above + below;
                const ratio = total > 0 ? (above / total) : 0;

                // Choisissez un emoji et un texte fun selon le ratio (Seuils hardcore pour motiver)
                let emoji = "👾";
                let text = "BOSS FIGHT !";
                let color = "#ff4d4d";

                if (ratio >= 0.95) { emoji = "🚀"; text = "100% palystation !"; color = "#f3f91d"; }
                else if (ratio >= 0.85) { emoji = "🔥"; text = "90% playstation !"; color = "#2ecc71"; }
                else if (ratio >= 0.70) { emoji = "😎"; text = "50% playstation !"; color = "#23dbff"; }
                else if (ratio >= 0.50) { emoji = "👾"; text = "20% playstation"; color = "#ff9f43"; }
                else { emoji = "👾"; text = "BOSS FIGHT !"; color = "#ff4d4d"; }

                // Dessiner l'emoji (plus gros)
                ctx.font = "bold 40px Poppins";
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(emoji, width / 2, height / 2 - 15);

                // Dessiner le texte fun
                ctx.font = "bold 14px Bangers";
                ctx.fillStyle = color;
                ctx.fillText(text, width / 2, height / 2 + 25);
                ctx.restore();
            }
        };

        const gradientGreen = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradientGreen.addColorStop(0, '#2ecc71');
        gradientGreen.addColorStop(1, '#1abc9c');

        const gradientRed = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradientRed.addColorStop(0, '#ff4d4d');
        gradientRed.addColorStop(1, '#c0392b');

        distributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Missions Réussies', 'Boss à vaincre'],
                datasets: [{
                    data: [above, below],
                    backgroundColor: [gradientGreen, gradientRed],
                    borderColor: 'rgba(18, 10, 36, 1)',
                    borderWidth: 6,
                    hoverOffset: 15,
                    borderRadius: 10,
                    spacing: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#fff',
                            font: { family: 'Bangers', size: 14 },
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(18, 10, 36, 0.9)',
                        titleFont: { family: 'Bangers' },
                        bodyFont: { family: 'Poppins' },
                        padding: 12
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 2000,
                    easing: 'easeOutBounce'
                }
            },
            plugins: [centerMsgPlugin]
        });
    }

    function updateActivityChart(monthlyData) {
        const ctx = document.getElementById('activityChart');
        if (!ctx) return;
        if (activityChart) activityChart.destroy();

        const labels = Object.keys(monthlyData);
        
        const targetBases = ['english', 'italien', 'math', 'french', 'physique'];
        const displayMaps = {
            'english': { name: 'Anglais', color: 'rgba(255, 159, 67, 0.8)', border: '#ff9f43' },       // Orange
            'italien': { name: 'Italien', color: 'rgba(46, 204, 113, 0.8)', border: '#2ecc71' },       // Vert
            'math': { name: 'Mathématiques', color: 'rgba(243, 249, 29, 0.8)', border: '#f3f91d' },    // Jaune
            'french': { name: 'Français', color: 'rgba(255, 77, 196, 0.8)', border: '#ff4dc4' },       // Rose
            'physique': { name: 'Physique/Chimie', color: 'rgba(35, 219, 255, 0.8)', border: '#23dbff' } // Bleu clair
        };

        const datasets = targetBases.map(base => {
            return {
                label: displayMaps[base].name,
                data: labels.map(month => monthlyData[month][base]),
                backgroundColor: displayMaps[base].color,
                borderColor: displayMaps[base].border,
                borderWidth: 1
            };
        });

        activityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true, // Empilé pour voir le volume total
                        grid: { display: false },
                        ticks: { color: 'rgba(255, 255, 255, 0.7)', font: { size: 10 } }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.5)',
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: { 
                        display: true, 
                        position: 'top',
                        labels: { color: '#fff', font: { family: 'Poppins', size: 11 }, usePointStyle: true, boxWidth: 8 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(18, 10, 36, 0.9)',
                        titleFont: { family: 'Bangers' },
                        bodyFont: { family: 'Poppins' },
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });
    }

    function updateMonthlyAverageChart(monthlyData) {
        const ctx = document.getElementById('monthlyAverageChart');
        if (!ctx) return;
        if (monthlyAverageChart) monthlyAverageChart.destroy();

        const labels = Object.keys(monthlyData);
        const data = labels.map(month => {
            const m = monthlyData[month];
            return m.sumCoef > 0 ? (m.sumWeighted / m.sumCoef).toFixed(2) : 0;
        });

        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, '#ae3eff'); // fn-purple
        gradient.addColorStop(1, '#6c5ce7');

        monthlyAverageChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Moyenne Globale (/20)',
                    data: data,
                    backgroundColor: gradient,
                    borderColor: '#ae3eff',
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 20,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.5)',
                            font: { family: 'Bangers' }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(255, 255, 255, 0.7)', font: { family: 'Poppins' } }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#fff', font: { family: 'Bangers' } }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(18, 10, 36, 0.9)',
                        titleFont: { family: 'Bangers' },
                        bodyFont: { family: 'Poppins' },
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y + ' / 20';
                            }
                        }
                    }
                }
            }
        });
    }

    function updateRadarChart(schoolData, homeData) {
        const ctx = document.getElementById('radarChart');
        if (!ctx) return;
        if (radarChart) radarChart.destroy();

        // Merge keys to get all subjects
        const allSubjects = new Set([...Object.keys(schoolData), ...Object.keys(homeData)]);
        const labels = Array.from(allSubjects);

        const schoolValues = labels.map(l => schoolData[l] || null); // null allows gaps or 0? better 0 for radar
        const homeValues = labels.map(l => homeData[l] || null);

        // Replace nulls with 0 for chart js radar (or undefined/skip?) 
        // Radar chart usually needs all points. Let's use 0 if missing but it might skew average.
        // Better: if missing, maybe previous point? No, 0 is safer.

        radarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
                datasets: [
                    {
                        label: 'École',
                        data: schoolValues.map(v => v || 0),
                        backgroundColor: 'rgba(35, 219, 255, 0.2)', // Blue
                        borderColor: '#23dbff',
                        borderWidth: 2,
                        pointBackgroundColor: '#23dbff',
                        pointBorderColor: '#fff'
                    },
                    {
                        label: 'Maison',
                        data: homeValues.map(v => v || 0),
                        backgroundColor: 'rgba(46, 204, 113, 0.2)', // Green
                        borderColor: '#2ecc71',
                        borderWidth: 2,
                        pointBackgroundColor: '#2ecc71',
                        pointBorderColor: '#fff'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 20,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { display: false, backdropColor: 'transparent' },
                        pointLabels: {
                            color: '#fff',
                            font: { family: 'Poppins', size: 10 }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: 'white', font: { family: 'Bangers' } }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(18, 10, 36, 0.9)',
                        titleFont: { family: 'Bangers' },
                        bodyFont: { family: 'Poppins' }
                    }
                }
            }
        });
    }


    function updateProgressionChart(data) {
        const ctx = document.getElementById('progressionChart');
        if (!ctx) return;

        if (progressionChart) {
            progressionChart.destroy();
        }

        const labels = data.map(d => d.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));

        const chartConfig = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ma Note (/20)',
                        data: data.map(d => d.note),
                        borderColor: '#f3f91d', // fallback yellow
                        segment: {
                            borderColor: ctx => {
                                const p0 = data[ctx.p0DataIndex];
                                const p1 = data[ctx.p1DataIndex];
                                if (!p0 || !p1) return '#f3f91d';
                                const val = (p0.note + p1.note) / 2;
                                const avg = (p0.avg + p1.avg) / 2;
                                return val >= avg ? '#2ecc71' : '#ff4d4d';
                            }
                        },
                        backgroundColor: (context) => {
                            const chart = context.chart;
                            const { ctx, chartArea } = chart;
                            if (!chartArea) return 'rgba(243, 249, 29, 0.1)';
                            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                            gradient.addColorStop(0, 'rgba(255, 77, 77, 0.2)');   // Rouge en bas
                            gradient.addColorStop(0.5, 'rgba(243, 249, 29, 0.1)'); // Jaune au milieu
                            gradient.addColorStop(1, 'rgba(46, 204, 113, 0.2)');  // Vert en haut
                            return gradient;
                        },
                        fill: true,
                        borderWidth: 4,
                        tension: 0.4,
                        pointRadius: 3,
                        pointBorderWidth: 1,
                        pointBackgroundColor: (context) => {
                            const d = data[context.dataIndex];
                            if (!d) return '#f3f91d';
                            return d.note >= d.avg ? '#2ecc71' : '#ff4d4d';
                        },
                        pointBorderColor: '#fff',
                        z: 4
                    },
                    {
                        label: 'Moyenne Classe',
                        data: data.map(d => d.avg),
                        borderColor: '#23dbff', // fn-blue
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: 'Note Max',
                        data: data.map(d => d.max),
                        borderColor: '#ae3eff', // fn-purple
                        backgroundColor: 'rgba(174, 62, 255, 0.05)',
                        borderWidth: 2,
                        fill: '+1', // Fill space between max and min
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: 'Note Min',
                        data: data.map(d => d.min),
                        borderColor: '#ff4dc4', // fn-pink
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 22,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { family: 'Bangers' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { family: 'Poppins' } }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#fff',
                            font: { family: 'Bangers', size: 14 },
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(18, 10, 36, 0.9)',
                        titleFont: { family: 'Bangers' },
                        bodyFont: { family: 'Poppins' },
                        borderColor: '#23dbff',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2);
                                }
                                return label;
                            },
                            afterTitle: function (context) {
                                const index = context[0].dataIndex;
                                return data[index].matiere;
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        };

        progressionChart = new Chart(ctx, chartConfig);
    }

    // Initial fetch if on chat page (optional, or wait for navigation)

    // === MAGIC TRANSLATOR LOGIC ===
    function setupTranslator() {
        const transInput = document.getElementById('trans-input');
        const transBtn = document.getElementById('trans-btn');
        const transLang = document.getElementById('trans-lang');
        const transResult = document.getElementById('trans-result');
        const transWidget = document.getElementById('translator-widget');

        if (!transBtn || !transInput) return;

        transBtn.addEventListener('click', async () => {
            const text = transInput.value.trim();
            const langPair = transLang.value;
            if (!text) return;

            // Visual feedback
            transBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            transBtn.disabled = true;

            try {
                // Using MyMemory API (Free, no token needed for small use)
                const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`);
                const data = await response.json();

                if (data.responseData) {
                    transResult.textContent = data.responseData.translatedText;
                    transResult.style.display = 'block';
                } else {
                    transResult.textContent = "Désolé, erreur de traduction.";
                    transResult.style.display = 'block';
                }
            } catch (error) {
                console.error("Trans Error:", error);
                transResult.textContent = "Oups ! Problème de connexion.";
                transResult.style.display = 'block';
            } finally {
                transBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
                transBtn.disabled = false;
            }
        });

        // Function to show/hide based on subject
        window.updateTranslatorVisibility = function (subject) {
            const languages = ['anglais', 'italien'];
            if (languages.includes(subject)) {
                transWidget.style.display = 'block';
            } else {
                transWidget.style.display = 'none';
            }
        };
    }

    // === FILE UPLOAD & OCR LOGIC ===
    const uploadBtn = document.getElementById('upload-lesson-btn');
    const fileInput = document.getElementById('lesson-file-input');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => {
            const subject = subjectSelect ? subjectSelect.value : '';
            if (!subject) {
                alert("Choisis d'abord une matière avant d'importer un cours ! 😊");
                return;
            }
            fileInput.click();
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const subject = subjectSelect.value;
            const folderId = matiereFolderIds[subject] || '';

            // Visual indicator
            uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyse en cours...';
            uploadBtn.disabled = true;

            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Content = event.target.result.split(',')[1];
                const fileName = `Lesson_${Date.now()}_${file.name}`;

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

                    if (!response.ok) throw new Error("Erreur lors de l'envoi");

                    const data = await response.json();

                    // Show success in chat
                    addMessage(`✅ **Leçon importée avec succès !**\n\nJ'ai analysé ton document. Voici ce que j'ai retenu :\n\n${data.ocrText || 'Analyse terminée.'}`, 'bot');

                    // Add to History for Evaluation
                    chatHistory.push({
                        role: 'system',
                        text: `[FICHIER UPLOADÉ] Nom: ${file.name}. Contenu analysé: ${data.ocrText || 'N/A'}`
                    });

                    // Start Session Timer immediately
                    if (!sessionStartTime) {
                        startSessionTimer();
                    }

                    // Refresh files list
                    fetchFiles(subject);

                } catch (error) {
                    console.error("Upload error:", error);
                    alert("Oups ! Impossible d'importer la leçon. Vérifie ta connexion.");
                } finally {
                    uploadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Importer une leçon';
                    uploadBtn.disabled = false;
                    fileInput.value = ""; // Reset
                }
            };
            reader.readAsDataURL(file);
        });
    }

    setupTranslator();

    // === HISTORY LOGIC ===
    let allHistorySessions = [];

    async function refreshHistory() {
        const loadingEl = document.getElementById('history-loading');
        const emptyEl = document.getElementById('history-empty');
        const listEl = document.getElementById('history-list');

        if (!loadingEl || !listEl) return;

        loadingEl.style.display = 'block';
        emptyEl.style.display = 'none';
        listEl.innerHTML = '';

        try {
            // REMPLACER CETTE URL PAR TON WEBHOOK N8N "get-history"
            const WEBHOOK_URL = "https://n8n.n8n-sbf-avocats.fr/webhook/get-history";
            const response = await fetch(WEBHOOK_URL);

            if (!response.ok) throw new Error("Erreur réseau");

            const data = await response.json();
            allHistorySessions = Array.isArray(data) ? data : (data.sessions || []);

            applyHistoryFilter();

        } catch (error) {
            console.error("Erreur historique:", error);
            loadingEl.style.display = 'none';
            emptyEl.style.display = 'block';
            emptyEl.querySelector('p').textContent = "Oups ! Impossible de récupérer l'historique.";
        }
    }

    window.refreshHistory = refreshHistory;

    function applyHistoryFilter() {
        const filterVal = document.getElementById('history-subject-filter').value.toLowerCase();
        const searchInput = document.getElementById('history-search-input');
        const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";
        const listEl = document.getElementById('history-list');
        const emptyEl = document.getElementById('history-empty');
        const loadingEl = document.getElementById('history-loading');

        if (loadingEl) loadingEl.style.display = 'none';
        listEl.innerHTML = '';

        // 1. Filtrage
        const filtered = allHistorySessions.filter(s => {
            const data = s.json || s;
            const fileName = (data.name || "").toLowerCase();

            // Filtre par matière (si sélectionné)
            const matchesSubject = filterVal === 'all' || fileName.includes(filterVal.replace('ématiques', ''));

            // Filtre par mot-clé
            const matchesSearch = searchVal === "" || fileName.includes(searchVal);

            return matchesSubject && matchesSearch;
        });

        if (filtered.length === 0) {
            emptyEl.style.display = 'block';
        } else {
            emptyEl.style.display = 'none';

            // 2. Groupement par matière (Uniquement si on affiche "Tout" ou si on cherche globalement)
            if (filterVal === 'all') {
                const groups = {};
                filtered.forEach(session => {
                    const data = session.json || session;
                    const fileName = data.name || "";
                    const parts = fileName.split('-');
                    let matiere = "Autres / Général";
                    if (parts.length >= 2) {
                        matiere = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
                        // Normalisation simple
                        if (matiere.toLowerCase().includes('math')) matiere = "Mathématiques";
                        if (matiere.toLowerCase().includes('fran')) matiere = "Français";
                        if (matiere.toLowerCase().includes('svt')) matiere = "SVT";
                        if (matiere.toLowerCase().includes('angl')) matiere = "Anglais";
                        if (matiere.toLowerCase().includes('hist')) matiere = "Histoire";
                        if (matiere.toLowerCase().includes('ital')) matiere = "Italien";
                        if (matiere.toLowerCase().includes('phys')) matiere = "Physique/Chimie";
                    }
                    if (!groups[matiere]) groups[matiere] = [];
                    groups[matiere].push(session);
                });

                // Affichage par groupes
                Object.keys(groups).sort().forEach(matiere => {
                    const titleDiv = document.createElement('div');
                    titleDiv.className = 'history-group-title';
                    const iconClass = getSubjectIcon(matiere);
                    titleDiv.innerHTML = `<i class="${iconClass}"></i> ${matiere} (${groups[matiere].length})`;
                    listEl.appendChild(titleDiv);

                    groups[matiere].forEach(session => {
                        const card = createHistoryCard(session);
                        listEl.appendChild(card);
                    });
                });
            } else {
                // Affichage simple si une matière spécifique est filtrée
                filtered.forEach(session => {
                    const card = createHistoryCard(session);
                    listEl.appendChild(card);
                });
            }
        }
    }

    window.applyHistoryFilter = applyHistoryFilter;

    function createHistoryCard(session) {
        const card = document.createElement('div');
        card.className = 'card history-card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'space-between';

        // Support du format brut OU du format {json: {...}} de n8n
        const data = session.json || session;
        const fileName = data.name || "";
        const sid = data.id || data.ID || data.Session_ID;

        // On découpe le nom : mathematiques-03/03/26-session_...
        const parts = fileName.split('-');
        let matiere = "Général";
        let date = "?";

        if (parts.length >= 2) {
            matiere = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            date = parts[1];
        }

        card.innerHTML = `
            <div class="history-card-header">
                <div class="icon-box ${getSubjectClass(matiere)}">
                    <i class="${getSubjectIcon(matiere)}"></i>
                </div>
                <div class="details">
                    <span style="font-weight:bold; font-size:1.1rem;">${matiere}</span>
                    <small style="display:block; opacity:0.6;">${date}</small>
                </div>
            </div>
            <div class="history-card-body" style="margin: 15px 0;">
                <p style="font-size: 0.8rem; opacity: 0.6; line-height: 1.2; font-family: monospace; word-break: break-all;">
                   ${fileName}
                </p>
            </div>
            <button class="cta-btn secondary" onclick="reopenSession('${sid}')" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <i class="fa-solid fa-folder-open"></i> Voir la discussion
            </button>
        `;
        return card;
    }

    function getSubjectClass(subject) {
        const s = subject.toLowerCase();
        if (s.includes('math')) return 'math';
        if (s.includes('fran')) return 'french';
        if (s.includes('angl')) return 'english';
        if (s.includes('svt')) return 'science'; // Uses --color-science
        if (s.includes('hist')) return 'history';
        if (s.includes('phys')) return 'physique';
        if (s.includes('ital')) return 'italian';
        return 'default';
    }

    function getSubjectIcon(subject) {
        const s = subject.toLowerCase();
        if (s.includes('math')) return 'fa-solid fa-calculator';
        if (s.includes('fran')) return 'fa-solid fa-pen-nib';
        if (s.includes('angl')) return 'fa-solid fa-language';
        if (s.includes('svt')) return 'fa-solid fa-microscope';
        if (s.includes('hist')) return 'fa-solid fa-landmark';
        if (s.includes('phys')) return 'fa-solid fa-flask';
        if (s.includes('ital')) return 'fa-solid fa-pepper-hot'; // Fun icon for Italian
        return 'fa-solid fa-book';
    }

    async function reopenSession(sid) {
        console.log("Tentative de réouverture de la session ID:", sid);
        if (!sid) {
            console.error("Aucun SID (ID de session) n'a été fourni au bouton !");
            return;
        }

        // On bascule sur la vue chat
        showView('chat');

        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = `
            <div class="message bot">
                <div class="bubble">
                    <div class="loading-spinner" style="width:20px; height:20px; border-width:2px; margin-bottom:10px;"></div>
                    Chargement de ton aventure passée...
                </div>
            </div>
        `;

        try {
            // !!! REMPLACER CETTE URL PAR TON WEBHOOK N8N "load-session" !!!
            const WEBHOOK_LOAD = "https://n8n.n8n-sbf-avocats.fr/webhook/load-session";

            console.log("Appel Webhook:", WEBHOOK_LOAD, "avec SID:", sid);

            const response = await fetch(WEBHOOK_LOAD, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sid })
            });

            if (!response.ok) throw new Error("Erreur chargement");

            const messages = await response.json();
            const msgArray = Array.isArray(messages) ? messages : [messages];

            chatMessages.innerHTML = '';
            msgArray.forEach(m => {
                const row = m.json || m;

                // On saute la ligne d'entêtes
                if (row.Date === 'Date' || row.Session_ID === 'Session_ID' || row['Date'] === 'Date') return;

                const q = row.Question || row.question || row['Question'] || "";
                const r = row.Réponse || row.reponse || row['Réponse'] || "";

                if (q.trim() !== "") addMessage(q, 'user');
                if (r.trim() !== "") addMessage(r, 'bot');
            });

            // On met à jour l'ID de session actuel pour continuer si besoin
            sessionId = sid;
            document.getElementById('active-lesson-name').textContent = "📜 Discussion restaurée";

        } catch (error) {
            console.error("Erreur réouverture:", error);
            chatMessages.innerHTML = `
                <div class="message bot">
                    <div class="bubble" style="color: #ff4d4d;">
                        Impossible de charger cette discussion. Elle est peut-être trop ancienne !
                    </div>
                </div>
            `;
        }
    }

    window.reopenSession = reopenSession;

    // Initial visibility check
    if (subjectSelect && window.updateTranslatorVisibility) {
        window.updateTranslatorVisibility(subjectSelect.value);
    }
});
