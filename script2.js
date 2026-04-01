// script2.js - Espace Céliane 4ème

// URLs des webhooks n8n
const WEBHOOK_URLS = {
    maths: "https://n8n.n8n-sbf-avocats.fr/webhook/mathematique1",
    francais: "https://n8n.n8n-sbf-avocats.fr/webhook/francais1",
    anglais: "https://n8n.n8n-sbf-avocats.fr/webhook/anglais1"
};

// Programme scolaire de 4ème
// Programme scolaire de 4ème avec requêtes détaillées
const PROGRAM = {
    maths: [
        {
            chapter: "1. Nombres et calculs",
            topics: [
                { title: "Nombres relatifs", prompt: "Je veux réviser les nombres relatifs (calculs de signes, additions, soustractions, multiplications). Fais-moi une brève révision de la règle des signes puis donne-moi un exercice d'application niveau 4ème." },
                { title: "Fractions", prompt: "Mets-moi à l'épreuve sur les fractions ! Donne-moi un problème ou un calcul en plusieurs étapes, incluant simplification et opérations croisées, pour vérifier que j'ai bien compris." },
                { title: "Puissances", prompt: "Donne-moi un cours express sur les puissances d'un nombre et les règles de calcul associées, puis enchaîne avec un exercice mettant en pratique les puissances de 10 et l'écriture scientifique." },
                { title: "Racine carrée", prompt: "Professeur, je veux m'entraîner sur la notion de racine carrée. Pose-moi une ou deux questions simples pour m'habituer à calculer des racines parfaites ou à faire le lien avec le théorème de Pythagore." },
                { title: "Calcul littéral", prompt: "J'aimerais faire du calcul littéral, notamment m'entraîner à la distributivité et à la factorisation simple. Donne-moi une expression algébrique à développer pour commencer." },
                { title: "Équations", prompt: "Faisons des équations ! Propose-moi une petite mise en équation d'un problème concret de la vie courante pour voir si j'arrive à la résoudre du premier degré." }
            ]
        },
        {
            chapter: "2. Proportionnalité et fonctions",
            topics: [
                { title: "Proportionnalité", prompt: "Je veux travailler la proportionnalité. Donne-moi une situation et demande-moi de trouver si elle est proportionnelle, ou demande-moi de compléter un tableau en trouvant le coefficient manquant." },
                { title: "Pourcentages", prompt: "Révise avec moi les pourcentages, particulièrement les situations d'augmentation ou de diminution (comme des soldes ou une hausse de prix). Pose-moi un problème concret à résoudre." },
                { title: "Vitesses et grandeurs", prompt: "Je voudrais réviser le calcul de la vitesse, de la distance et du temps, ou encore la densité. Donne-moi un problème à tiroirs nécessitant l'utilisation de la bonne formule." },
                { title: "Fonctions (initiation)", prompt: "Fais-moi réviser l'initiation aux fonctions. Explique-moi très rapidement ce qu'est une image et un antécédent, puis pose-moi une question logique pour m'exercer." }
            ]
        },
        {
            chapter: "3. Organisation de données",
            topics: [
                { title: "Statistiques", prompt: "Propose-moi un jeu de données (des notes, des tailles...) et demande-moi de calculer la moyenne, la médiane et l'étendue de cette série." },
                { title: "Probabilités", prompt: "Je veux faire un exercice de probabilités d'un niveau de 4ème. Invente une situation aléatoire simple (urnes, dés, cartes) et demande-moi de calculer la probabilité d'une certaine issue." }
            ]
        },
        {
            chapter: "4. Espace et Géométrie",
            topics: [
                { title: "Théorème de Pythagore", prompt: "Le théorème de Pythagore ! J'aimerais que tu m'expliques clairement comment rédiger pour prouver qu'un triangle est rectangle, ou pour trouver une longueur. Ensuite, donne-moi les dimensions d'un triangle et mets-moi au défi." },
                { title: "Théorème de Thalès", prompt: "Fais-moi réviser la configuration de Thalès. Résume comment reconnaître des droites parallèles ou proportionnelles, et donne-moi un petit exercice de calcul de longueurs." },
                { title: "Triangles et droites", prompt: "Rappelons-nous des propriétés générales des triangles et des droites remarquables associées. Peux-tu me faire un quiz rapide à ce propos ?" },
                { title: "Transformations du plan", prompt: "Explique-moi la différence entre une translation et une rotation. Si possible avec un exemple visuel ou expliqué, et un mini quiz pour voir si je visualise bien les transformations." },
                { title: "Cercle", prompt: "Je voudrais revoir le cercle, notamment la tangente et le lien avec les triangles inscrits dans un cercle. Pose-moi une question axée sur la géométrie du cercle." }
            ]
        },
        {
            chapter: "5. Grandeurs et mesures",
            topics: [
                { title: "Aires et volumes", prompt: "Donne-moi un objet géométrique en 3D (un cylindre, un prisme...) avec ses dimensions et demande-moi d'en déduire son aire latérale ou son volume total." },
                { title: "Longueurs et distances", prompt: "Je veux faire un exercice mêlant les longueurs et Pythagore pour calculer une distance précise dans un plan. C'est à toi de paramétrer le problème !" }
            ]
        },
        {
            chapter: "6. Algorithmique (Scratch)",
            topics: [
                { title: "Algorithmique", prompt: "Mets ton chapeau d'informaticien et aide-moi à comprendre l'importance d'un algorithme et de ses variables avec un exemple logique simple." },
                { title: "Programmation (Scratch)", prompt: "Tu es mon professeur d'informatique. Invente un scénario Scratch avec une boucle (répéter) et des conditions (si... alors...) et demande-moi quel sera le résultat à la fin du script." }
            ]
        }
    ],
    francais: [
        {
            chapter: "1. Lecture et compréhension",
            topics: [
                { title: "Récit réaliste et naturaliste", prompt: "Évadeons-nous dans le XIXe siècle. Présente-moi un très court texte descriptif naturaliste, et demande-moi d'identifier ce qui le rend réaliste par sa critique sociale ou sa description minutieuse." },
                { title: "Le fantastique", prompt: "Je veux travailler le registre fantastique ! Invente un tout petit début de nouvelle provoquant l'hésitation caractéristique entre le réel et le surnaturel, puis demande-moi comment l'analyser." },
                { title: "La poésie (lyrique et engagée)", prompt: "Propose-moi deux ou trois strophes d'un poème et demande-moi de retrouver les figures de style qui expriment les émotions de l'auteur." },
                { title: "Le théâtre", prompt: "Faisons un peu de théâtre imaginaire. Donne-moi une courte tirade contenant des didascalies, et pose-moi une question sur les réactions des personnages ou le comique de la scène." },
                { title: "Les textes argumentatifs", prompt: "Professeur de français, comment puis-je différencier l'art de convaincre de celui de persuader ? Teste mes acquis sur une courte problématique." }
            ]
        },
        {
            chapter: "2. Expression écrite",
            topics: [
                { title: "Rédaction narrative", prompt: "Faisons une dictée inversée ou un exercice de rédaction. Donne-moi un début de situation initiale, un élément perturbateur, et demande-moi de rédiger une suite courte (trois lignes)." },
                { title: "Écriture descriptive", prompt: "Je veux m'entraîner à la description précise. Donne-moi le contexte d'un lieu hanté, et aide-moi à utiliser des expansions du nom pour dresser le portrait du lieu." },
                { title: "Écriture argumentative", prompt: "Mets-moi à l'épreuve ! Pose-moi une question qui porte à débat, et guide-moi pour construire ma thèse accompagnée d'un argument valide." },
                { title: "Réécriture et amélioration", prompt: "Donne-moi une phrase complètement erronée et pauvre d'un point de vue de vocabulaire ou de temps du récit, et défie-moi de l'enrichir et de la corriger correctement." }
            ]
        },
        {
            chapter: "3. Expression orale",
            topics: [
                { title: "Lecture à voix haute (Conseils)", prompt: "Comment être fluide et persuasif quand je lis à voix haute devant la classe ? Donne-moi un conseil clé et un virelangue amusant à prononcer pour m'échauffer." },
                { title: "Prise de parole et débat", prompt: "Donne-moi vite fait un grand thème de société que j'aurais à débattre en 4ème. Donne-moi les arguments des deux camps pour m'aider à réfléchir." }
            ]
        },
        {
            chapter: "4. Étude de la langue",
            topics: [
                { title: "Grammaire : Phrases simples/complexes", prompt: "Testons ma grammaire : j'aimerais un jeu rapide où tu me donnes des phrases et je dois identifier les propositions subordonnées ou coordonnées." },
                { title: "Classes grammaticales et Fonctions", prompt: "Faisons un exercice strict de classes et fonctions (COD, attribut, etc.). Donne-moi une phrase astucieuse et interroge-moi sur les règles." },
                { title: "Le verbe (Temps et valeurs)", prompt: "Je veux m'exercer sur les valeurs des temps du récit (l'imparfait vs le passé simple). Rédige une phrase avec un trou et que je devine le bon temps." },
                { title: "Orthographe grammaticale et lexicale", prompt: "Je suis prête pour une mini dictée de 20 mots remplis de pièges grammaticaux sur les participes passés. À toi !" },
                { title: "Lexique et Figures de style", prompt: "Saurais-je différencier une métaphore d'une comparaison ou d'une hyperbole ? Mets-moi à l'épreuve sans plus attendre avec un exemple inventé." }
            ]
        },
        {
            chapter: "5. Culture littéraire",
            topics: [
                { title: "Thématiques de 4ème", prompt: "Récapitulons les grandes leçons du programme comme 'Dire l'amour' ou 'Individu et Société'. Quel auteur doit-on absolument connaître sur ces sujets ?" },
                { title: "Histoire littéraire du XIXe siècle", prompt: "Fais-moi un résumé explosif du XIXème siècle littéraire et des grands mouvements français de cette époque, puis pose-moi un QCM à piocher !" }
            ]
        },
        {
            chapter: "6. Méthodes et compétences",
            topics: [
                { title: "Comprendre un texte", prompt: "Peux-tu m'enseigner une méthode d'analyse rapide pour lire un texte et trouver instantanément les idées principales au brouillon ?" },
                { title: "Analyser un extrait", prompt: "Si je tombe sur un extrait littéraire que je ne connais pas en brevet blanc, comment dois-je repérer les procédés d'écriture les plus fréquents pour interpréter l'intention de l'auteur ?" },
                { title: "Structurer une rédaction", prompt: "Mon point faible est la structuration. Rappelle-moi l'ordre type d'une composition ou rédaction argumentative, et fais-moi un exemple de plan." }
            ]
        }
    ],
    anglais: [
        {
            chapter: "1. Compréhension orale",
            topics: [
                { title: "Messages du quotidien", prompt: "Play the role of an English speaker lost in London or buying something contextually. Talk to me in English directly, dictating a short situation and asking me what to do next!" },
                { title: "Différents accents (UK/US)", prompt: "Professeur, dis-moi quelles sont les plus grosses différences de vocabulaire et de prononciation entre l'anglais UK et l'américain, et donne un exemple concret que tu peux prononcer en anglais." },
                { title: "Identifier les informations", prompt: "Je voudrais m'exercer à lire un texte court d'abord (en anglais) et il faut que je te ressorte l'idée principale sans forcément traduire chaque mot. Let's go!" }
            ]
        },
        {
            chapter: "2. Expression orale",
            topics: [
                { title: "Parler en continu (Se présenter...)", prompt: "I want to talk about myself! Pose-moi 3 questions d'affilée en anglais sur mon école ou mes amis et j'y répondrai de manière groupée." },
                { title: "Interaction orale (Dialogue)", prompt: "Faisons un jeu de rôle direct et très ciblé ! Tu es un commerçant anglais à la boulangerie et je viens acheter 2 croissants et je demande le prix. Let's talk!" },
                { title: "Prononciation et accentuation", prompt: "Donne-moi une liste de mots anglais qui sont des 'faux-amis' ou très durs à prononcer pour un français. Je vais les lire avec la dictée vocale pour que tu juges." }
            ]
        },
        {
            chapter: "3. Compréhension écrite",
            topics: [
                { title: "Lire des textes variés", prompt: "Give me an English reading test suitable for 8th grade (4ème) about a short mystery story, and then ask me two questions in English about the plot." },
                { title: "Comprendre par déduction", prompt: "Peux-tu me donner des mots étrangers ou méconnus intégrés dans une phrase en anglais riche en contexte, pour que j'apprenne à deviner leur sens logique sans ouvrir le dictionnaire ?" }
            ]
        },
        {
            chapter: "4. Expression écrite",
            topics: [
                { title: "Écrire un e-mail", prompt: "Let's work on writing! Donne-moi les instructions en anglais pour écrire un email à un ami anglophone afin de l'inviter à un anniversaire. Je le rédigerai juste après." },
                { title: "Connecteurs logiques", prompt: "Révise-moi les mots de liaison comme and, but, because... Propose-moi ensuite deux longues phrases en anglais et demande-moi de les fusionner à l'aide d'un connecteur." },
                { title: "Décrire, raconter", prompt: "I need to practice descriptions in English! Pose-moi une image imaginaire d'une scène sur la plage pour que je te décrive les personnes avec un maximum de vocabulaire." }
            ]
        },
        {
            chapter: "5. Grammaire",
            topics: [
                { title: "Les temps fondamentaux", prompt: "Test my grammar on the Present Continuous vs Present Simple. Explique-moi la nuance pour un élève de 4ème et donne un exercice dans la foulée." },
                { title: "Affirmation et Intrrogation", prompt: "Donne-moi un fait amusant en anglais à la forme affirmative, puis à mon tour, je vais devoir transformer cette phrase en question fermée ou avec un auxiliaire." },
                { title: "Auxiliaires (be, have, do)", prompt: "Help me not to confuse 'do', 'be' and 'have'! Donne-moi une mini liste avec des espaces vides à boucher pour m'entraîner." },
                { title: "Les modaux (can, must, should)", prompt: "Je veux m'exercer sur l'obligation, l'interdiction et le conseil en anglais. Donne-moi une situation d'école militaire et dis-moi quelles règles 'must/mustn't' appliquer." }
            ]
        },
        {
            chapter: "6. Lexique",
            topics: [
                { title: "Thèmes du quotidien", prompt: "Mettons au défi mon vocabulaire sur le thème des voyages. Donne-moi 5 mots anglais et demande-moi de les utiliser dans une seule et même phrase." },
                { title: "Champs lexicaux divers", prompt: "What is the vocabulary field of emotions in English? Fais une liste claire avant de me soumettre à un exercice d'humeur logique en anglais." }
            ]
        },
        {
            chapter: "7. Culture et civilisation",
            topics: [
                { title: "Cultures anglophones", prompt: "Let's explore English culture! Explique-moi brièvement le système scolaire au UK par rapport au nôtre (France), avant de voir si j'ai compris par un 'true/false'." },
                { title: "Traditions (Fêtes etc.)", prompt: "Défie ma culture anglophone avec un quiz de trois questions amusantes à propos d'Halloween ou de Thanksgiving pour tester ma curiosité." },
                { title: "Ouverture culturelle", prompt: "Raconte-moi une petite anecdote culturelle très courte (en anglais) sur l'histoire d'Oxford avant de me poser une petite devinette." }
            ]
        },
        {
            chapter: "8. Compétences orales",
            topics: [
                { title: "Se présenter", prompt: "I want to introduce myself professionally and fluently in English. Let's do a roleplay, you start by being the interviewer !" },
                { title: "Argumenter (simple)", prompt: "Teach me how to give my opinion clearly with 'because' or 'I think that'. Propose a funny topic to debate, like 'cats vs dogs' and let's go!" }
            ]
        }
    ]
};

