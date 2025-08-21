// Hand gesture control system using MediaPipe Pose
class HandControl {
    constructor(tetrisGame, onCalibrationComplete, onGestureStatusChange) {
        this.onGestureStatusChange = onGestureStatusChange;
        this.isGestureDetected = false;
        this.lastGestureDetectionStatus = false;
        this.calibrationCompletedNotified = false;
        this.tetrisGame = tetrisGame;
        this.onCalibrationComplete = onCalibrationComplete;
        this.pose = null;
        this.camera = null;
        this.isActive = false;

        // Control parameters
        this.handRaiseThreshold = 0.12; // Hand raise detection threshold (relative to shoulder) - 降低阈值，更容易触发
        this.headShakeThreshold = 0.08; // Head shake detection threshold
        this.bothHandsVisibilityThreshold = 0.6; // Both hands visibility threshold (降低到0.6，让旋转更容易触发)
        this.handStabilityThreshold = 0.01; // Hand stability threshold for continuous movement
        this.handStabilityFrames = 5; // Frames to check for hand stability

        // Debounce parameters
        this.lastAction = '';
        this.actionCooldown = 150; // 150ms cooldown for actions - 降低冷却时间提高响应性
        this.lastActionTime = 0;

        // Hand state tracking
        this.leftHandState = 'down';
        this.rightHandState = 'down';
        this.bothHandsVisible = false;
        this.lastBothHandsVisible = false;

        // Hand stability tracking for continuous movement
        this.leftHandHistory = [];
        this.rightHandHistory = [];
        this.handHistorySize = 10;

        // Baseline position for calibration
        this.baselineLeftShoulder = null;
        this.baselineRightShoulder = null;
        this.baselineNose = null;
        this.calibrationFrames = 0;
        this.maxCalibrationFrames = 30;

        // Head shake detection for fast drop
        this.headHistory = [];
        this.headHistorySize = 20; // 增加到20帧，提高稳定性
        this.headShakeDetectionThreshold = 0.001; // 提高阈值，降低灵敏度
        this.isHeadShaking = false;
        this.consecutiveShakeFrames = 0; // 连续晃动帧数
        this.requiredShakeFrames = 12; // 需要连续12帧晃动才确认，降低误触发

        // Fast drop detection
        this.fastDropStartTime = 0;
        this.fastDropTriggerDelay = 500; // 增加到0.5秒延迟，降低误触发
        this.fastDropInterval = 80; // 80ms interval for fast drop，适中的下降速度
        this.lastFastDropTime = 0;
        this.isFastDropTriggered = false;
        this.currentPieceId = null;
        this.fastDropPieceId = null;

        // Continuous movement detection
        this.continuousMoveStartTime = 0;
        this.continuousMoveThreshold = 800; // 0.8 seconds
        this.continuousMoveInterval = 120; // 120ms interval for continuous movement
        this.lastContinuousMoveTime = 0;
        this.isInContinuousMode = false;

        // Pose detection stability tracking
        this.poseDetectionFailureCount = 0;
        this.maxFailureCount = 30; // Allow 30 consecutive failures before showing warning
        this.lastSuccessfulDetection = Date.now();

        // Detection quality assessment
        this.recentDetectionHistory = [];
        this.detectionHistorySize = 10;

        // Status display control
        this.showDetailedStatus = true;

        // Calibration complete prompt control
        this.calibrationCompleteTime = 0;
        this.showCalibrationComplete = false;

        // Debug frame counters
        this.frameCounter = 0;

        this.initMediaPipe();
    }

    async initMediaPipe() {
        try {
            this.pose = new Pose({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
                }
            });

            this.pose.setOptions({
                modelComplexity: 1, // Use medium complexity model
                smoothLandmarks: true,
                enableSegmentation: false, // Disable segmentation for better performance
                smoothSegmentation: false,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.pose.onResults(this.onResults.bind(this));

            console.log('MediaPipe Pose initialized successfully');
        } catch (error) {
            console.error('MediaPipe initialization failed:', error);

            // Show user-friendly error message
            const canvas = document.getElementById('output_canvas');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'rgba(255, 107, 107, 0.8)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.fillText('MediaPipe Error', canvas.width / 2, canvas.height / 2 - 20);
                ctx.font = '12px Arial';
                ctx.fillText('Try refreshing the page', canvas.width / 2, canvas.height / 2 + 10);
            }
        }
    }

