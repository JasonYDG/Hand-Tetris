// 游戏主控制器
let tetrisGame;
let handControl;
let isPausedByCamera = false; // New flag

// 排行榜数据
let leaderboard = [];

// 从本地存储加载排行榜
function loadLeaderboard() {
    try {
        const saved = localStorage.getItem('handTetrisLeaderboard');
        if (saved) {
            leaderboard = JSON.parse(saved);
        } else {
            // 初始化默认排行榜
            leaderboard = [
                { name: 'Hand Master', score: 10000 },
                { name: 'Gesture Pro', score: 5000 },
                { name: 'Wave Control', score: 2500 }
            ];
        }
    } catch (e) {
        console.error('加载排行榜失败:', e);
        leaderboard = [
            { name: 'Hand Master', score: 10000 },
            { name: 'Gesture Pro', score: 5000 },
            { name: 'Wave Control', score: 2500 }
        ];
    }
    updateLeaderboardDisplay();
}

// 保存排行榜到本地存储
function saveLeaderboard() {
    try {
        localStorage.setItem('handTetrisLeaderboard', JSON.stringify(leaderboard));
    } catch (e) {
        console.error('保存排行榜失败:', e);
    }
}

// 更新排行榜显示
function updateLeaderboardDisplay() {
    const leaderboardContent = document.getElementById('leaderboard-content');
    if (!leaderboardContent) return;

    // 按分数降序排列
    const sorted = [...leaderboard].sort((a, b) => b.score - a.score);

    // 只显示前三名
    const topThree = sorted.slice(0, 3);

    // 填充到3个条目
    while (topThree.length < 3) {
        topThree.push({ name: '-', score: 0 });
    }

    leaderboardContent.innerHTML = topThree.map((entry, index) => `
        <div class="leaderboard-entry">
            <span class="rank">${index + 1}</span>
            <span class="player">${entry.name}</span>
            <span class="score">${entry.score}</span>
        </div>
    `).join('');
}

// 显示游戏结束弹窗
function showGameOverModal(finalScore) {
    const modal = document.getElementById('game-over-modal');
    const finalScoreDisplay = document.getElementById('final-score-display');
    const modalLeaderboardContent = document.getElementById('modal-leaderboard-content');

    // 显示最终分数
    finalScoreDisplay.textContent = finalScore.toLocaleString();

    // 检查并更新排行榜
    const isNewRecord = checkAndUpdateLeaderboard(finalScore);

    // 更新弹窗中的排行榜显示
    updateModalLeaderboardDisplay();

    // 显示弹窗
    modal.style.display = 'flex';

    // 如果是新纪录，添加特效
    if (isNewRecord) {
        finalScoreDisplay.style.animation = 'newRecordGlow 2s ease-in-out infinite';
    }
}

// 更新弹窗中的排行榜显示
function updateModalLeaderboardDisplay() {
    const modalLeaderboardContent = document.getElementById('modal-leaderboard-content');
    if (!modalLeaderboardContent) return;

    // 按分数降序排列
    const sorted = [...leaderboard].sort((a, b) => b.score - a.score);

    // 只显示前三名
    const topThree = sorted.slice(0, 3);

    // 填充到3个条目
    while (topThree.length < 3) {
        topThree.push({ name: '-', score: 0 });
    }

    modalLeaderboardContent.innerHTML = topThree.map((entry, index) => `
        <div class="leaderboard-entry">
            <span class="rank">${index + 1}</span>
            <span class="player">${entry.name}</span>
            <span class="score">${entry.score.toLocaleString()}</span>
        </div>
    `).join('');
}

// 隐藏游戏结束弹窗
function hideGameOverModal() {
    const modal = document.getElementById('game-over-modal');
    const finalScoreDisplay = document.getElementById('final-score-display');

    modal.style.display = 'none';
    finalScoreDisplay.style.animation = '';
}

// Callback for hand control to notify gesture detection status changes
function onGestureStatusChangeCallback(isDetected) {
    if (isDetected) {
        // Gesture detected
        if (isPausedByCamera) { // Only resume if paused specifically by camera
            console.log('Gesture detected, resuming game...');
            tetrisGame.start();
            isPausedByCamera = false;
            updateButtonStates();
        }
    } else {
        // No gesture detected
        // Only pause if game is currently running AND not already paused by user
        if (tetrisGame.gameRunning && !isPausedByCamera) {
            console.log('No gesture detected, pausing game...');
            tetrisGame.pause();
            isPausedByCamera = true;
            updateButtonStates();
        }
    }
}