// Informations de l'interface par matière
const UI_DATA = {
    maths: {
        title: "Professeur de Mathématiques",
        subtitle: "Je suis là pour t'aider avec tes théorèmes et calculs !",
        icon: "🧮",
        greeting: "Coucou Céliane ! Que veux-tu réviser en maths aujourd'hui ?"
    },
    francais: {
        title: "Professeur de Français",
        subtitle: "Prête pour un peu de lecture et de grammaire ?",
        icon: "📚",
        greeting: "Bonjour Céliane ! Sur quel texte ou point de grammaire veux-tu travailler ?"
    },
    anglais: {
        title: "English Teacher",
        subtitle: "Let's practice your English! Ready?",
        icon: "🇬🇧",
        greeting: "Hello Céliane! How can I help you with your English today?"
    }
};

// État de l'application
let currentSubject = "maths";
let sessionId = generateSessionId();
let messageCount = 0;
let activeSpreadsheetId = null;
let chatHistory = [];
let isAudioEnabled = true;

// Éléments du DOM
const dom = {
    tabs: document.querySelectorAll('.tab-btn'),
    topicsContainer: document.getElementById('topics-container'),
    chatTitle: document.getElementById('chat-title'),
    chatSubtitle: document.querySelector('.chat-header span'),
    chatIcon: document.getElementById('chat-icon'),
    chatBox: document.getElementById('chat-box'),
    chatForm: document.getElementById('chat-form'),
    userInput: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    typingIndicator: document.getElementById('typing-indicator'),
    dictationBtn: document.getElementById('dictation-btn'),
    speedSlider: document.getElementById('speed-slider'),
    speedValue: document.getElementById('speed-value'),
    toggleAudioBtn: document.getElementById('toggle-audio-btn')
};

