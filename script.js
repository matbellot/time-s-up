// Variabili globali
let gameConfig = {
    numPlayers: 4,
    wordsPerPlayer: 5,
    numRounds: 3,
    timer: 30
};

let allWords = [];
let currentPlayer = 1;
let currentWords = [];
let currentWordIndex = 0;
let timerInterval = null;
let timeRemaining = 0;
let timerProgress = null;
let currentRound = 1;
let totalRounds = 1;
let currentTeam = 1; // 1 o 2
let wordsGuessed = { team1: 0, team2: 0 }; // Parole indovinate per squadra nel round corrente
let totalScores = { team1: 0, team2: 0 }; // Punti totali delle squadre
let timerRunning = false; // Flag per sapere se il timer è attivo
let audioContext = null; // Contesto audio per i suoni
let teamNames = { team1: 'Squadra 1', team2: 'Squadra 2' };
let roundScores = []; // Array con i punteggi di ogni round: [{round: 1, team1: 5, team2: 3}, ...]

// Inizializzazione Audio Context
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

// Funzione per generare un suono
function playSound(frequency, duration, type = 'sine', volume = 0.3) {
    try {
        const ctx = initAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
        // Fallback silenzioso se l'audio non è disponibile
        console.log('Audio non disponibile');
    }
}

// Suoni per diverse interazioni
const sounds = {
    // Suono per parola indovinata (suono positivo, ascendente)
    success: () => {
        playSound(400, 0.1, 'sine', 0.2);
        setTimeout(() => playSound(600, 0.15, 'sine', 0.2), 50);
    },

    // Suono per parola saltata (suono neutro)
    skip: () => {
        playSound(300, 0.1, 'sine', 0.15);
    },

    // Suono per inizio timer (suono di avvio)
    start: () => {
        playSound(500, 0.2, 'sine', 0.25);
        setTimeout(() => playSound(600, 0.15, 'sine', 0.2), 100);
    },

    // Suono per timer scaduto (suono di allarme)
    timeUp: () => {
        playSound(200, 0.3, 'square', 0.3);
        setTimeout(() => playSound(150, 0.3, 'square', 0.3), 300);
        setTimeout(() => playSound(200, 0.3, 'square', 0.3), 600);
    },

    // Suono per cambio turno (suono di transizione)
    turnChange: () => {
        playSound(350, 0.15, 'sine', 0.2);
        setTimeout(() => playSound(450, 0.2, 'sine', 0.2), 100);
    },

    // Suono per aggiunta parola (suono breve)
    addWord: () => {
        playSound(500, 0.08, 'sine', 0.15);
    },

    // Suono per fine round (suono di completamento)
    roundComplete: () => {
        playSound(400, 0.15, 'sine', 0.2);
        setTimeout(() => playSound(500, 0.15, 'sine', 0.2), 100);
        setTimeout(() => playSound(600, 0.2, 'sine', 0.25), 200);
    },

    // Suono per fine gioco (suono di vittoria)
    gameComplete: () => {
        playSound(523, 0.2, 'sine', 0.25); // Do
        setTimeout(() => playSound(659, 0.2, 'sine', 0.25), 200); // Mi
        setTimeout(() => playSound(784, 0.2, 'sine', 0.25), 400); // Sol
        setTimeout(() => playSound(1047, 0.4, 'sine', 0.3), 600); // Do alto
    },

    // Suono per click generico
    click: () => {
        playSound(800, 0.05, 'sine', 0.1);
    },

    // Suono per countdown (quando mancano pochi secondi)
    countdown: () => {
        playSound(600, 0.1, 'sine', 0.15);
    }
};

// Inizializzazione
document.addEventListener('DOMContentLoaded', function() {
    // Aggiorna il valore del timer quando cambia lo slider
    const timerSlider = document.getElementById('timer');
    const timerValue = document.getElementById('timerValue');

    timerSlider.addEventListener('input', function() {
        timerValue.textContent = this.value;
    });

    // Permetti l'invio della parola con Enter
    const wordInput = document.getElementById('wordInput');
    wordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addWord();
        }
    });

    // Aggiungi suono click a tutti i pulsanti principali (esclusi quelli di gioco)
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', function(e) {
            // Suono click solo per pulsanti non di gioco (per evitare sovrapposizioni)
            const isGameButton = this.classList.contains('btn-success') ||
                                 this.classList.contains('btn-skip') ||
                                 this.getAttribute('onclick')?.includes('wordGuessed') ||
                                 this.getAttribute('onclick')?.includes('skipWord');

            if (!isGameButton) {
                // Piccolo delay per evitare sovrapposizioni
                setTimeout(() => sounds.click(), 10);
            }
        });
    });
});

