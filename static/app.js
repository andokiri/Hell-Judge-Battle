let gameState = {
    history: [],
    currentPlayer: 'A',
    playerAName: 'プレイヤーA',
    playerBName: 'プレイヤーB',
    countA: 0,
    countB: 0,
    round: 1
};

function startGame() {
    const nameA = document.getElementById('player-a-name').value.trim() || 'プレイヤーA';
    const nameB = document.getElementById('player-b-name').value.trim() || 'プレイヤーB';

    gameState.playerAName = nameA;
    gameState.playerBName = nameB;

    document.getElementById('label-a').textContent = nameA;
    document.getElementById('label-b').textContent = nameB;

    document.getElementById('game-setup').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';

    updateTurnIndicator();
    updateActiveScore();
}

function updateTurnIndicator() {
    const name = gameState.currentPlayer === 'A' ? gameState.playerAName : gameState.playerBName;
    document.getElementById('turn-indicator').textContent = name + 'の番';
}

function updateActiveScore() {
    const scoreA = document.getElementById('score-a');
    const scoreB = document.getElementById('score-b');
    scoreA.classList.toggle('active', gameState.currentPlayer === 'A');
    scoreB.classList.toggle('active', gameState.currentPlayer === 'B');
}

document.getElementById('confession-input').addEventListener('input', function() {
    document.getElementById('char-count').textContent = this.value.length;
});

async function submitConfession() {
    const input = document.getElementById('confession-input');
    const confession = input.value.trim();

    if (!confession) return;

    const confessBtn = document.getElementById('confess-btn');
    const inputArea = document.getElementById('input-area');
    const loading = document.getElementById('loading');

    confessBtn.disabled = true;
    inputArea.style.display = 'none';
    loading.style.display = 'block';

    addHistoryEntry(gameState.currentPlayer, confession);

    try {
        const response = await fetch('/judge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                history: gameState.history,
                confession: confession,
                current_player: gameState.currentPlayer
            })
        });

        const result = await response.json();

        if (result.error) {
            alert('エラーが発生しました: ' + result.error);
            inputArea.style.display = 'block';
            loading.style.display = 'none';
            confessBtn.disabled = false;
            return;
        }

        gameState.history[gameState.history.length - 1].judge_comment = result.judge_comment;

        if (gameState.currentPlayer === 'A') {
            gameState.countA++;
            document.getElementById('count-a').textContent = gameState.countA + '回';
        } else {
            gameState.countB++;
            document.getElementById('count-b').textContent = gameState.countB + '回';
        }

        showJudgeComment(result.judge_comment);

        if (result.is_over) {
            loading.style.display = 'none';
            setTimeout(() => showResult(result), 1500);
            return;
        }

        gameState.currentPlayer = gameState.currentPlayer === 'A' ? 'B' : 'A';
        if (gameState.currentPlayer === 'A') {
            gameState.round++;
            document.getElementById('round-num').textContent = gameState.round;
        }

        updateTurnIndicator();
        updateActiveScore();

        input.value = '';
        document.getElementById('char-count').textContent = '0';

        loading.style.display = 'none';
        inputArea.style.display = 'block';
        confessBtn.disabled = false;
        input.focus();

    } catch (err) {
        alert('通信エラーが発生しました。もう一度お試しください。');
        inputArea.style.display = 'block';
        loading.style.display = 'none';
        confessBtn.disabled = false;
    }
}

function addHistoryEntry(player, confession) {
    gameState.history.push({ player, confession });

    const historyArea = document.getElementById('history-area');
    const name = player === 'A' ? gameState.playerAName : gameState.playerBName;

    const entry = document.createElement('div');
    entry.className = 'history-entry player-' + player.toLowerCase();
    entry.innerHTML = `
        <div class="entry-header">${name}</div>
        <div class="entry-text">${escapeHtml(confession)}</div>
    `;
    historyArea.appendChild(entry);
    entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showJudgeComment(comment) {
    const area = document.getElementById('judge-comment-area');
    const text = document.getElementById('judge-comment-text');
    text.textContent = comment;
    area.style.display = 'block';
    area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showResult(result) {
    document.getElementById('game-area').style.display = 'none';
    document.getElementById('result-area').style.display = 'block';

    document.getElementById('final-comment').textContent = result.judge_comment;

    const winnerName = result.winner === 'A' ? gameState.playerAName : gameState.playerBName;
    document.getElementById('winner-name').textContent = winnerName;
}

function resetGame() {
    gameState = {
        history: [],
        currentPlayer: 'A',
        playerAName: 'プレイヤーA',
        playerBName: 'プレイヤーB',
        countA: 0,
        countB: 0,
        round: 1
    };

    document.getElementById('history-area').innerHTML = '';
    document.getElementById('judge-comment-area').style.display = 'none';
    document.getElementById('confession-input').value = '';
    document.getElementById('char-count').textContent = '0';
    document.getElementById('count-a').textContent = '0回';
    document.getElementById('count-b').textContent = '0回';
    document.getElementById('round-num').textContent = '1';
    document.getElementById('player-a-name').value = '';
    document.getElementById('player-b-name').value = '';

    document.getElementById('result-area').style.display = 'none';
    document.getElementById('game-area').style.display = 'none';
    document.getElementById('game-setup').style.display = 'block';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.getElementById('confession-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitConfession();
    }
});