// --- INITIALISATION ---
function init() {
    loadProgram(currentSubject);
    setupEventListeners();
}

// --- FONCTIONS CLÉS ---

function generateSessionId() {
    return 'celiane-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
}

function loadProgram(subject) {
    // Vider le conteneur
    dom.topicsContainer.innerHTML = '';
    
    // Injecter les nouveaux thèmes avec accordéon
    PROGRAM[subject].forEach(chapterObj => {
        const chapterDiv = document.createElement('div');
        chapterDiv.className = 'chapter-container';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'chapter-header';
        headerDiv.innerHTML = `<span>${chapterObj.chapter}</span> <i class="fa-solid fa-chevron-down"></i>`;
        
        const topicsListDiv = document.createElement('div');
        topicsListDiv.className = 'topics-list';
        topicsListDiv.style.display = 'none'; // Caché par défaut
        
        headerDiv.addEventListener('click', () => {
            const isHidden = topicsListDiv.style.display === 'none';
            // Alterner l'affichage
            topicsListDiv.style.display = isHidden ? 'flex' : 'none';
            headerDiv.classList.toggle('open', isHidden);
            
            // Tourner l'icône
            const icon = headerDiv.querySelector('i');
            icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        });
        
        chapterObj.topics.forEach(topic => {
            const topicDiv = document.createElement('div');
            topicDiv.className = 'topic-item';
            topicDiv.textContent = topic.title;
            topicDiv.addEventListener('click', () => {
                 dom.userInput.value = topic.prompt;
                 dom.userInput.focus();
            });
            topicsListDiv.appendChild(topicDiv);
        });
        
        chapterDiv.appendChild(headerDiv);
        chapterDiv.appendChild(topicsListDiv);
        dom.topicsContainer.appendChild(chapterDiv);
    });
}