// Funzione per cambiare vista
function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');
}

// Inizia l'inserimento delle parole
function startWordInput() {
    // Salva la configurazione
    gameConfig.numPlayers = parseInt(document.getElementById('numPlayers').value);
    gameConfig.wordsPerPlayer = parseInt(document.getElementById('wordsPerPlayer').value);
    gameConfig.numRounds = parseInt(document.getElementById('numRounds').value);
    gameConfig.timer = parseInt(document.getElementById('timer').value);
    // Salva i nomi squadra (default se vuoti)
    const name1 = document.getElementById('team1Name').value.trim() || 'Squadra 1';
    const name2 = document.getElementById('team2Name').value.trim() || 'Squadra 2';
    teamNames.team1 = name1;
    teamNames.team2 = name2;

    // Reset
    allWords = [];
    currentPlayer = 1;
    currentWords = [];
    currentWordIndex = 0;

    // Mostra la vista di inserimento parole
    showView('wordInputView');
    updatePlayerLabel();
    document.getElementById('wordInput').focus();
}

// Aggiorna l'etichetta del giocatore corrente
function updatePlayerLabel() {
    document.getElementById('currentPlayerLabel').textContent =
        `Giocatore ${currentPlayer}, inserisci le tue parole`;
    document.getElementById('wordsDisplay').innerHTML = '';
    const wordInput = document.getElementById('wordInput');
    wordInput.value = '';
    wordInput.disabled = false;
    wordInput.placeholder = 'Scrivi una parola...';
    document.getElementById('nextPlayerBtn').style.display = 'none';
    document.getElementById('startGameBtn').style.display = 'none';
}

// Aggiungi una parola
function addWord() {
    const wordInput = document.getElementById('wordInput');
    const word = wordInput.value.trim();

    if (word === '') {
        return;
    }

    // Controlla PRIMA se il giocatore ha già raggiunto il limite
    const currentPlayerWords = allWords.filter((_, index) =>
        Math.floor(index / gameConfig.wordsPerPlayer) === currentPlayer - 1
    ).length;

    // Se il giocatore ha già inserito tutte le parole, non permettere di aggiungerne altre
    if (currentPlayerWords >= gameConfig.wordsPerPlayer) {
        // Mostra i pulsanti se non sono già visibili
        if (currentPlayer < gameConfig.numPlayers) {
            document.getElementById('nextPlayerBtn').style.display = 'block';
        } else {
            document.getElementById('startGameBtn').style.display = 'block';
        }
        // Disabilita l'input e mostra un messaggio
        wordInput.disabled = true;
        wordInput.placeholder = 'Hai già inserito tutte le tue parole!';
        return;
    }

    // Riabilita l'input se era disabilitato
    wordInput.disabled = false;
    wordInput.placeholder = 'Scrivi una parola...';

    // Suono per aggiunta parola
    sounds.addWord();

    // Aggiungi la parola all'array globale
    allWords.push(word);

    // Mostra la parola nella lista
    displayWord(word);

    // Pulisci l'input
    wordInput.value = '';
    wordInput.focus();

    // Controlla se il giocatore ha inserito tutte le parole (dopo l'aggiunta)
    const playerWordsAfter = allWords.filter((_, index) =>
        Math.floor(index / gameConfig.wordsPerPlayer) === currentPlayer - 1
    ).length;

    if (playerWordsAfter >= gameConfig.wordsPerPlayer) {
        if (currentPlayer < gameConfig.numPlayers) {
            document.getElementById('nextPlayerBtn').style.display = 'block';
            wordInput.disabled = true;
            wordInput.placeholder = 'Hai inserito tutte le tue parole! Clicca "Prossimo Giocatore"';
        } else {
            document.getElementById('startGameBtn').style.display = 'block';
            wordInput.disabled = true;
            wordInput.placeholder = 'Tutti i giocatori hanno inserito le parole! Clicca "Inizia il Gioco"';
        }
    }
}

// Mostra una parola nella lista
function displayWord(word) {
    const wordsDisplay = document.getElementById('wordsDisplay');
    const wordTag = document.createElement('div');
    wordTag.className = 'word-tag';
    wordTag.textContent = word;
    wordsDisplay.appendChild(wordTag);
}

// Passa al prossimo giocatore
function nextPlayer() {
    currentPlayer++;
    if (currentPlayer <= gameConfig.numPlayers) {
        updatePlayerLabel();
    }
}