// 检查新纪录并更新排行榜
function checkAndUpdateLeaderboard(finalScore) {
    // 检查是否进入排行榜前三
    const sorted = [...leaderboard].sort((a, b) => b.score - a.score);
    const isTopScore = sorted.length < 3 || finalScore > sorted[2].score;

    if (isTopScore) {
        // 添加新纪录
        const playerName = prompt('🎉 Congratulations! New record! Please enter your name:', 'Player') || 'Anonymous';
        leaderboard.push({ name: playerName, score: finalScore });

        // 重新排序并只保留前10条记录
        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard = leaderboard.slice(0, 10);

        // 保存并更新显示
        saveLeaderboard();
        updateLeaderboardDisplay();

        return true;
    }

    return false;
}

// 播放新纪录音效
function playNewRecordSound() {
    try {
        // 创建特殊的新纪录音效
        const audioContext = getAudioContext();

        // 播放胜利音效
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                // 渐升的音调
                oscillator.frequency.setValueAtTime(440 + i * 200, audioContext.currentTime);
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);

                // 清理资源
                oscillator.onended = () => {
                    gainNode.disconnect();
                };
            }, i * 200);
        }
    } catch (e) {
        console.log('新纪录音效播放失败:', e);
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', function () {
    try {
        console.log('开始初始化HandTris游戏...');

        // 加载排行榜
        loadLeaderboard();

        tetrisGame = new TetrisGame();
        window.tetrisGame = tetrisGame; // 暴露到全局作用域
        console.log('TetrisGame 创建成功');

        // 调整画布尺寸
        adjustCanvasSize();
        
        // 初始化next-canvas尺寸
        const nextCanvas = document.getElementById('next-canvas');
        if (nextCanvas) {
            nextCanvas.width = 100;
            nextCanvas.height = 100;
        }
        
        // 多次强制刷新画布尺寸
        setTimeout(() => {
            adjustCanvasSize();
            if (tetrisGame) {
                tetrisGame.updateBlockSize();
            }
        }, 100);
        
        setTimeout(() => {
            adjustCanvasSize();
            if (tetrisGame) {
                tetrisGame.updateBlockSize();
            }
        }, 500);
        
        setTimeout(() => {
            adjustCanvasSize();
            if (tetrisGame) {
                tetrisGame.updateBlockSize();
            }
        }, 1000);

        handControl = new HandControl(tetrisGame, onCalibrationComplete, onGestureStatusChangeCallback);
        window.handControl = handControl; // 暴露到全局作用域
        window.startGameAutomatically = startGameAutomatically; // 暴露启动函数到全局作用域
        window.updateButtonStates = updateButtonStates; // 暴露按钮状态更新函数到全局作用域
        console.log('HandControl 创建成功');

        // 设置方块落地回调，重置下降速度
        tetrisGame.onPiecePlaced = () => {
            handControl.resetDropSpeed();
        };

        // 初始绘制
        console.log('开始初始绘制...');
        tetrisGame.draw();

        // 绑定按钮事件
        setupEventListeners();

        // 设置弹窗事件监听器
        setupModalEventListeners();

        // 键盘控制 (备用)
        setupKeyboardControls();

        console.log('HandTris游戏初始化完成 - 使用手势控制');

        // 定期更新画布内部分辨率（不改变显示尺寸）
        setInterval(() => {
            if (tetrisGame && tetrisGame.canvas) {
                adjustCanvasSize(); // 只更新内部分辨率
                tetrisGame.updateBlockSize();
            }
        }, 5000); // 每5秒检查一次

        // 自动启动摄像头
        setTimeout(async () => {
            try {
                console.log('自动启动摄像头进行手势检测...');
                await handControl.startCamera();
                console.log('手势检测摄像头自动启动成功');

                // 摄像头启动成功，等待校准完成后再启动游戏
                console.log('Camera started successfully, waiting for calibration to complete before starting game');
            } catch (error) {
                console.error('手势检测摄像头自动启动失败:', error);
                // 如果自动启动失败，显示摄像头按钮让用户手动启动
                const cameraBtn = document.getElementById('camera-btn');
                if (cameraBtn) {
                    cameraBtn.style.display = 'inline-block';
                }
            }
        }, 500);

        // 设置音效系统
        setTimeout(() => {
            setupAudioSystem();
            // 初始化音乐按钮状态
            setTimeout(() => {
                initBGMButtonState();
            }, 500);
        }, 1000);

    } catch (error) {
        console.error('HandTris游戏初始化失败:', error);
        alert('HandTris游戏初始化失败: ' + error.message);
    }
});

