let gameState = {
    history: [],
    currentPlayer: 'A',
    profileA: null,
    profileB: null,
    imageA: null,
    imageB: null,
    countA: 0,
    countB: 0,
    round: 1,
    isProcessing: false
};

function handleFileSelect(player, input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        const preview = document.getElementById('preview-' + player);
        const placeholder = document.getElementById('placeholder-' + player);
        const uploadArea = document.getElementById('upload-' + player);

        preview.src = dataUrl;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        uploadArea.classList.add('has-image');

        if (player === 'a') {
            gameState.imageA = dataUrl;
        } else {
            gameState.imageB = dataUrl;
        }

        analyzePhoto(player, dataUrl);
    };
    reader.readAsDataURL(file);
}

async function analyzePhoto(player, imageData) {
    const profileEl = document.getElementById('profile-' + player);
    const setupLoading = document.getElementById('setup-loading');
    const loadingText = document.getElementById('setup-loading-text');

    setupLoading.style.display = 'block';
    loadingText.textContent = (player === 'a' ? '罪人A' : '罪人B') + 'の人相を鑑定中...';

    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        });

        const result = await response.json();

        if (result.error) {
            alert('鑑定エラー: ' + result.error);
            setupLoading.style.display = 'none';
            return;
        }

        if (player === 'a') {
            gameState.profileA = result;
        } else {
            gameState.profileB = result;
        }

        profileEl.innerHTML = `
            <div class="profile-name">${escapeHtml(result.name)}</div>
            <div class="profile-item"><span>性格:</span> ${escapeHtml(result.personality)}</div>
            <div class="profile-item"><span>職業:</span> ${escapeHtml(result.occupation)}</div>
            <div class="profile-item"><span>闇:</span> ${escapeHtml(result.darkness)}</div>
        `;
        profileEl.style.display = 'block';

        setupLoading.style.display = 'none';
        checkReadyToStart();

    } catch (err) {
        alert('通信エラーが発生しました。もう一度お試しください。');
        setupLoading.style.display = 'none';
    }
}

function checkReadyToStart() {
    const btn = document.getElementById('start-btn');
    btn.disabled = !(gameState.profileA && gameState.profileB);
}

function startGame() {
    if (!gameState.profileA || !gameState.profileB) return;

    document.getElementById('game-setup').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';

    document.getElementById('battle-img-a').src = gameState.imageA;
    document.getElementById('battle-img-b').src = gameState.imageB;
    document.getElementById('battle-name-a').textContent = gameState.profileA.name;
    document.getElementById('battle-name-b').textContent = gameState.profileB.name;

    runNextTurn();
}

async function runNextTurn() {
    if (gameState.isProcessing) return;
    gameState.isProcessing = true;

    const loading = document.getElementById('battle-loading');
    const loadingText = document.getElementById('battle-loading-text');
    const nextBtn = document.getElementById('next-round-btn-area');
    nextBtn.style.display = 'none';

    const currentProfile = gameState.currentPlayer === 'A' ? gameState.profileA : gameState.profileB;
    const playerName = currentProfile.name;

    updateActivePlayer();

    loading.style.display = 'block';
    loadingText.textContent = `${playerName}が悪行を告白中...`;

    try {
        const confessResponse = await fetch('/confess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profile: currentProfile,
                history: gameState.history,
                current_player: gameState.currentPlayer
            })
        });

        const confessResult = await confessResponse.json();

        if (confessResult.error) {
            alert('告白生成エラー: ' + confessResult.error);
            loading.style.display = 'none';
            gameState.isProcessing = false;
            nextBtn.style.display = 'block';
            return;
        }

        const confession = confessResult.confession;
        gameState.history.push({
            player: gameState.currentPlayer,
            confession: confession
        });

        addConfessionEntry(gameState.currentPlayer, confession);

        if (gameState.currentPlayer === 'A') {
            gameState.countA++;
            document.getElementById('count-a').textContent = gameState.countA + '回';
        } else {
            gameState.countB++;
            document.getElementById('count-b').textContent = gameState.countB + '回';
        }

        loadingText.textContent = '審判官が判定中...';

        const judgeResponse = await fetch('/judge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                history: gameState.history,
                profile_a: gameState.profileA,
                profile_b: gameState.profileB
            })
        });

        const judgeResult = await judgeResponse.json();

        if (judgeResult.error) {
            alert('審判エラー: ' + judgeResult.error);
            loading.style.display = 'none';
            gameState.isProcessing = false;
            nextBtn.style.display = 'block';
            return;
        }

        gameState.history[gameState.history.length - 1].judge_comment = judgeResult.judge_comment;
        addJudgeEntry(judgeResult.judge_comment);

        loading.style.display = 'none';

        if (judgeResult.is_over) {
            gameState.isProcessing = false;
            setTimeout(() => showResult(judgeResult), 1500);
            return;
        }

        gameState.currentPlayer = gameState.currentPlayer === 'A' ? 'B' : 'A';
        if (gameState.currentPlayer === 'A') {
            gameState.round++;
            document.getElementById('round-num').textContent = gameState.round;
        }

        gameState.isProcessing = false;
        nextBtn.style.display = 'block';

    } catch (err) {
        alert('通信エラーが発生しました。もう一度お試しください。');
        loading.style.display = 'none';
        gameState.isProcessing = false;
        nextBtn.style.display = 'block';
    }
}