// Inizia il gioco
function startGame() {
    if (allWords.length === 0) {
        alert('Inserisci almeno una parola!');
        return;
    }

    // Il numero di round è configurato dall'utente
    totalRounds = gameConfig.numRounds;
    currentRound = 1;
    currentTeam = 1;
    wordsGuessed = { team1: 0, team2: 0 };
    totalScores = { team1: 0, team2: 0 }; // Punti totali accumulati durante tutti i round
    timerRunning = false;

    // Crea una copia delle parole e mescolale
    currentWords = [...allWords];
    shuffleArray(currentWords);
    currentWordIndex = 0;

    showView('gameView');
    updateGameHeader();
    prepareRound();
}

// Algoritmo Fisher-Yates per mescolare l'array
function shuffleArray(array) {
    // Mescola l'array in-place usando Fisher-Yates
    for (let i = array.length - 1; i > 0; i--) {
        // Usa Math.random() con un range più ampio per maggiore casualità
        const j = Math.floor(Math.random() * (i + 1));
        // Swap
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Aggiorna l'header del gioco
function updateGameHeader() {
    document.getElementById('currentRound').textContent = currentRound;
    document.getElementById('totalRounds').textContent = totalRounds;
    document.getElementById('currentTeamLabel').textContent = teamNames[`team${currentTeam}`];
}

// Prepara un round (nasconde la parola fino a quando non si preme "Inizia Timer")
function prepareRound() {
    if (currentWords.length === 0) {
        endRound();
        return;
    }

    // Nascondi la parola e mostra il messaggio di preparazione
    document.getElementById('currentWord').style.display = 'none';
    document.getElementById('prepareMessage').style.display = 'block';

    // Mostra il numero di secondi configurato nel countdown fin dall'inizio
    const timerText = document.getElementById('timerText');
    const timerProgress = document.getElementById('timerProgress');
    timerText.textContent = gameConfig.timer;
    timerText.className = 'timer-text';
    timerProgress.style.strokeDashoffset = 0;
    timerProgress.style.stroke = '#6366f1';

    updateRemainingWords();

    // Mostra il pulsante per iniziare il timer
    document.getElementById('startTimerBtnContainer').style.display = 'block';
    document.getElementById('gameButtons').style.display = 'none';
    timerRunning = false;
}

// Inizia un round (chiamato quando si preme "Inizia Timer")
function startRound() {
    if (currentWords.length === 0) {
        endRound();
        return;
    }

    // Suono per inizio timer
    sounds.start();

    // Mostra la parola e nascondi il messaggio di preparazione
    document.getElementById('prepareMessage').style.display = 'none';
    document.getElementById('currentWord').style.display = 'block';
    displayCurrentWord();

    // Nascondi il pulsante e mostra i pulsanti di gioco
    document.getElementById('startTimerBtnContainer').style.display = 'none';
    document.getElementById('gameButtons').style.display = 'flex';

    // Avvia il timer
    startTimer();
}

// Mostra la parola corrente
function displayCurrentWord() {
    // Assicurati che l'indice sia valido
    if (currentWords.length === 0) {
        return;
    }

    // Se l'indice è fuori range, resettalo
    if (currentWordIndex >= currentWords.length) {
        currentWordIndex = 0;
    }

    if (currentWordIndex < currentWords.length) {
        document.getElementById('currentWord').textContent = currentWords[currentWordIndex];
    }
}

// Aggiorna il contatore delle parole rimanenti
function updateRemainingWords() {
    document.getElementById('remainingWords').textContent = currentWords.length;
}

// Avvia il timer
function startTimer() {
    if (timerRunning) {
        return; // Il timer è già attivo
    }

    timerRunning = true;
    timeRemaining = gameConfig.timer;
    const timerText = document.getElementById('timerText');
    const timerProgress = document.getElementById('timerProgress');

    // Reset del timer visivo
    timerText.textContent = timeRemaining;
    timerText.className = 'timer-text';
    timerProgress.style.stroke = '#6366f1';

    const circumference = 2 * Math.PI * 45; // raggio = 45
    const totalTime = gameConfig.timer;

    // Calcola l'offset iniziale
    timerProgress.style.strokeDashoffset = 0;

    // Pulisci eventuali timer precedenti
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    timerInterval = setInterval(() => {
        timeRemaining--;
        timerText.textContent = timeRemaining;

        // Aggiorna la barra di progresso
        const progress = timeRemaining / totalTime;
        timerProgress.style.strokeDashoffset = circumference * (1 - progress);

        // Cambia colore quando il tempo sta per scadere
        if (timeRemaining <= 5) {
            timerText.className = 'timer-text danger';
            timerProgress.style.stroke = '#ef4444';
            // Suono countdown quando mancano 5 secondi o meno (solo una volta per secondo)
            if (timeRemaining > 0 && timeRemaining <= 5) {
                sounds.countdown();
            }
        } else if (timeRemaining <= 10) {
            timerText.className = 'timer-text warning';
            timerProgress.style.stroke = '#f59e0b';
        }

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            timerRunning = false;
            timerExpired();
        }
    }, 1000);
}

// Timer scaduto
function timerExpired() {
    // Ferma il timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // Suono per timer scaduto
    sounds.timeUp();

    // Vibra se disponibile
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }

    // Reset del timer visivo
    const timerProgress = document.getElementById('timerProgress');
    timerProgress.style.strokeDashoffset = 0;
    timerProgress.style.stroke = '#6366f1';

    // Mostra la modale di cambio turno
    showTurnChangeModal();
}