// 校准完成回调函数
function onCalibrationComplete() {
    console.log('Hand gesture calibration completed, starting game and BGM');
    
    // 启动游戏
    startGameAutomatically();
    
    // 启动BGM
    setTimeout(() => {
        if (window.bgmControl && window.bgmControl.isOn && !window.bgmControl.isPlaying) {
            console.log('Auto-starting BGM after hand gesture calibration');
            window.bgmControl.start();
        }
    }, 500);
}

// 重新开始游戏的统一函数
function restartGame() {
    console.log('Restarting HandTris game...');
    if (tetrisGame) {
        tetrisGame.reset();
    }
    // startGameAutomatically will handle the actual start
    startGameAutomatically();
}

// 设置弹窗事件监听器
function setupModalEventListeners() {
    const modal = document.getElementById('game-over-modal');
    const closeModal = document.getElementById('close-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const restartGameBtn = document.getElementById('restart-game-btn');

    // 关闭弹窗
    closeModal.addEventListener('click', () => {
        hideGameOverModal();
        // 关闭弹窗后自动开始新游戏
        setTimeout(() => {
            restartGame();
        }, 500);
    });

    closeModalBtn.addEventListener('click', () => {
        hideGameOverModal();
        // 关闭弹窗后自动开始新游戏
        setTimeout(() => {
            restartGame();
        }, 500);
    });

    // 重新开始游戏
    restartGameBtn.addEventListener('click', () => {
        hideGameOverModal();
        restartGame();
    });

    // 点击弹窗外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideGameOverModal();
            // 关闭弹窗后自动开始新游戏
            setTimeout(() => {
                restartGame();
            }, 500);
        }
    });

    // ESC键关闭弹窗
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            hideGameOverModal();
            // 关闭弹窗后自动开始新游戏
            setTimeout(() => {
                restartGame();
            }, 500);
        }
    });

    // 游戏结束弹窗显示3秒后自动关闭并开始新游戏
    let autoCloseTimer = null;
    let countdownTimer = null;

    // 监听弹窗显示事件
    const originalShowModal = showGameOverModal;
    window.showGameOverModal = function (finalScore) {
        originalShowModal(finalScore);

        // 清除之前的定时器
        if (autoCloseTimer) {
            clearTimeout(autoCloseTimer);
        }
        if (countdownTimer) {
            clearInterval(countdownTimer);
        }

        // 开始倒计时显示
        let countdown = 3;
        const countdownElement = document.getElementById('auto-restart-countdown');

        function updateCountdown() {
            if (countdownElement) {
                countdownElement.textContent = `New game starts in ${countdown} seconds...`;
            }
            countdown--;

            if (countdown < 0) {
                clearInterval(countdownTimer);
                if (modal.style.display === 'flex') {
                    console.log('游戏结束弹窗自动关闭，开始新游戏');
                    hideGameOverModal();
                    setTimeout(() => {
                        restartGame();
                    }, 500);
                }
            }
        }

        // 立即更新一次
        updateCountdown();

        // 每秒更新倒计时
        countdownTimer = setInterval(updateCountdown, 1000);
    };
}

function setupEventListeners() {
    // 重启游戏按钮（原开始游戏按钮）
    document.getElementById('start-btn').addEventListener('click', async () => {
        // 显示确认对话框
        const confirmed = confirm('Are you sure you want to restart the game? Current progress will be lost.');
        if (!confirmed) {
            return;
        }

        // 停止当前游戏
        if (tetrisGame.gameRunning) {
            tetrisGame.gameRunning = false;
            if (tetrisGame.gameLoop) {
                clearInterval(tetrisGame.gameLoop);
                tetrisGame.gameLoop = null;
            }
        }

        // 重置并开始新游戏
        tetrisGame.reset();
        startGameAutomatically();
    });

    // 暂停游戏按钮
    document.getElementById('pause-btn').addEventListener('click', () => {
        tetrisGame.pause();
        isPausedByCamera = false; // User manually paused, clear camera pause flag
        updateButtonStates();
    });

    // 启动摄像头按钮
    document.getElementById('camera-btn').addEventListener('click', async () => {
        const button = document.getElementById('camera-btn');

        if (!handControl.isActive) {
            button.textContent = 'Starting...';
            button.disabled = true;

            try {
                await handControl.startCamera();
                button.textContent = 'Stop Camera';
                button.disabled = false;
                console.log('Hand gesture camera control activated');

                // 摄像头启动成功，等待校准完成后再启动游戏
                console.log('Camera started successfully, waiting for calibration to complete before starting game');
            } catch (error) {
                button.textContent = 'Start Camera';
                button.disabled = false;
                console.error('Hand gesture camera startup failed:', error);
            }
        } else {
            handControl.stop();
            button.textContent = 'Start Camera';
            console.log('手势控制摄像头已停止');
        }
    });
}