function switchSubject(newSubject) {
    if (newSubject === currentSubject) return;
    
    currentSubject = newSubject;
    sessionId = generateSessionId(); // Nouveau prof, nouvelle session
    messageCount = 0; // Réinitialiser le compteur
    activeSpreadsheetId = null;
    chatHistory = [];

    // Mise à jour de l'interface
    dom.tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.subject === newSubject);
    });
    
    dom.chatTitle.textContent = UI_DATA[newSubject].title;
    dom.chatSubtitle.textContent = UI_DATA[newSubject].subtitle;
    dom.chatIcon.textContent = UI_DATA[newSubject].icon;

    // Vider le chat et mettre le mot de bienvenue
    dom.chatBox.innerHTML = '';
    appendMessage('bot', UI_DATA[newSubject].greeting);

    // Recharger le programme
    loadProgram(newSubject);
}

function setupEventListeners() {
    dom.tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const subject = e.currentTarget.dataset.subject;
            switchSubject(subject);
        });
    });

    // Envoyer le message avec la touche Entrée (sans Shift) pour le textarea
    dom.userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Empêche le retour à la ligne
            dom.chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    });

    dom.chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = dom.userInput.value.trim();
        if (!text) return;

        // Envoi du message utilisateur
        appendMessage('user', text);
        dom.userInput.value = '';
        dom.sendBtn.disabled = true;
        
        // Afficher l'indicateur de frappe
        dom.typingIndicator.style.display = 'flex';
        scrollChatToBottom();

        // Appel au webhook
        await sendMessageToAI(text);
        
        // Cacher l'indicateur
        dom.typingIndicator.style.display = 'none';
        dom.sendBtn.disabled = false;
        dom.userInput.focus();
    });

    // --- GESTION DE LA DICTÉE (SPEECH TO TEXT) ---
    let recognition;
    let isRecording = false;

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isRecording = true;
            dom.dictationBtn.style.color = '#ef4444'; // Rouge
        };

        recognition.onresult = (event) => {
            let text = "";
            for (let i = 0; i < event.results.length; i++) {
                text += event.results[i][0].transcript;
            }
            dom.userInput.value = text;
        };

        recognition.onerror = (event) => {
            console.error("Erreur de reconnaissance vocale", event.error);
            stopDictation();
        };

        recognition.onend = () => {
            stopDictation();
        };
    } else {
        dom.dictationBtn.style.display = 'none'; // Pas supporté
    }

    function stopDictation() {
        isRecording = false;
        dom.dictationBtn.style.color = '#64748b'; // Gris normal
    }

    dom.dictationBtn.addEventListener('click', () => {
        if(!recognition) return;
        if (isRecording) {
            recognition.stop();
        } else {
            recognition.lang = currentSubject === 'anglais' ? 'en-GB' : 'fr-FR';
            dom.userInput.value = ''; 
            recognition.start();
        }
    });

    if (dom.speedSlider) {
        dom.speedSlider.addEventListener('input', (e) => {
            dom.speedValue.textContent = e.target.value + 'x';
        });
    }

    if (dom.toggleAudioBtn) {
        dom.toggleAudioBtn.addEventListener('click', () => {
            isAudioEnabled = !isAudioEnabled;
            if (isAudioEnabled) {
                dom.toggleAudioBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
                dom.toggleAudioBtn.style.color = 'var(--primary-color)';
                dom.toggleAudioBtn.title = "Désactiver la lecture automatique";
            } else {
                dom.toggleAudioBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
                dom.toggleAudioBtn.style.color = '#ef4444'; // rouge
                dom.toggleAudioBtn.title = "Activer la lecture automatique";
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel(); // Coupe le son s'il parle en ce moment
                }
            }
        });
    }
}