    async startCamera() {
        try {
            const video = document.getElementById('input_video');
            const canvas = document.getElementById('output_canvas');

            // Reset calibration state
            this.resetCalibration();

            // Use camera with higher resolution for better pose detection
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 640,
                    height: 480,
                    frameRate: { ideal: 30, max: 30 }
                }
            });

            video.srcObject = stream;
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;

            // Wait for video to load
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play().then(resolve);
                };
            });

            // Monitor video stream status
            video.addEventListener('ended', () => {
                console.warn('Video stream ended unexpectedly');
                this.handleStreamInterruption();
            });

            video.addEventListener('error', (e) => {
                console.error('Video stream error:', e);
                this.handleStreamInterruption();
            });

            // Create MediaPipe Camera
            this.camera = new Camera(video, {
                onFrame: async () => {
                    try {
                        if (this.pose && video.readyState === 4 && !video.paused && !video.ended) {
                            await this.pose.send({ image: video });
                        } else if (video.readyState !== 4) {
                            console.warn('Video not ready, readyState:', video.readyState);
                        }
                    } catch (error) {
                        console.error('Frame processing error:', error);
                    }
                },
                width: 640,
                height: 480
            });

            await this.camera.start();
            this.isActive = true;
            console.log('Camera started successfully for hand gesture detection');

            // Display initial status
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#4ecdc4';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const line1 = 'Camera started';
            const line2 = 'Waiting for pose detection...';
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            ctx.fillText(line1, centerX, centerY - 15);
            ctx.fillText(line2, centerX, centerY + 15);

        } catch (error) {
            console.error('Camera startup failed:', error);
            let errorMessage = 'Cannot access camera';

            if (error.name === 'NotAllowedError') {
                errorMessage = 'Camera permission denied, please check browser settings';
            } else if (error.name === 'NotReadableError') {
                errorMessage = 'Camera is in use by another application';
            }

            alert(errorMessage);
            throw error;
        }
    }

    onResults(results) {
        try {
            // 调试：确认onResults被调用
            if (!this.frameCounter) this.frameCounter = 0;
            if (this.frameCounter % 120 === 0) {
                console.log(`🎬 onResults 被调用，帧数: ${this.frameCounter}`);
            }

            const canvas = document.getElementById('output_canvas');
            const ctx = canvas.getContext('2d');

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw video frame
            if (results.image) {
                try {
                    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
                } catch (webglError) {
                    console.warn('WebGL drawing error, using fallback:', webglError);
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
            }

            if (results.poseLandmarks && results.poseLandmarks.length > 0) {
                // Pose detected successfully
                this.poseDetectionFailureCount = 0;
                this.lastSuccessfulDetection = Date.now();
                this.isGestureDetected = true;
                const landmarks = results.poseLandmarks;

                // Draw pose landmarks
                this.drawPoseLandmarks(ctx, landmarks);

                // Update detection history
                this.recentDetectionHistory.push(true);
                if (this.recentDetectionHistory.length > this.detectionHistorySize) {
                    this.recentDetectionHistory.shift();
                }

                // Calibrate baseline position
                if (this.calibrationFrames < this.maxCalibrationFrames) {
                    this.calibrateBaseline(landmarks);
                    this.calibrationFrames++;

                    // Display calibration progress
                    this.drawCalibrationProgress(ctx);
                    return;
                }

                // Display calibration complete status
                const now = Date.now();
                if (this.showCalibrationComplete && (now - this.calibrationCompleteTime < 5000)) {
                    this.drawCalibrationComplete(ctx);
                } else if (this.showCalibrationComplete && (now - this.calibrationCompleteTime >= 5000)) {
                    this.showCalibrationComplete = false;
                }

                // Detect hand gestures
                this.detectHandGestures(landmarks);

                // Display control status
                if (this.showDetailedStatus !== false) {
                    this.drawControlStatus(ctx, landmarks);
                } else {
                    this.drawMiniStatus(ctx, landmarks);
                }

                // Debug logging
                if (this.frameCounter % 60 === 0) {
                    const successRate = this.recentDetectionHistory.filter(x => x).length / this.recentDetectionHistory.length;
                    console.log(`[姿态检测] 成功检测到姿态，地标点数: ${landmarks.length}，最近成功率: ${(successRate * 100).toFixed(1)}%`);
                }
            } else {
                // No pose detected
                this.poseDetectionFailureCount++;

                // Update detection history
                this.recentDetectionHistory.push(false);
                if (this.recentDetectionHistory.length > this.detectionHistorySize) {
                    this.recentDetectionHistory.shift();
                }

                // Debug logging
                if (this.poseDetectionFailureCount % 30 === 0) {
                    const successRate = this.recentDetectionHistory.filter(x => x).length / this.recentDetectionHistory.length;
                    console.log(`[姿态检测] 连续检测失败 ${this.poseDetectionFailureCount} 帧，最近成功率: ${(successRate * 100).toFixed(1)}%`);
                }

                // Smart detection logic
                const recentSuccessRate = this.recentDetectionHistory.length > 0 ?
                    this.recentDetectionHistory.filter(x => x).length / this.recentDetectionHistory.length : 0;

                if (this.poseDetectionFailureCount >= this.maxFailureCount && recentSuccessRate < 0.2) {
                    this.isGestureDetected = false;

                    // Draw warning message
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    ctx.fillStyle = '#ff6b6b';
                    ctx.font = 'bold 18px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    const timeSinceLastDetection = Date.now() - this.lastSuccessfulDetection;
                    if (timeSinceLastDetection > 3000) {
                        ctx.fillText('Pose detection lost', canvas.width / 2, canvas.height / 2 - 10);
                        ctx.font = '12px Arial';
                        ctx.fillText('Please stand in front of camera', canvas.width / 2, canvas.height / 2 + 15);
                    } else {
                        ctx.fillText('Please face the camera', canvas.width / 2, canvas.height / 2);
                    }
                }
            }

            // Check if status changed and notify
            if (this.isGestureDetected !== this.lastGestureDetectionStatus) {
                this.lastGestureDetectionStatus = this.isGestureDetected;
                if (this.onGestureStatusChange) {
                    this.onGestureStatusChange(this.isGestureDetected);
                }
            }

            this.frameCounter++;
        } catch (error) {
            console.error('onResults processing error:', error);
            this.poseDetectionFailureCount++;

            if (this.poseDetectionFailureCount > 50) {
                console.warn('Too many processing errors, attempting camera restart...');
                this.poseDetectionFailureCount = 0;
                this.restartCamera();
            }
        }
    }

    calibrateBaseline(landmarks) {
        try {
            // Get key landmarks for calibration
            const leftShoulder = landmarks[11]; // Left shoulder
            const rightShoulder = landmarks[12]; // Right shoulder
            const nose = landmarks[0]; // Nose

            if (!leftShoulder || !rightShoulder || !nose) {
                return;
            }

            if (!this.baselineLeftShoulder) {
                this.baselineLeftShoulder = { x: 0, y: 0, z: 0 };
                this.baselineRightShoulder = { x: 0, y: 0, z: 0 };
                this.baselineNose = { x: 0, y: 0, z: 0 };
            }

            this.baselineLeftShoulder.x += leftShoulder.x;
            this.baselineLeftShoulder.y += leftShoulder.y;
            this.baselineLeftShoulder.z += leftShoulder.z;

            this.baselineRightShoulder.x += rightShoulder.x;
            this.baselineRightShoulder.y += rightShoulder.y;
            this.baselineRightShoulder.z += rightShoulder.z;

            this.baselineNose.x += nose.x;
            this.baselineNose.y += nose.y;
            this.baselineNose.z += nose.z;

            if (this.calibrationFrames === this.maxCalibrationFrames - 1) {
                this.baselineLeftShoulder.x /= this.maxCalibrationFrames;
                this.baselineLeftShoulder.y /= this.maxCalibrationFrames;
                this.baselineLeftShoulder.z /= this.maxCalibrationFrames;

                this.baselineRightShoulder.x /= this.maxCalibrationFrames;
                this.baselineRightShoulder.y /= this.maxCalibrationFrames;
                this.baselineRightShoulder.z /= this.maxCalibrationFrames;

                this.baselineNose.x /= this.maxCalibrationFrames;
                this.baselineNose.y /= this.maxCalibrationFrames;
                this.baselineNose.z /= this.maxCalibrationFrames;

                // Record calibration completion time
                this.calibrationCompleteTime = Date.now();
                this.showCalibrationComplete = true;

                console.log('Hand gesture calibration complete!');
                console.log('控制方式: 头部晃动=快速下降, 双手出现=旋转, 单手举起=移动');

                if (this.onCalibrationComplete) {
                    this.onCalibrationComplete();
                    this.calibrationCompletedNotified = true;
                }
            }
        } catch (error) {
            console.error('Calibration process error:', error);
        }
    }

    resetCalibration() {
        this.calibrationFrames = 0;
        this.baselineLeftShoulder = null;
        this.baselineRightShoulder = null;
        this.baselineNose = null;
        this.leftHandState = 'down';
        this.rightHandState = 'down';
        this.bothHandsVisible = false;
        this.lastBothHandsVisible = false;
        this.lastLeftHandState = 'down';
        this.lastRightHandState = 'down';
        this.continuousMoveStartTime = 0;
        this.isInContinuousMode = false;
        this.isFastDropTriggered = false;
        this.fastDropStartTime = 0;
        this.currentPieceId = null;
        this.fastDropPieceId = null;
        this.lastAction = '';
        this.lastActionTime = 0;

        // 重置头部晃动检测
        this.headHistory = [];
        this.isHeadShaking = false;
        this.consecutiveShakeFrames = 0;

        // 重置手部历史
        this.leftHandHistory = [];
        this.rightHandHistory = [];

        // Reset calibration complete prompt
        this.calibrationCompleteTime = 0;
        this.showCalibrationComplete = false;

        // Reset detection status
        this.isGestureDetected = false;
        this.lastGestureDetectionStatus = false;
        this.calibrationCompletedNotified = false;
        this.poseDetectionFailureCount = 0;
        this.lastSuccessfulDetection = Date.now();
        this.recentDetectionHistory = [];

        // Reset debug counters
        this.frameCounter = 0;
    }

    detectHandGestures(landmarks) {
        if (!this.baselineLeftShoulder || !this.baselineRightShoulder || !this.baselineNose) {
            return;
        }

        const now = Date.now();
        if (now - this.lastActionTime < this.actionCooldown) {
            // 每60帧输出一次冷却状态，避免刷屏
            if (this.frameCounter % 60 === 0) {
                console.log(`⏳ 动作冷却中: ${now - this.lastActionTime}ms / ${this.actionCooldown}ms`);
            }
            return;
        }

        try {
            // Get key landmarks
            const leftWrist = landmarks[15]; // Left wrist
            const rightWrist = landmarks[16]; // Right wrist
            const leftShoulder = landmarks[11]; // Left shoulder
            const rightShoulder = landmarks[12]; // Right shoulder
            const nose = landmarks[0]; // Nose

            if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder || !nose) {
                if (this.frameCounter % 60 === 0) {
                    console.log(`❌ 关键地标点缺失: 左手腕=${!!leftWrist}, 右手腕=${!!rightWrist}, 左肩=${!!leftShoulder}, 右肩=${!!rightShoulder}, 鼻子=${!!nose}`);
                }
                return;
            }

            // 1. 头部晃动检测 - 用于快速下降
            this.updateHeadHistory(nose);
            this.detectHeadShake();

            // 调试：检查游戏状态
            if (this.frameCounter % 60 === 0) {
                console.log(`🎮 游戏状态: 运行=${this.tetrisGame.gameRunning}, 当前方块=${this.tetrisGame.currentPiece ? 'YES' : 'NO'}`);
            }

            // 2. 双手可见性检测 - 用于旋转（必须同时出现）
            const isLeftHandVisible = leftWrist.visibility > this.bothHandsVisibilityThreshold;
            const isRightHandVisible = rightWrist.visibility > this.bothHandsVisibilityThreshold;

            // 额外检查：确保双手都在画面合理位置（放宽边缘限制）
            const isLeftHandInFrame = leftWrist.x > 0.05 && leftWrist.x < 0.95 && leftWrist.y > 0.05 && leftWrist.y < 0.95;
            const isRightHandInFrame = rightWrist.x > 0.05 && rightWrist.x < 0.95 && rightWrist.y > 0.05 && rightWrist.y < 0.95;

            // 双手必须同时可见且都在画面内（放宽条件）
            const areBothHandsVisible = isLeftHandVisible && isRightHandVisible && isLeftHandInFrame && isRightHandInFrame;

            // 调试信息
            if (this.frameCounter % 30 === 0) {
                console.log(`👐 双手状态: 左手可见=${isLeftHandVisible}(${leftWrist.visibility.toFixed(2)}), 右手可见=${isRightHandVisible}(${rightWrist.visibility.toFixed(2)}), 双手可见=${areBothHandsVisible}`);
                console.log(`📍 手部位置: 左手(${leftWrist.x.toFixed(2)}, ${leftWrist.y.toFixed(2)}), 右手(${rightWrist.x.toFixed(2)}, ${rightWrist.y.toFixed(2)})`);
                console.log(`✋ 手部状态: 左手=${this.leftHandState}, 右手=${this.rightHandState}`);
                console.log(`🔄 旋转检测: 双手举起=${areBothHandsUp}, 高度差=${handHeightDifference.toFixed(3)}, 应旋转=${shouldRotate}`);
                console.log(`🎯 旋转条件详情: 可见性阈值=${this.bothHandsVisibilityThreshold}, 举起阈值=${this.handRaiseThreshold}, 高度差限制=${maxHeightDifference}`);
            }

            // 3. 单手举起检测和稳定性检测 - 用于左右移动
            const leftHandRelativeY = leftShoulder.y - leftWrist.y;
            const rightHandRelativeY = rightShoulder.y - rightWrist.y;
            const isLeftHandUp = leftHandRelativeY > this.handRaiseThreshold;
            const isRightHandUp = rightHandRelativeY > this.handRaiseThreshold;

            // 调试手部举起检测
            if (this.frameCounter % 30 === 0) {
                console.log(`✋ 手部举起检测: 左手相对高度=${leftHandRelativeY.toFixed(3)} (阈值${this.handRaiseThreshold}), 右手相对高度=${rightHandRelativeY.toFixed(3)}`);
                console.log(`✋ 举起状态: 左手=${isLeftHandUp}, 右手=${isRightHandUp}`);
            }

            // 更新手部位置历史（用于稳定性检测）
            this.updateHandHistory(leftWrist, rightWrist);

            this.leftHandState = isLeftHandUp ? 'up' : 'down';
            this.rightHandState = isRightHandUp ? 'up' : 'down';

            // 新增：检查双手是否都举起且高度相近（用于旋转）- 进一步放宽条件
            const areBothHandsUp = isLeftHandUp && isRightHandUp;
            const handHeightDifference = Math.abs(leftHandRelativeY - rightHandRelativeY);
            const maxHeightDifference = 0.35; // 双手高度差不超过35%屏幕高度，进一步放宽条件
            const areBothHandsSimilarHeight = handHeightDifference <= maxHeightDifference;

            // 旋转条件：双手可见 + 双手举起（移除高度相近限制，让旋转更容易触发）
            const shouldRotate = areBothHandsVisible && areBothHandsUp;

            // 确保双手真正同时满足旋转条件（从不满足到满足的状态变化）
            const bothHandsJustAppeared = shouldRotate && !this.bothHandsVisible;
            this.bothHandsVisible = shouldRotate;

            let action = '';

            // Track current piece ID and reset fast drop for new pieces
            if (this.tetrisGame.currentPiece && this.currentPieceId !== this.tetrisGame.currentPiece.id) {
                const oldPieceId = this.currentPieceId;
                this.currentPieceId = this.tetrisGame.currentPiece.id;

                // 新方块出现时重置快速下降状态
                if (this.isFastDropTriggered && this.fastDropPieceId === oldPieceId) {
                    console.log(`🔄 新方块出现 (${this.currentPieceId})，重置快速下降状态`);
                    this.isFastDropTriggered = false;
                    this.fastDropPieceId = null;
                    this.fastDropStartTime = 0;
                }
            }

            // 头部晃动 -> 快速下降
            if (this.isHeadShaking) {
                console.log('🤯 头部正在晃动！');
                if (!this.isFastDropTriggered) {
                    if (this.fastDropStartTime === 0) {
                        this.fastDropStartTime = now;
                        console.log('🚀 检测到头部晃动，开始快速下降计时...');
                    } else {
                        const elapsed = now - this.fastDropStartTime;
                        console.log(`⏱️ 快速下降计时中: ${elapsed}ms / ${this.fastDropTriggerDelay}ms`);

                        if (elapsed >= this.fastDropTriggerDelay) {
                            // 简化条件：不管游戏状态，先测试触发逻辑
                            console.log('🎯 时间到！尝试触发快速下降...');

                            if (this.tetrisGame && this.tetrisGame.currentPiece) {
                                const currentPieceId = this.tetrisGame.currentPiece.id;
                                console.log(`🎮 游戏状态: 运行=${this.tetrisGame.gameRunning}, 方块ID=${currentPieceId}`);

                                if (currentPieceId && currentPieceId !== this.fastDropPieceId) {
                                    this.isFastDropTriggered = true;
                                    this.fastDropPieceId = currentPieceId;
                                    this.lastFastDropTime = 0;
                                    console.log(`🎯 头部晃动触发快速下降！方块ID: ${currentPieceId}`);
                                } else {
                                    console.log(`⚠️ 方块ID重复或无效: 当前=${currentPieceId}, 已触发=${this.fastDropPieceId}`);
                                }
                            } else {
                                console.log('❌ 游戏或方块不存在');
                            }
                        }
                    }
                }
            } else {
                // 头部停止晃动，重置检测和停止快速下降
                if (this.fastDropStartTime > 0 || this.isFastDropTriggered) {
                    console.log('⏹️ 头部停止晃动，停止快速下降');
                    this.isFastDropTriggered = false;
                    this.fastDropPieceId = null;
                }
                this.fastDropStartTime = 0;
            }

            // 执行快速下降
            if (this.isFastDropTriggered && this.tetrisGame.gameRunning) {
                const currentPieceId = this.tetrisGame.currentPiece ? this.tetrisGame.currentPiece.id : null;
                console.log(`💨 快速下降执行中: 方块ID=${currentPieceId}, 目标ID=${this.fastDropPieceId}, 间隔=${now - this.lastFastDropTime}ms`);

                if (currentPieceId === this.fastDropPieceId && now - this.lastFastDropTime >= this.fastDropInterval) {
                    if (this.tetrisGame.movePiece(0, 1)) {
                        this.lastFastDropTime = now;
                        console.log('⬇️ 快速下降：方块下移一格');
                    } else {
                        // 方块触底，结束快速下降
                        this.isFastDropTriggered = false;
                        this.fastDropPieceId = null;
                        console.log('🛑 快速下降结束 - 方块触底');
                    }
                }
            } else if (this.isFastDropTriggered) {
                console.log(`⚠️ 快速下降被阻止: 游戏运行=${this.tetrisGame.gameRunning}`);
            }

            // 双手举起且高度相近 -> 旋转（优先级最高，阻止其他手势）
            if (bothHandsJustAppeared) {
                action = 'rotate';
                console.log(`🔄 检测到双手举起，执行旋转 (高度差: ${handHeightDifference.toFixed(3)})`);
            }
            // 简化测试：暂时忽略双手可见性检查，直接检测单手移动
            // TODO: 这是临时的调试代码，后续需要恢复双手可见性检查
            // 只有在不满足旋转条件时才检测单手移动
            if (!shouldRotate) {
                console.log(`🔍 不满足旋转条件，检查单手移动: 左手=${this.leftHandState}, 右手=${this.rightHandState}, 上次左手=${this.lastLeftHandState}, 上次右手=${this.lastRightHandState}`);

                // 左手举起 -> 向左移动（确保右手放下）
                if (this.leftHandState === 'up' && this.lastLeftHandState !== 'up' && this.rightHandState === 'down') {
                    action = 'left';
                    this.continuousMoveStartTime = now;
                    this.isInContinuousMode = false;
                    console.log('✅ 检测到左手举起，向左移动');
                }
                // 右手举起 -> 向右移动（确保左手放下）
                else if (this.rightHandState === 'up' && this.lastRightHandState !== 'up' && this.leftHandState === 'down') {
                    action = 'right';
                    this.continuousMoveStartTime = now;
                    this.isInContinuousMode = false;
                    console.log('✅ 检测到右手举起，向右移动');
                }
            } else {
                // 满足旋转条件时，阻止单手移动
                if (this.frameCounter % 30 === 0) {
                    console.log(`�双 满足旋转条件，阻止单手移动`);
                }
            }

            // 持续举手 -> 连续移动（只有在不满足旋转条件且手部稳定时才执行）
            if (!shouldRotate) {
                if (this.leftHandState === 'up' && this.lastLeftHandState === 'up' && this.rightHandState === 'down') {
                    const holdTime = now - this.continuousMoveStartTime;
                    const isLeftHandStable = this.isHandStable('left');

                    if (holdTime >= this.continuousMoveThreshold && !this.isInContinuousMode && isLeftHandStable) {
                        this.isInContinuousMode = true;
                        this.lastContinuousMoveTime = now;
                        action = 'left';
                        console.log('🔄 左手稳定，开始连续向左移动');
                    } else if (this.isInContinuousMode && now - this.lastContinuousMoveTime >= this.continuousMoveInterval && isLeftHandStable) {
                        action = 'left';
                        this.lastContinuousMoveTime = now;
                    } else if (this.isInContinuousMode && !isLeftHandStable) {
                        console.log('⏹️ 左手不稳定，停止连续移动');
                        this.isInContinuousMode = false;
                        this.continuousMoveStartTime = 0;
                    }
                }
                else if (this.rightHandState === 'up' && this.lastRightHandState === 'up' && this.leftHandState === 'down') {
                    const holdTime = now - this.continuousMoveStartTime;
                    const isRightHandStable = this.isHandStable('right');

                    if (holdTime >= this.continuousMoveThreshold && !this.isInContinuousMode && isRightHandStable) {
                        this.isInContinuousMode = true;
                        this.lastContinuousMoveTime = now;
                        action = 'right';
                        console.log('🔄 右手稳定，开始连续向右移动');
                    } else if (this.isInContinuousMode && now - this.lastContinuousMoveTime >= this.continuousMoveInterval && isRightHandStable) {
                        action = 'right';
                        this.lastContinuousMoveTime = now;
                    } else if (this.isInContinuousMode && !isRightHandStable) {
                        console.log('⏹️ 右手不稳定，停止连续移动');
                        this.isInContinuousMode = false;
                        this.continuousMoveStartTime = 0;
                    }
                }
                // 双手放下 -> 停止连续移动
                else if (this.leftHandState === 'down' && this.rightHandState === 'down') {
                    if (this.isInContinuousMode) {
                        console.log('双手放下，停止连续移动');
                    }
                    this.continuousMoveStartTime = 0;
                    this.isInContinuousMode = false;
                }
            } else {
                // 双手可见时，停止连续移动
                if (this.isInContinuousMode) {
                    console.log('双手可见，停止连续移动');
                    this.isInContinuousMode = false;
                    this.continuousMoveStartTime = 0;
                }
            }

            // 更新状态
            this.lastBothHandsVisible = this.bothHandsVisible;
            this.lastLeftHandState = this.leftHandState;
            this.lastRightHandState = this.rightHandState;

            // 执行动作
            if (action) {
                console.log(`🎯 检测到动作: ${action}`);
                const isContinuousMove = this.isInContinuousMode;
                const shouldExecute = action === 'rotate' || action !== this.lastAction || isContinuousMove;
                console.log(`🔍 动作执行检查: 动作=${action}, 上次动作=${this.lastAction}, 连续模式=${isContinuousMove}, 应该执行=${shouldExecute}`);

                if (shouldExecute) {
                    this.executeAction(action);

                    // 只对非连续动作应用冷却时间
                    if (!isContinuousMove) {
                        this.lastAction = action;
                        this.lastActionTime = now;

                        setTimeout(() => {
                            this.lastAction = '';
                        }, this.actionCooldown);
                    }
                } else {
                    console.log(`⏸️ 动作被跳过: ${action}`);
                }
            } else {
                // 每60帧输出一次"无动作"状态，避免刷屏
                if (this.frameCounter % 60 === 0) {
                    console.log(`⭕ 当前无动作检测到`);
                }
            }
        } catch (error) {
            console.error('Hand gesture detection error:', error);
        }
    }

    updateHeadHistory(nose) {
        // 调试：检查nose对象结构
        if (this.frameCounter % 60 === 0) {
            console.log(`👃 鼻子位置: x=${nose.x?.toFixed(4)}, y=${nose.y?.toFixed(4)}, visibility=${nose.visibility?.toFixed(4)}`);
        }

        // 添加当前头部位置到历史记录
        this.headHistory.push({
            x: nose.x,
            y: nose.y,
            timestamp: Date.now()
        });

        // 保持历史记录大小
        if (this.headHistory.length > this.headHistorySize) {
            this.headHistory.shift();
        }

        // 调试：显示历史记录长度
        if (this.frameCounter % 30 === 0) {
            console.log(`📊 头部历史记录: ${this.headHistory.length}/${this.headHistorySize} 帧`);
        }
    }

    updateHandHistory(leftWrist, rightWrist) {
        // 更新左手历史
        this.leftHandHistory.push({
            x: leftWrist.x,
            y: leftWrist.y,
            timestamp: Date.now()
        });
        if (this.leftHandHistory.length > this.handHistorySize) {
            this.leftHandHistory.shift();
        }

        // 更新右手历史
        this.rightHandHistory.push({
            x: rightWrist.x,
            y: rightWrist.y,
            timestamp: Date.now()
        });
        if (this.rightHandHistory.length > this.handHistorySize) {
            this.rightHandHistory.shift();
        }
    }

    isHandStable(hand) {
        const history = hand === 'left' ? this.leftHandHistory : this.rightHandHistory;

        if (history.length < this.handStabilityFrames) {
            return false;
        }

        // 检查最近几帧的手部位置稳定性
        const recentFrames = history.slice(-this.handStabilityFrames);
        const xPositions = recentFrames.map(pos => pos.x);
        const yPositions = recentFrames.map(pos => pos.y);

        // 计算位置方差
        const xVariance = this.calculateVariance(xPositions);
        const yVariance = this.calculateVariance(yPositions);

        // 手部稳定：位置方差小于阈值
        const isStable = xVariance < this.handStabilityThreshold && yVariance < this.handStabilityThreshold;

        // 调试信息
        if (this.frameCounter % 60 === 0) {
            console.log(`✋ ${hand}手稳定性: x方差=${xVariance.toFixed(6)}, y方差=${yVariance.toFixed(6)}, 稳定=${isStable}`);
        }

        return isStable;
    }

    detectHeadShake() {
        if (this.headHistory.length < this.headHistorySize) {
            this.isHeadShaking = false;
            this.consecutiveShakeFrames = 0;
            return;
        }

        // 使用更直观的方法：计算头部水平移动的范围
        const xPositions = this.headHistory.map(pos => pos.x);
        const minX = Math.min(...xPositions);
        const maxX = Math.max(...xPositions);
        const xRange = maxX - minX;

        // 同时计算方差作为参考
        const xVariance = this.calculateVariance(xPositions);

        // 使用更严格的检测条件，确保连续晃动
        const rangeThreshold = 0.08; // 提高到8%屏幕宽度，大幅降低灵敏度
        const varianceThreshold = 0.001; // 大幅提高方差阈值，减少误触发

        // 检查当前帧是否满足晃动条件
        const isCurrentFrameShaking = xRange > rangeThreshold && xVariance > varianceThreshold;

        // 连续性检测：需要连续多帧都满足条件
        if (isCurrentFrameShaking) {
            this.consecutiveShakeFrames++;
        } else {
            this.consecutiveShakeFrames = 0; // 重置连续计数
        }

        // 只有连续晃动足够帧数才确认为真正的晃动
        const wasShaking = this.isHeadShaking;
        this.isHeadShaking = this.consecutiveShakeFrames >= this.requiredShakeFrames;

        // 增强调试信息 - 每10帧输出一次
        if (this.frameCounter % 10 === 0) {
            console.log(`🤯 头部晃动: 范围=${(xRange * 100).toFixed(2)}% (阈值8%), 方差=${xVariance.toFixed(6)} (阈值0.001), 连续=${this.consecutiveShakeFrames}/${this.requiredShakeFrames}帧, 状态=${this.isHeadShaking ? '晃动中' : '静止'}`);
        }

        // 状态变化时立即输出
        if (this.isHeadShaking !== wasShaking) {
            console.log(`🎯 头部晃动状态变化: ${wasShaking ? '停止' : '开始'}晃动 (连续${this.consecutiveShakeFrames}帧, 范围: ${(xRange * 100).toFixed(2)}%, 方差: ${xVariance.toFixed(6)})`);
        }
    }

    calculateVariance(values) {
        if (values.length === 0) return 0;

        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    }

    executeAction(action) {
        console.log(`🎮 尝试执行动作: ${action}, 游戏运行状态: ${this.tetrisGame.gameRunning}`);

        if (!this.tetrisGame.gameRunning) {
            console.log('❌ 游戏未运行，动作被阻止');
            return;
        }

        console.log(`✅ 执行动作: ${action}`);
        switch (action) {
            case 'left':
                const leftResult = this.tetrisGame.movePiece(-1, 0);
                console.log(`⬅️ 左移结果: ${leftResult}`);
                break;
            case 'right':
                const rightResult = this.tetrisGame.movePiece(1, 0);
                console.log(`➡️ 右移结果: ${rightResult}`);
                break;
            case 'rotate':
                this.tetrisGame.rotatePiece();
                console.log('🔄 执行旋转');
                break;
        }
    }

    resetDropSpeed() {
        // Reset fast drop state when piece is placed
        this.isFastDropTriggered = false;
        this.fastDropPieceId = null;
        this.fastDropStartTime = 0;
        console.log('方块放置，重置快速下降状态');
    }

    drawPoseLandmarks(ctx, landmarks) {
        // Draw key pose landmarks
        ctx.fillStyle = '#00ff00';
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;

        // Draw key points
        const keyPoints = [0, 11, 12, 15, 16]; // Nose, shoulders, wrists
        keyPoints.forEach(index => {
            if (landmarks[index]) {
                const point = landmarks[index];
                ctx.beginPath();
                ctx.arc(point.x * ctx.canvas.width, point.y * ctx.canvas.height, 5, 0, 2 * Math.PI);
                ctx.fill();
            }
        });

        // Draw connections
        const connections = [
            [11, 12], // Shoulders
            [11, 15], // Left shoulder to left wrist
            [12, 16], // Right shoulder to right wrist
        ];

        connections.forEach(([start, end]) => {
            if (landmarks[start] && landmarks[end]) {
                const startPoint = landmarks[start];
                const endPoint = landmarks[end];
                ctx.beginPath();
                ctx.moveTo(startPoint.x * ctx.canvas.width, startPoint.y * ctx.canvas.height);
                ctx.lineTo(endPoint.x * ctx.canvas.width, endPoint.y * ctx.canvas.height);
                ctx.stroke();
            }
        });
    }

    drawCalibrationProgress(ctx) {
        const progress = this.calibrationFrames / this.maxCalibrationFrames;
        const centerX = ctx.canvas.width / 2;
        const centerY = ctx.canvas.height / 2;

        // Draw progress bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(centerX - 100, centerY - 30, 200, 60);

        ctx.fillStyle = '#4ecdc4';
        ctx.fillRect(centerX - 90, centerY - 10, 180 * progress, 20);

        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(centerX - 90, centerY - 10, 180, 20);

        // Draw text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Calibrating...', centerX, centerY - 15);
        ctx.font = '12px Arial';
        ctx.fillText(`${Math.round(progress * 100)}%`, centerX, centerY + 25);
    }

    drawCalibrationComplete(ctx) {
        const centerX = ctx.canvas.width / 2;
        const centerY = ctx.canvas.height / 2;

        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.fillRect(centerX - 100, centerY - 30, 200, 60);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Calibration Complete!', centerX, centerY);
    }

    drawControlStatus(ctx, landmarks) {
        const statusY = 30;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 300, 180);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Hand Gesture Status:', 20, statusY);

        ctx.font = '12px Arial';
        const leftStable = this.isHandStable('left');
        const rightStable = this.isHandStable('right');

        ctx.fillStyle = this.leftHandState === 'up' ? '#00ff00' : '#ffffff';
        ctx.fillText(`Left Hand: ${this.leftHandState} ${leftStable ? '(stable)' : '(moving)'}`, 20, statusY + 20);

        ctx.fillStyle = this.rightHandState === 'up' ? '#00ff00' : '#ffffff';
        ctx.fillText(`Right Hand: ${this.rightHandState} ${rightStable ? '(stable)' : '(moving)'}`, 20, statusY + 40);

        ctx.fillStyle = this.bothHandsVisible ? '#00ff00' : '#ffffff';
        ctx.fillText(`Both Hands Visible: ${this.bothHandsVisible ? 'YES' : 'NO'}`, 20, statusY + 60);

        ctx.fillStyle = this.isHeadShaking ? '#ffff00' : '#ffffff';
        ctx.fillText(`Head Shaking: ${this.isHeadShaking ? 'YES' : 'NO'} (${this.consecutiveShakeFrames}/${this.requiredShakeFrames})`, 20, statusY + 80);

        ctx.fillStyle = this.isFastDropTriggered ? '#ff0000' : '#ffffff';
        ctx.fillText(`Fast Drop: ${this.isFastDropTriggered ? 'ACTIVE' : 'inactive'}`, 20, statusY + 100);

        ctx.fillStyle = this.isInContinuousMode ? '#ffff00' : '#ffffff';
        ctx.fillText(`Continuous: ${this.isInContinuousMode ? 'ACTIVE' : 'inactive'}`, 20, statusY + 120);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Current Piece: ${this.currentPieceId || 'none'}`, 20, statusY + 140);
        ctx.fillText(`Fast Drop Piece: ${this.fastDropPieceId || 'none'}`, 20, statusY + 160);
    }

    drawMiniStatus(ctx, landmarks) {
        const statusY = 30;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 150, 80);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Gesture Control', 20, statusY);

        ctx.font = '10px Arial';
        let status = 'Ready';
        let color = '#4ecdc4';

        if (this.isFastDropTriggered) {
            status = 'Fast Drop';
            color = '#ff0000';
        } else if (this.isHeadShaking) {
            status = 'Head Shaking';
            color = '#ffff00';
        } else if (this.isInContinuousMode) {
            status = 'Continuous Move';
            color = '#ffff00';
        } else if (this.bothHandsVisible) {
            status = 'Both Hands';
            color = '#00ff00';
        } else if (this.leftHandState === 'up') {
            status = 'Left Hand';
            color = '#00ff00';
        } else if (this.rightHandState === 'up') {
            status = 'Right Hand';
            color = '#00ff00';
        }

        ctx.fillStyle = color;
        ctx.fillText(status, 20, statusY + 20);

        // 显示控制提示
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px Arial';
        ctx.fillText('Shake head: Fast drop', 20, statusY + 40);
        ctx.fillText('Show both hands: Rotate', 20, statusY + 50);
        ctx.fillText('Raise hand: Move', 20, statusY + 60);
    }

    handleStreamInterruption() {
        console.warn('Camera stream interrupted, attempting restart...');
        setTimeout(() => {
            this.restartCamera();
        }, 1000);
    }

    async restartCamera() {
        try {
            if (this.camera) {
                this.camera.stop();
            }
            await this.startCamera();
            console.log('Camera restarted successfully');
        } catch (error) {
            console.error('Camera restart failed:', error);
        }
    }

    stop() {
        this.isActive = false;
        if (this.camera) {
            this.camera.stop();
        }
        console.log('Hand gesture control stopped');
    }
}