function setupKeyboardControls() {
    document.addEventListener('keydown', (event) => {
        if (!tetrisGame.gameRunning) return;

        switch (event.key) {
            case 'ArrowLeft':
                tetrisGame.movePiece(-1, 0);
                event.preventDefault();
                break;
            case 'ArrowRight':
                tetrisGame.movePiece(1, 0);
                event.preventDefault();
                break;
            case 'ArrowDown':
                tetrisGame.movePiece(0, 1);
                event.preventDefault();
                break;
            case 'ArrowUp':
            case ' ':
                tetrisGame.rotatePiece();
                event.preventDefault();
                break;
            case 'p':
            case 'P':
                tetrisGame.pause();
                updateButtonStates();
                event.preventDefault();
                break;
        }
    });
}

// 自动启动游戏函数
async function startGameAutomatically() {
    const gameInstance = window.tetrisGame || tetrisGame;

    if (!gameInstance) {
        console.error('tetrisGame instance not found');
        return;
    }

    if (gameInstance.gameRunning) {
        console.log('Game already running, skipping auto-start');
        return;
    }

    try {
        // 确保音频上下文已激活
        const audioContext = getAudioContext();
        if (audioContext && audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
                console.log('Audio context activated');
            } catch (err) {
                console.log('Audio context activation failed:', err);
            }
        }

        console.log('Auto-starting HandTris game');
        
        // 确保画布尺寸正确
        adjustCanvasSize();
        gameInstance.updateBlockSize();
        
        gameInstance.start();
        isPausedByCamera = false; // Game started manually, clear camera pause flag

        const updateFunc = window.updateButtonStates || updateButtonStates;
        if (updateFunc) {
            updateFunc();
        }

        // 延迟一点确保游戏状态已更新，然后尝试播放BGM
        setTimeout(() => {
            if (window.bgmControl && window.bgmControl.isOn && !window.bgmControl.isPlaying) {
                console.log('Auto-starting game, trying to play BGM');
                window.bgmControl.start();
            }
        }, 100);
    } catch (error) {
        console.error('Auto-start HandTris game failed:', error);
    }
}

function updateButtonStates() {
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');

    if (tetrisGame.gameRunning) {
        startBtn.textContent = 'Restart Game';
        startBtn.disabled = false;
        pauseBtn.textContent = 'Pause';
        pauseBtn.disabled = false;
    } else if (tetrisGame.gameLoop) {
        startBtn.textContent = 'Restart Game';
        startBtn.disabled = false;
        pauseBtn.textContent = 'Paused';
        pauseBtn.disabled = false;
    } else {
        startBtn.textContent = 'Restart Game';
        startBtn.disabled = false;
        pauseBtn.textContent = 'Pause';
        pauseBtn.disabled = true;
    }
}

// 音效系统设置
function setupAudioSystem() {
    if (!tetrisGame) {
        console.log('游戏未初始化，跳过音效设置');
        return;
    }

    try {
        // 用户交互后才能创建音频上下文
        document.addEventListener('click', createAudioFiles, { once: true });
        console.log('音效系统已设置');
    } catch (error) {
        console.error('音效系统设置失败:', error);
    }
}

// 全局音频上下文管理器
let globalAudioContext = null;