// --- LECTURE À VOIX HAUTE ET FORMATAGE ---
function cleanMathForSpeech(rawText) {
    let clean = rawText;
    clean = clean.replace(/\\frac{([^}]*)}{([^}]*)}/g, "$1 sur $2");
    clean = clean.replace(/\\times/g, " fois ");
    clean = clean.replace(/\\div/g, " divisé par ");
    clean = clean.replace(/\\left|\\right/g, "");
    clean = clean.replace(/[\$\\]/g, ""); // Enlever les $ et \ restants
    clean = clean.replace(/[{}]/g, " "); // Enlever les accolades
    return clean;
}

function appendMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.style.whiteSpace = 'pre-wrap'; // Préserve les sauts de ligne sans briser MathJax
    contentDiv.textContent = text;

    // Ajout d'un bouton TTS pour les DEUX (user et bot)
    const ttsBtn = document.createElement('button');
    ttsBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    // Aligné à droite et blanc pour l'utilisateur, à gauche et violet pour le bot
    const btnColor = sender === 'user' ? 'rgba(255, 255, 255, 0.9)' : 'var(--primary-color)';
    const btnAlign = sender === 'user' ? 'flex-end' : 'flex-start';
    ttsBtn.style.cssText = `background:none; border:none; cursor:pointer; color:${btnColor}; padding: 5px; margin-top:5px; font-size: 1rem; align-self: ${btnAlign};`;
    ttsBtn.title = "Écouter en anglais";
    
    ttsBtn.onclick = async () => {
        const lang = 'en-GB';
        if ('speechSynthesis' in window) {
            // Nettoyer le formatage LaTeX
            let textToRead = cleanMathForSpeech(text);
            
            // Si on n'est pas en anglais, on traduit le texte à la volée
            if (currentSubject !== 'anglais') {
                const oldIcon = ttsBtn.innerHTML;
                ttsBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                
                try {
                    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=en&dt=t&q=${encodeURIComponent(text)}`;
                    const response = await fetch(url);
                    const data = await response.json();
                    let translated = "";
                    if (data && data[0]) {
                        data[0].forEach(item => { if(item[0]) translated += item[0]; });
                    }
                    if (translated) textToRead = translated;
                } catch(e) {
                    console.error("Erreur de traduction", e);
                }
                
                ttsBtn.innerHTML = oldIcon;
            }

            // Couper les autres lectures
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(textToRead);
            utterance.lang = lang;
            
            // On récupère la vitesse depuis le curseur
            const currentSpeed = dom.speedSlider ? parseFloat(dom.speedSlider.value) : 0.85;
            utterance.rate = currentSpeed;
            
            window.speechSynthesis.speak(utterance);
        }
    };
    
    // On place le bouton en-dessous du texte
    const innerContainer = document.createElement('div');
    innerContainer.style.display = 'flex';
    innerContainer.style.flexDirection = 'column';
    innerContainer.innerHTML = contentDiv.innerHTML;
    innerContainer.appendChild(ttsBtn);
    contentDiv.innerHTML = '';
    contentDiv.appendChild(innerContainer);

    // Lecture automatique UNIQUEMENT si c'est le message du bot et que l'audio n'est pas muet
    if (sender === 'bot' && isAudioEnabled) {
        setTimeout(() => {
            ttsBtn.click();
        }, 100);
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    const now = new Date();
    timeDiv.textContent = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    msgDiv.appendChild(contentDiv);
    msgDiv.appendChild(timeDiv);

    dom.chatBox.appendChild(msgDiv);
    
    // Interpreter le LaTeX s'il y a des formules
    if (window.MathJax) {
        MathJax.typesetPromise([msgDiv]).catch(function (err) {
            console.error('Erreur MathJax', err.message);
        });
    }

    scrollChatToBottom();
}

function scrollChatToBottom() {
    dom.chatBox.scrollTop = dom.chatBox.scrollHeight;
}

// --- APPEL API WEBHOOK ---
async function sendMessageToAI(message) {
    messageCount++;
    chatHistory.push({ role: "Céliane", text: message });

    const url = WEBHOOK_URLS[currentSubject];
    const payload = {
        sessionId: sessionId,
        messageCount: messageCount,
        chatInput: message,
        history: chatHistory,
        subject: currentSubject,
        user: "Céliane",
        spreadsheetId: activeSpreadsheetId,
        activeFileId: "" // Pas de fichier de leçon pour l'instant
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        let botResponseText = "";
        
        // n8n peut renvoyer du texte brut, un objet JSON standard n8n, etc.
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();
            
            let responseData = Array.isArray(data) && data.length > 0 ? data[0] : data;
            
            // Si n8n nous renvoie l'ID du document, on le stocke pour les prochains messages
            if (responseData.spreadsheetId) {
                activeSpreadsheetId = responseData.spreadsheetId;
            }

            if (responseData.response) {
                botResponseText = responseData.response;
            } else if (responseData.output) {
                botResponseText = responseData.output;
            } else if (responseData.text) {
                botResponseText = responseData.text;
            } else {
                botResponseText = JSON.stringify(responseData);
            }
        } else {
            botResponseText = await response.text();
        }

        if(!botResponseText || botResponseText.trim() === "") {
             botResponseText = "Je n'ai pas compris, pourrais-tu reformuler ?";
        }

        chatHistory.push({ role: "Professeur", text: botResponseText });
        appendMessage('bot', botResponseText);

    } catch (error) {
        console.error('Erreur webhook:', error);
        appendMessage('bot', "Oups ! Il y a eu un problème de connexion avec mon cerveau (le webhook). Réessaie dans un instant ! 🚨");
    }
}

// Lancer l'appli au chargement
document.addEventListener('DOMContentLoaded', init);