function nextRound() {
    runNextTurn();
}

function updateActivePlayer() {
    const playerA = document.getElementById('battle-player-a');
    const playerB = document.getElementById('battle-player-b');
    playerA.classList.toggle('active', gameState.currentPlayer === 'A');
    playerB.classList.toggle('active', gameState.currentPlayer === 'B');
}

function addConfessionEntry(player, confession) {
    const historyArea = document.getElementById('history-area');
    const profile = player === 'A' ? gameState.profileA : gameState.profileB;
    const imgSrc = player === 'A' ? gameState.imageA : gameState.imageB;

    const entry = document.createElement('div');
    entry.className = 'history-entry player-' + player.toLowerCase();
    entry.innerHTML = `
        <div class="entry-header">
            <img class="entry-avatar" src="${imgSrc}">
            ${escapeHtml(profile.name)}
        </div>
        <div class="entry-text">${escapeHtml(confession)}</div>
    `;
    historyArea.appendChild(entry);
    entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function addJudgeEntry(comment) {
    const historyArea = document.getElementById('history-area');
    const entry = document.createElement('div');
    entry.className = 'judge-entry';
    entry.innerHTML = `
        <div class="judge-label">審判官</div>
        <div class="judge-text">${escapeHtml(comment)}</div>
    `;
    historyArea.appendChild(entry);
    entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showResult(result) {
    document.getElementById('game-area').style.display = 'none';
    document.getElementById('result-area').style.display = 'block';

    document.getElementById('final-comment').textContent = result.judge_comment;

    const winnerProfile = result.winner === 'A' ? gameState.profileA : gameState.profileB;
    const winnerImg = result.winner === 'A' ? gameState.imageA : gameState.imageB;

    document.getElementById('winner-name').textContent = winnerProfile.name;
    document.getElementById('winner-img').src = winnerImg;
}

function resetGame() {
    gameState = {
        history: [],
        currentPlayer: 'A',
        profileA: null,
        profileB: null,
        imageA: null,
        imageB: null,
        countA: 0,
        countB: 0,
        round: 1,
        isProcessing: false
    };

    document.getElementById('history-area').innerHTML = '';
    document.getElementById('count-a').textContent = '0回';
    document.getElementById('count-b').textContent = '0回';
    document.getElementById('round-num').textContent = '1';

    document.getElementById('preview-a').style.display = 'none';
    document.getElementById('preview-b').style.display = 'none';
    document.getElementById('placeholder-a').style.display = 'flex';
    document.getElementById('placeholder-b').style.display = 'flex';
    document.getElementById('upload-a').classList.remove('has-image');
    document.getElementById('upload-b').classList.remove('has-image');
    document.getElementById('profile-a').style.display = 'none';
    document.getElementById('profile-b').style.display = 'none';
    document.getElementById('file-a').value = '';
    document.getElementById('file-b').value = '';
    document.getElementById('start-btn').disabled = true;

    document.getElementById('result-area').style.display = 'none';
    document.getElementById('game-area').style.display = 'none';
    document.getElementById('game-setup').style.display = 'block';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