function getAudioContext() {
    if (!globalAudioContext) {
        globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // 确保音频上下文处于运行状态
    if (globalAudioContext.state === 'suspended') {
        globalAudioContext.resume().catch(e => {
            console.warn('音频上下文恢复失败:', e);
        });
    }

    return globalAudioContext;
}

// 创建音效文件 (使用Web Audio API生成)
function createAudioFiles() {
    if (!tetrisGame) return;

    try {
        const audioContext = getAudioContext();
        
        // 确保音频上下文激活
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('Audio context activated for sound effects');
                // If BGM controller exists and should play, start BGM
                if (window.bgmControl && window.bgmControl.isOn && !window.bgmControl.isPlaying) {
                    setTimeout(() => {
                        window.bgmControl.start();
                    }, 100);
                }
            });
        }

        // 生成移动音效
        function createMoveSound() {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);

            // 清理资源
            oscillator.onended = () => {
                gainNode.disconnect();
            };
        }

        // 生成旋转音效
        function createRotateSound() {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);

            // 清理资源
            oscillator.onended = () => {
                gainNode.disconnect();
            };
        }

        // 生成消行音效
        function createLineClearSound() {
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();

                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);

                    oscillator.frequency.setValueAtTime(400 + i * 100, audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.2);

                    // 清理资源
                    oscillator.onended = () => {
                        gainNode.disconnect();
                    };
                }, i * 50);
            }
        }

        // 生成TETRIS特殊音效（四行消除）
        function createTetrisSound() {
            const frequencies = [523, 659, 784, 1047]; // C5, E5, G5, C6
            frequencies.forEach((freq, i) => {
                setTimeout(() => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();

                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);

                    oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.5);

                    // 清理资源
                    oscillator.onended = () => {
                        gainNode.disconnect();
                    };
                }, i * 100);
            });
        }

        // 生成方块固定音效（清脆的"咔"声）
        function createPieceLockSound() {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.type = 'triangle'; // 三角波产生清脆但不刺耳的音调
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // 高频开始
            oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.08); // 快速下降
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.08);

            // 清理资源
            oscillator.onended = () => {
                gainNode.disconnect();
            };
        }

        // 生成游戏结束音效
        function createGameOverSound() {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 1);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 1);

            // 清理资源
            oscillator.onended = () => {
                gainNode.disconnect();
            };
        }

        // 替换原有的音效播放函数
        const originalPlaySound = tetrisGame.playSound;
        tetrisGame.playSound = function (soundName) {
            try {
                switch (soundName) {
                    case 'move':
                        createMoveSound();
                        break;
                    case 'rotate':
                        createRotateSound();
                        break;
                    case 'lineClear':
                        createLineClearSound();
                        break;
                    case 'tetris':
                        createTetrisSound();
                        break;
                    case 'gameOver':
                        createGameOverSound();
                        break;
                    case 'pieceLock':
                        createPieceLockSound();
                        break;
                }
            } catch (error) {
                console.log('音效播放失败:', error);
            }
        };

        console.log('音效系统初始化完成');

        // Create background music
        createBackgroundMusic();

    } catch (error) {
        console.error('音效系统初始化失败:', error);
    }
}