// Mostra la modale di cambio turno
function showTurnChangeModal() {
    const nextTeam = currentTeam === 1 ? 2 : 1;
    const teamName = teamNames[`team${nextTeam}`];

    document.getElementById('nextTeamLabel').textContent = teamName;
    document.getElementById('turnChangeModal').classList.add('active');
}

// Chiudi la modale di cambio turno e cambia squadra
function closeTurnChangeModal() {
    document.getElementById('turnChangeModal').classList.remove('active');

    // Suono per cambio turno
    sounds.turnChange();

    // Cambia squadra
    currentTeam = currentTeam === 1 ? 2 : 1;
    updateGameHeader();

    // Se ci sono ancora parole, cambia la parola corrente per non ripeterla
    if (currentWords.length > 0) {
        // Sposta la parola corrente in fondo al mazzo per evitare ripetizioni
        if (currentWordIndex < currentWords.length) {
            const word = currentWords.splice(currentWordIndex, 1)[0];
            currentWords.push(word);

            // Dopo lo spostamento, gestisci l'indice correttamente
            // Se l'indice era l'ultimo elemento, ora punta alla parola appena spostata
            // Se l'indice era un elemento intermedio, ora punta già alla prossima parola
            if (currentWordIndex >= currentWords.length) {
                // Caso edge: non dovrebbe mai accadere, ma per sicurezza
                currentWordIndex = 0;
            } else if (currentWordIndex === currentWords.length - 1) {
                // L'indice punta all'ultimo elemento che è la parola appena spostata
                currentWordIndex = 0;
            }
            // Altrimenti l'indice è già corretto (punta alla prossima parola)
        }

        // Prepara il round con la nuova parola
        prepareRound();
    } else {
        endRound();
    }
}

// Parola indovinata
function wordGuessed() {
    if (currentWordIndex < currentWords.length && timerRunning) {
        // Suono per parola indovinata
        sounds.success();

        // Incrementa il contatore per la squadra corrente
        wordsGuessed[`team${currentTeam}`]++;
        totalScores[`team${currentTeam}`]++;

        // Rimuovi la parola dal mazzo
        currentWords.splice(currentWordIndex, 1);

        // Se abbiamo finito le parole, vai alla vista fine round
        if (currentWords.length === 0) {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            timerRunning = false;
            endRound();
            return;
        }

        // Dopo la rimozione, l'indice potrebbe essere fuori range
        // Se l'indice è >= alla lunghezza, resettalo a 0
        // Altrimenti mantienilo (punta già alla prossima parola)
        if (currentWordIndex >= currentWords.length) {
            currentWordIndex = 0;
        }

        // Mostra la prossima parola
        displayCurrentWord();
        updateRemainingWords();
    }
}

// Salta la parola
function skipWord() {
    if (currentWordIndex < currentWords.length && timerRunning) {
        // Suono per parola saltata
        sounds.skip();

        // Sposta la parola corrente in fondo al mazzo
        const word = currentWords.splice(currentWordIndex, 1)[0];
        currentWords.push(word);

        // Dopo lo spostamento, se l'indice punta all'ultimo elemento
        // (che è la parola appena spostata), resettalo a 0
        // Altrimenti l'indice punta già alla prossima parola corretta
        if (currentWordIndex >= currentWords.length) {
            currentWordIndex = 0;
        } else if (currentWordIndex === currentWords.length - 1) {
            // L'indice punta all'ultimo elemento che è la parola appena spostata
            currentWordIndex = 0;
        }
        // Altrimenti l'indice è già corretto (punta alla prossima parola)

        // Mostra la prossima parola
        displayCurrentWord();
        updateRemainingWords();
    }
}