// 创建背景音乐
function createBackgroundMusic() {
    // BGM 控制器
    window.bgmControl = {
        isOn: true,
        audioContext: null,
        oscillators: [],
        gainNode: null,
        isPlaying: false,
        melodyTimeout: null,

        init() {
            try {
                this.audioContext = getAudioContext();
                this.gainNode = this.audioContext.createGain();
                this.gainNode.connect(this.audioContext.destination);
                this.gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                console.log('BGM initialized');
            } catch (error) {
                console.log('BGM init failed:', error);
            }
        },

        start() {
            if (!this.isOn) return;

            try {
                if (!this.audioContext || !this.gainNode) {
                    this.init();
                }

                // 确保音频上下文处于运行状态
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(() => {
                        console.log('Audio context resumed for BGM');
                        this.startPlaying();
                    }).catch(err => {
                        console.log('Audio context resume failed:', err);
                    });
                } else {
                    this.startPlaying();
                }
            } catch (error) {
                console.log('BGM start failed:', error);
            }
        },

        startPlaying() {
            if (this.isPlaying) return;

            this.isPlaying = true;
            this.playMelody();
            console.log('BGM started playing');
        },

        stop() {
            this.isPlaying = false;

            // 清除定时器
            if (this.melodyTimeout) {
                clearTimeout(this.melodyTimeout);
                this.melodyTimeout = null;
            }

            // 停止所有振荡器
            this.oscillators.forEach(osc => {
                try {
                    osc.stop();
                } catch (e) {
                    // Oscillator might already be stopped
                }
            });
            this.oscillators = [];
            console.log('BGM stopped');
        },

        toggle() {
            this.isOn = !this.isOn;
            console.log('BGM toggled:', this.isOn ? 'ON' : 'OFF');

            if (this.isOn) {
                this.start();
            } else {
                this.stop();
            }

            updateBGMButtonState(
                document.querySelector('button[onclick="toggleBGM()"]'),
                document.getElementById('music-indicator'),
                this.isOn
            );
        },

        playMelody() {
            if (!this.isOn || !this.isPlaying) return;

            // Tetris theme melody (simplified)
            const melody = [
                { freq: 659, duration: 0.4 },
                { freq: 494, duration: 0.2 },
                { freq: 523, duration: 0.2 },
                { freq: 587, duration: 0.4 },
                { freq: 523, duration: 0.2 },
                { freq: 494, duration: 0.2 },
                { freq: 440, duration: 0.6 },
                { freq: 440, duration: 0.2 },
                { freq: 523, duration: 0.2 },
                { freq: 659, duration: 0.4 },
                { freq: 587, duration: 0.2 },
                { freq: 523, duration: 0.2 },
                { freq: 494, duration: 0.6 },
                { freq: 494, duration: 0.2 },
                { freq: 523, duration: 0.2 },
                { freq: 587, duration: 0.4 },
                { freq: 659, duration: 0.4 },
                { freq: 523, duration: 0.4 },
                { freq: 440, duration: 0.4 },
                { freq: 440, duration: 0.6 }
            ];

            let currentTime = this.audioContext.currentTime;
            let totalDuration = 0;

            melody.forEach((note, index) => {
                if (!this.isOn || !this.isPlaying) return;

                const oscillator = this.audioContext.createOscillator();
                const noteGain = this.audioContext.createGain();

                oscillator.connect(noteGain);
                noteGain.connect(this.gainNode);

                oscillator.frequency.setValueAtTime(note.freq, currentTime);
                oscillator.type = 'square';

                noteGain.gain.setValueAtTime(0, currentTime);
                noteGain.gain.linearRampToValueAtTime(0.1, currentTime + 0.01);
                noteGain.gain.exponentialRampToValueAtTime(0.01, currentTime + note.duration);

                oscillator.start(currentTime);
                oscillator.stop(currentTime + note.duration);

                this.oscillators.push(oscillator);

                // 清理资源
                oscillator.onended = () => {
                    const index = this.oscillators.indexOf(oscillator);
                    if (index > -1) {
                        this.oscillators.splice(index, 1);
                    }
                    noteGain.disconnect();
                };

                currentTime += note.duration;
                totalDuration += note.duration;
            });

            // 循环播放
            this.melodyTimeout = setTimeout(() => {
                if (this.isOn && this.isPlaying) {
                    this.playMelody();
                }
            }, totalDuration * 1000 + 1000); // 加1秒间隔
        }
    };
}

// BGM按钮状态更新
function updateBGMButtonState(button, indicator, isOn) {
    if (!button || !indicator) return;

    if (isOn) {
        button.classList.remove('music-disabled');
        button.classList.add('music-enabled');
        indicator.textContent = '🎵';
    } else {
        button.classList.remove('music-enabled');
        button.classList.add('music-disabled');
        indicator.textContent = '🔇';
    }
}

// 初始化BGM按钮状态
function initBGMButtonState() {
    const button = document.querySelector('button[onclick="toggleBGM()"]');
    const indicator = document.getElementById('music-indicator');
    
    if (button && indicator) {
        updateBGMButtonState(button, indicator, true); // 默认开启
    }
}

// BGM切换函数
function toggleBGM() {
    if (window.bgmControl) {
        window.bgmControl.toggle();
    }
}

// 调试功能
function toggleDebug() {
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) {
        debugInfo.style.display = debugInfo.style.display === 'none' ? 'block' : 'none';
    }
}

// 画布尺寸调整函数
function adjustCanvasSize() {
    const canvas = document.getElementById('tetris-canvas');
    if (!canvas) return;

    // 让CSS处理尺寸，这里只确保画布内部分辨率正确
    const computedStyle = window.getComputedStyle(canvas);
    const displayWidth = parseInt(computedStyle.width);
    const displayHeight = parseInt(computedStyle.height);

    console.log(`Canvas display size: ${displayWidth}x${displayHeight}`);

    // 确保画布内部分辨率与显示尺寸匹配
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        console.log(`Canvas internal size updated to: ${displayWidth}x${displayHeight}`);
    }
}