// Fine del round
function endRound() {
    // Ferma il timer se è ancora attivo
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerRunning = false;

    // Salva i punteggi del round corrente
    roundScores.push({
        round: currentRound,
        team1: wordsGuessed.team1,
        team2: wordsGuessed.team2
    });

    // Controlla se ci sono altri round
    if (currentRound < totalRounds) {
        // Suono per fine round
        sounds.roundComplete();

        // Mostra i punteggi del round e totali
        document.getElementById('completedRound').textContent = currentRound;

        // Aggiorna nomi squadre e punteggi round
        document.getElementById('roundTeam1Name').textContent = teamNames.team1;
        document.getElementById('roundScoreTeam1').textContent = wordsGuessed.team1;
        document.getElementById('roundTeam2Name').textContent = teamNames.team2;
        document.getElementById('roundScoreTeam2').textContent = wordsGuessed.team2;

        // Aggiorna nomi squadre e punteggi totali
        document.getElementById('totalTeam1Name').textContent = teamNames.team1;
        document.getElementById('totalScoreTeam1').textContent = totalScores.team1;
        document.getElementById('totalTeam2Name').textContent = teamNames.team2;
        document.getElementById('totalScoreTeam2').textContent = totalScores.team2;

        document.getElementById('nextRoundBtn').style.display = 'block';
        showView('endRoundView');
    } else {
        // Ultimo round completato - mostra i punteggi finali
        showFinalScores();
    }
}

// Passa al round successivo
function nextRound() {
    currentRound++;
    currentTeam = 1; // Inizia sempre con la squadra 1
    wordsGuessed = { team1: 0, team2: 0 };
    timerRunning = false;

    // Ricrea il mazzo con tutte le parole originali
    currentWords = [...allWords];
    shuffleArray(currentWords);
    currentWordIndex = 0;

    showView('gameView');
    updateGameHeader();
    prepareRound();
}

// Mostra i punteggi finali
function showFinalScores() {
    document.getElementById('finalScoreTeam1').textContent = totalScores.team1;
    document.getElementById('finalScoreTeam2').textContent = totalScores.team2;
    document.getElementById('finalTeam1Title').textContent = teamNames.team1;
    document.getElementById('finalTeam2Title').textContent = teamNames.team2;

    // Genera la tabella dei round
    const roundsTable = document.getElementById('roundsTable');
    roundsTable.innerHTML = '';

    roundScores.forEach(roundData => {
        const roundRow = document.createElement('div');
        roundRow.className = 'round-row';

        roundRow.innerHTML = `
            <div class="round-number">Round ${roundData.round}</div>
            <div class="round-scores">
                <div class="round-score">
                    <div class="score">${roundData.team1}</div>
                </div>
                <div class="round-score">
                    <div class="score">${roundData.team2}</div>
                </div>
            </div>
        `;

        roundsTable.appendChild(roundRow);
    });

    // Suono per fine gioco
    sounds.gameComplete();

    // Determina il vincitore
    const winnerMessage = document.getElementById('winnerMessage');
    if (totalScores.team1 > totalScores.team2) {
        winnerMessage.textContent = `🏆 ${teamNames.team1} vince!`;
        winnerMessage.className = 'winner-message winner';
    } else if (totalScores.team2 > totalScores.team1) {
        winnerMessage.textContent = `🏆 ${teamNames.team2} vince!`;
        winnerMessage.className = 'winner-message winner';
    } else {
        winnerMessage.textContent = '🤝 Pareggio!';
        winnerMessage.className = 'winner-message draw';
    }

    showView('endGameView');
}

// Modale conferma restart
function showConfirmRestart() {
    document.getElementById('confirmRestartModal').classList.add('active');
}
function confirmRestart(confirm) {
    document.getElementById('confirmRestartModal').classList.remove('active');
    if (confirm) {
        resetGame();
    }
}

// Reset completo del gioco
function resetGame() {
    // Ferma il timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // Chiudi eventuali modali aperte
    document.getElementById('turnChangeModal').classList.remove('active');

    // Reset delle variabili
    allWords = [];
    currentPlayer = 1;
    currentWords = [];
    currentWordIndex = 0;
    timeRemaining = 0;
    currentRound = 1;
    totalRounds = 1;
    currentTeam = 1;
    wordsGuessed = { team1: 0, team2: 0 };
    totalScores = { team1: 0, team2: 0 };
    roundScores = [];
    timerRunning = false;

    // Torna alla configurazione
    showView('configView');
}