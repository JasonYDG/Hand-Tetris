// 俄罗斯方块游戏逻辑
class TetrisGame {
    constructor() {
        this.canvas = document.getElementById('tetris-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.nextCanvas = document.getElementById('next-canvas');
        this.nextCtx = this.nextCanvas ? this.nextCanvas.getContext('2d') : null;
        
        // 调试信息
        console.log('TetrisGame constructor:');
        console.log('- tetris-canvas:', this.canvas);
        console.log('- next-canvas:', this.nextCanvas);
        console.log('- tetris ctx:', this.ctx);
        console.log('- next ctx:', this.nextCtx);
        
        this.BOARD_WIDTH = 10;
        this.BOARD_HEIGHT = 20;
        this.BLOCK_SIZE = 0; // Will be calculated dynamically
        
        this.board = [];
        this.currentPiece = null;
        this.nextPiece = null;
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.gameRunning = false;
        this.gameLoop = null;
        this.dropTime = 0;
        this.dropInterval = 800; // 0.8秒，等级1的初始速度（降低速度，更适合新手）
        
        // 方块落地回调
        this.onPiecePlaced = null;
        
        // 智能方块生成系统
        this.pieceHistory = []; // 记录最近生成的方块
        this.maxHistoryLength = 5; // 记录最近5个方块
        this.iPieceCount = 0; // I型方块计数
        this.totalPieceCount = 0; // 总方块计数
        this.targetIRatio = 0.35; // 目标I型方块比例 (35%)
        this.lastIPieceIndex = -10; // 上次I型方块的索引
        this.forceIPieceAfter = 6; // 强制生成I型方块的最大间隔
        
        this.initBoard();
        this.generateNextPiece();
        this.spawnPiece();
        this.updateBlockSize(); // Call here after canvas is initialized
        
        // 音效 - 现在使用Web Audio API，保留引用用于兼容性
        this.sounds = {
            move: null, // 使用Web Audio API
            rotate: null, // 使用Web Audio API
            lineClear: null, // 使用Web Audio API
            tetris: null, // 使用Web Audio API
            gameOver: null, // 使用Web Audio API
            pieceLock: null, // 使用Web Audio API
            background: null // 使用Web Audio API
        };
    }
    
    initBoard() {
        this.board = Array(this.BOARD_HEIGHT).fill().map(() => Array(this.BOARD_WIDTH).fill(0));
    }
    
    // 俄罗斯方块形状定义
    pieces = {
        I: {
            shape: [
                [1, 1, 1, 1]
            ],
            color: '#00f5ff'
        },
        O: {
            shape: [
                [1, 1],
                [1, 1]
            ],
            color: '#ffff00'
        },
        T: {
            shape: [
                [0, 1, 0],
                [1, 1, 1]
            ],
            color: '#800080'
        },
        S: {
            shape: [
                [0, 1, 1],
                [1, 1, 0]
            ],
            color: '#00ff00'
        },
        Z: {
            shape: [
                [1, 1, 0],
                [0, 1, 1]
            ],
            color: '#ff0000'
        },
        J: {
            shape: [
                [1, 0, 0],
                [1, 1, 1]
            ],
            color: '#0000ff'
        },
        L: {
            shape: [
                [0, 0, 1],
                [1, 1, 1]
            ],
            color: '#ffa500'
        }
    };
    
    generateNextPiece() {
        const pieceTypes = Object.keys(this.pieces);
        let selectedType;
        
        // 计算当前I型方块比例
        const currentIRatio = this.totalPieceCount > 0 ? this.iPieceCount / this.totalPieceCount : 0;
        
        // 检查距离上次I型方块的间隔
        const gapSinceLastI = this.totalPieceCount - this.lastIPieceIndex;
        
        // 检查最近的方块历史中是否有I型
        const recentIPieces = this.pieceHistory.filter(type => type === 'I').length;
        const lastTwoPieces = this.pieceHistory.slice(-2);
        const hasConsecutiveI = lastTwoPieces.length === 2 && lastTwoPieces.every(type => type === 'I');
        
        // 决策逻辑
        if (hasConsecutiveI) {
            // 避免连续3个I型方块
            const nonIPieces = pieceTypes.filter(type => type !== 'I');
            selectedType = nonIPieces[Math.floor(Math.random() * nonIPieces.length)];
            console.log('避免连续I型方块');
        } else if (gapSinceLastI >= this.forceIPieceAfter) {
            // 如果超过6个方块没有I型，强制生成
            selectedType = 'I';
            console.log(`强制生成I型方块 - 间隔过长: ${gapSinceLastI}`);
        } else if (currentIRatio < this.targetIRatio && this.totalPieceCount >= 3 && gapSinceLastI >= 2) {
            // 如果比例不足且间隔足够，优先生成I型
            const shouldGenerateI = Math.random() < 0.8; // 80%概率
            if (shouldGenerateI) {
                selectedType = 'I';
                console.log(`优先生成I型方块 - 当前比例: ${(currentIRatio * 100).toFixed(1)}%`);
            } else {
                selectedType = this.getRandomNonIPiece(pieceTypes);
            }
        } else {
            // 正常随机生成，给I型方块更高权重
            const weights = this.calculatePieceWeights(pieceTypes, currentIRatio, gapSinceLastI);
            selectedType = this.selectWeightedPiece(pieceTypes, weights);
        }
        
        // 更新统计信息
        this.totalPieceCount++;
        if (selectedType === 'I') {
            this.iPieceCount++;
            this.lastIPieceIndex = this.totalPieceCount;
        }
        
        // 更新历史记录
        this.pieceHistory.push(selectedType);
        if (this.pieceHistory.length > this.maxHistoryLength) {
            this.pieceHistory.shift();
        }
        
        this.nextPiece = {
            type: selectedType,
            shape: this.pieces[selectedType].shape,
            color: this.pieces[selectedType].color,
            x: 0,
            y: 0
        };
        
        // 调试信息
        if (this.totalPieceCount % 5 === 0) {
            const ratio = (this.iPieceCount / this.totalPieceCount * 100).toFixed(1);
            console.log(`方块统计 - 总数: ${this.totalPieceCount}, I型: ${this.iPieceCount} (${ratio}%), 间隔: ${gapSinceLastI}`);
        }
    }
    
    getRandomNonIPiece(pieceTypes) {
        const nonIPieces = pieceTypes.filter(type => type !== 'I');
        return nonIPieces[Math.floor(Math.random() * nonIPieces.length)];
    }
    
    calculatePieceWeights(pieceTypes, currentIRatio, gapSinceLastI) {
        const weights = {};
        
        pieceTypes.forEach(type => {
            if (type === 'I') {
                // I型方块权重基于当前比例和间隔
                let weight = 2; // 基础权重提高到2
                if (currentIRatio < this.targetIRatio) {
                    weight += 2; // 比例不足时增加更多权重
                }
                if (gapSinceLastI >= 3) {
                    weight += 2; // 间隔较长时增加更多权重
                }
                if (gapSinceLastI >= 5) {
                    weight += 3; // 间隔很长时大幅增加权重
                }
                weights[type] = weight;
            } else {
                weights[type] = 1; // 其他方块基础权重
            }
        });
        
        return weights;
    }
    
    selectWeightedPiece(pieceTypes, weights) {
        const weightedArray = [];
        
        pieceTypes.forEach(type => {
            const weight = weights[type] || 1;
            for (let i = 0; i < weight; i++) {
                weightedArray.push(type);
            }
        });
        
        return weightedArray[Math.floor(Math.random() * weightedArray.length)];
    }
    
    spawnPiece() {
        if (this.nextPiece) {
            this.currentPiece = {
                ...this.nextPiece,
                x: Math.floor(this.BOARD_WIDTH / 2) - Math.floor(this.nextPiece.shape[0].length / 2),
                y: 0,
                id: Date.now() + Math.random() // Add unique ID for each piece
            };
            this.generateNextPiece();
            
            // 检查游戏结束
            if (this.checkCollision(this.currentPiece, 0, 0)) {
                this.gameOver();
            }
        }
    }
    
    checkCollision(piece, dx, dy) {
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const newX = piece.x + x + dx;
                    const newY = piece.y + y + dy;
                    
                    if (newX < 0 || newX >= this.BOARD_WIDTH || 
                        newY >= this.BOARD_HEIGHT ||
                        (newY >= 0 && this.board[newY][newX])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    movePiece(dx, dy) {
        if (!this.currentPiece || !this.gameRunning) return false;
        
        if (!this.checkCollision(this.currentPiece, dx, dy)) {
            this.currentPiece.x += dx;
            this.currentPiece.y += dy;
            this.playSound('move');
            
            // 如果是水平移动，检查方块是否应该立即固定
            if (dx !== 0 && this.checkCollision(this.currentPiece, 0, 1)) {
                // 检查是否在快速下降状态下
                const isAccelerating = window.headControl && window.headControl.isHeadLiftTriggered;
                if (isAccelerating) {
                    // 快速下降状态下立即固定方块
                    console.log('快速下降状态下方块触底，立即固定');
                    this.dropTime = this.dropInterval; // 立即触发下降检查
                } else {
                    // 正常状态下减少缓冲时间
                    this.dropTime = Math.max(this.dropTime, this.dropInterval - 200); // 减少200ms缓冲时间
                }
            }
            
            return true;
        }
        return false;
    }
    
    rotatePiece() {
        if (!this.currentPiece || !this.gameRunning) return;
        
        const rotated = this.rotateMatrix(this.currentPiece.shape);
        const originalShape = this.currentPiece.shape;
        const originalX = this.currentPiece.x;
        const originalY = this.currentPiece.y;
        
        // 尝试旋转
        this.currentPiece.shape = rotated;
        
        // I型方块需要特殊的中心旋转处理
        if (this.currentPiece.type === 'I') {
            this.adjustIPieceRotationCenter(originalShape, rotated);
        }
        
        // 如果直接旋转成功，完成旋转
        if (!this.checkCollision(this.currentPiece, 0, 0)) {
            this.playSound('rotate');
            
            // 检查旋转后方块是否应该立即固定
            if (this.checkCollision(this.currentPiece, 0, 1)) {
                // 检查是否在快速下降状态下
                const isAccelerating = window.headControl && window.headControl.isHeadLiftTriggered;
                if (isAccelerating) {
                    // 快速下降状态下立即固定方块
                    console.log('快速下降状态下旋转后触底，立即固定');
                    this.dropTime = this.dropInterval; // 立即触发下降检查
                } else {
                    // 正常状态下减少缓冲时间
                    this.dropTime = Math.max(this.dropTime, this.dropInterval - 200); // 减少200ms缓冲时间
                }
            }
            
            return;
        }
        
        // 如果直接旋转失败，尝试踢墙算法
        const kickOffsets = this.getWallKickOffsets(this.currentPiece.type, originalShape, rotated);
        
        // 调试信息（只在开发模式下显示）
        if (Math.random() < 0.1) { // 10%概率显示调试信息，避免日志过多
            console.log(`尝试旋转 ${this.currentPiece.type} 方块，原位置: (${originalX}, ${originalY})`);
        }
        
        for (let i = 0; i < kickOffsets.length; i++) {
            const offset = kickOffsets[i];
            this.currentPiece.x = originalX + offset.x;
            this.currentPiece.y = originalY + offset.y;
            
            if (!this.checkCollision(this.currentPiece, 0, 0)) {
                // 踢墙成功，完成旋转
                this.playSound('rotate');
                if (Math.random() < 0.1 && (offset.x !== 0 || offset.y !== 0)) {
                    console.log(`踢墙成功: ${this.currentPiece.type} 方块偏移(${offset.x}, ${offset.y}) - 尝试 ${i + 1}/${kickOffsets.length}`);
                }
                
                // 检查踢墙后方块是否应该立即固定
                if (this.checkCollision(this.currentPiece, 0, 1)) {
                    // 检查是否在快速下降状态下
                    const isAccelerating = window.headControl && window.headControl.isHeadLiftTriggered;
                    if (isAccelerating) {
                        // 快速下降状态下立即固定方块
                        console.log('快速下降状态下踢墙后触底，立即固定');
                        this.dropTime = this.dropInterval; // 立即触发下降检查
                    } else {
                        // 正常状态下减少缓冲时间
                        this.dropTime = Math.max(this.dropTime, this.dropInterval - 200); // 减少200ms缓冲时间
                    }
                }
                
                return;
            }
        }
        
        // 最后尝试：强制旋转到最接近的可用位置
        const emergencyOffsets = this.getEmergencyOffsets(originalX, originalY);
        for (const offset of emergencyOffsets) {
            this.currentPiece.x = originalX + offset.x;
            this.currentPiece.y = originalY + offset.y;
            
            if (!this.checkCollision(this.currentPiece, 0, 0)) {
                this.playSound('rotate');
                console.log(`紧急旋转成功: ${this.currentPiece.type} 方块偏移(${offset.x}, ${offset.y})`);
                
                // 检查紧急旋转后方块是否应该立即固定
                if (this.checkCollision(this.currentPiece, 0, 1)) {
                    // 检查是否在快速下降状态下
                    const isAccelerating = window.headControl && window.headControl.isHeadLiftTriggered;
                    if (isAccelerating) {
                        // 快速下降状态下立即固定方块
                        console.log('快速下降状态下紧急旋转后触底，立即固定');
                        this.dropTime = this.dropInterval; // 立即触发下降检查
                    } else {
                        // 正常状态下减少缓冲时间
                        this.dropTime = Math.max(this.dropTime, this.dropInterval - 200); // 减少200ms缓冲时间
                    }
                }
                
                return;
            }
        }
        
        // 所有尝试都失败，恢复原状
        this.currentPiece.shape = originalShape;
        this.currentPiece.x = originalX;
        this.currentPiece.y = originalY;
        
        // 只在调试模式下显示失败信息
        if (Math.random() < 0.1) {
            console.log(`旋转完全失败：${this.currentPiece.type} 方块无法找到任何合适的位置`);
        }
    }
    
    rotateMatrix(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const rotated = Array(cols).fill().map(() => Array(rows).fill(0));
        
        // 90度顺时针旋转
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                rotated[x][rows - 1 - y] = matrix[y][x];
            }
        }
        
        // 调试信息：显示旋转前后的形状
        if (this.currentPiece && this.currentPiece.type === 'I') {
            console.log('I型方块旋转矩阵:');
            console.log('原形状:', matrix);
            console.log('旋转后:', rotated);
        }
        
        return rotated;
    }
    
    // 获取踢墙偏移量
    getWallKickOffsets(pieceType, originalShape, rotatedShape) {
        // I型方块需要特殊处理
        if (pieceType === 'I') {
            return this.getIWallKickOffsets(originalShape, rotatedShape);
        }
        
        // O型方块不需要踢墙（正方形）
        if (pieceType === 'O') {
            return [{ x: 0, y: 0 }];
        }
        
        // 其他方块的通用踢墙算法
        return this.getStandardWallKickOffsets(originalShape, rotatedShape);
    }
    
    // 标准方块的踢墙偏移量 - 优化版本，减少向左偏移
    getStandardWallKickOffsets(originalShape, rotatedShape) {
        // 基于SRS（Super Rotation System）的踢墙算法，优化偏移顺序
        const offsets = [
            { x: 0, y: 0 },   // 原位置
            { x: 1, y: 0 },   // 优先右移1格
            { x: -1, y: 0 },  // 左移1格
            { x: 0, y: -1 },  // 上移1格
            { x: 1, y: -1 },  // 右上移
            { x: -1, y: -1 }, // 左上移
            { x: 2, y: 0 },   // 右移2格
            { x: 1, y: 1 },   // 右下移
            { x: 0, y: -2 },  // 上移2格
            { x: 2, y: -1 },  // 右移2格上移1格
            { x: 1, y: -2 },  // 右移1格上移2格
            { x: -1, y: 1 },  // 左下移
            { x: -2, y: 0 },  // 左移2格（降低优先级）
            { x: -1, y: -2 }, // 左移1格上移2格
            { x: -2, y: -1 }, // 左移2格上移1格
            { x: 3, y: 0 },   // 右移3格（极端情况）
            { x: 2, y: -2 },  // 右移2格上移2格
            { x: 0, y: -3 },  // 上移3格（极端情况）
            { x: -2, y: -2 }, // 左移2格上移2格（最后尝试）
            { x: -3, y: 0 },  // 左移3格（最后尝试）
        ];
        
        return offsets;
    }
    
    // I型方块的特殊踢墙算法 - 基于中心旋转的优化版本，减少左移
    getIWallKickOffsets(originalShape, rotatedShape) {
        const originalIsHorizontal = originalShape.length === 1; // 原来是水平状态
        
        if (originalIsHorizontal) {
            // 从水平变为垂直 - 优先向右和向上尝试，减少向左偏移
            return [
                { x: 0, y: 0 },   // 原位置（已调整中心）
                { x: 1, y: 0 },   // 优先右移1格
                { x: 0, y: -1 },  // 上移1格
                { x: 1, y: -1 },  // 右移1格上移1格
                { x: 2, y: 0 },   // 右移2格
                { x: 0, y: -2 },  // 上移2格
                { x: 1, y: 1 },   // 右移1格下移1格
                { x: 0, y: 1 },   // 下移1格
                { x: -1, y: 0 },  // 左移1格（降低优先级）
                { x: -1, y: -1 }, // 左移1格上移1格（最后尝试）
                { x: -1, y: 1 },  // 左移1格下移1格（最后尝试）
            ];
        } else {
            // 从垂直变为水平 - 优先向右和向下尝试，减少向左偏移
            return [
                { x: 0, y: 0 },   // 原位置（已调整中心）
                { x: 1, y: 0 },   // 优先右移1格
                { x: 0, y: 1 },   // 下移1格
                { x: 1, y: 1 },   // 右移1格下移1格
                { x: 2, y: 0 },   // 右移2格
                { x: 0, y: 2 },   // 下移2格
                { x: 1, y: -1 },  // 右移1格上移1格
                { x: 0, y: -1 },  // 上移1格
                { x: -1, y: 0 },  // 左移1格（降低优先级）
                { x: -1, y: 1 },  // 左移1格下移1格（最后尝试）
                { x: -1, y: -1 }, // 左移1格上移1格（最后尝试）
            ];
        }
    }
    
    // 紧急情况下的偏移量 - 优化版本，减少向左偏移
    getEmergencyOffsets(originalX, originalY) {
        const offsets = [];
        
        // 基于当前位置生成更智能的偏移
        const centerX = Math.floor(this.BOARD_WIDTH / 2);
        const distanceFromCenter = originalX - centerX;
        const rightBoundary = this.BOARD_WIDTH - 1;
        
        // 如果在左边，优先向右移动
        if (distanceFromCenter < 0) {
            for (let x = 1; x <= Math.min(4, rightBoundary - originalX); x++) {
                for (let y = -2; y <= 1; y++) {
                    offsets.push({ x, y });
                }
            }
        }
        // 如果在右边，限制向左移动距离，特别是长条方块
        else if (distanceFromCenter > 0) {
            // 检查是否是长条方块（I型）
            const isIPiece = this.currentPiece && this.currentPiece.type === 'I';
            const maxLeftMove = isIPiece ? Math.min(2, originalX) : Math.min(3, originalX); // I型方块最多左移2格
            
            for (let x = -1; x >= -maxLeftMove; x--) {
                for (let y = -2; y <= 1; y++) {
                    offsets.push({ x, y });
                }
            }
        }
        // 如果在中间，优先向右移动
        else {
            // 先尝试向右移动
            for (let x = 1; x <= 3; x++) {
                for (let y = -3; y <= 2; y++) {
                    offsets.push({ x, y });
                }
            }
            // 再尝试向左移动，但限制距离
            const isIPiece = this.currentPiece && this.currentPiece.type === 'I';
            const maxLeftMove = isIPiece ? 2 : 3; // I型方块限制左移距离
            
            for (let x = -1; x >= -maxLeftMove; x--) {
                for (let y = -3; y <= 2; y++) {
                    offsets.push({ x, y });
                }
            }
        }
        
        return offsets;
    }
    
    // 增强的碰撞检测，支持边界检查优化
    checkCollisionEnhanced(piece, dx, dy) {
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const newX = piece.x + x + dx;
                    const newY = piece.y + y + dy;
                    
                    // 检查边界
                    if (newX < 0 || newX >= this.BOARD_WIDTH || newY >= this.BOARD_HEIGHT) {
                        return true;
                    }
                    
                    // 检查与已放置方块的碰撞（允许在顶部边界之上）
                    if (newY >= 0 && this.board[newY][newX]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    dropPiece() {
        if (!this.movePiece(0, 1)) {
            this.placePiece();
            this.clearLines();
            
            // 通知方块已落地，重置加速状态（在生成新方块之前）
            if (this.onPiecePlaced) {
                this.onPiecePlaced();
            }
            
            this.spawnPiece();
        }
    }
    
    placePiece() {
        for (let y = 0; y < this.currentPiece.shape.length; y++) {
            for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                if (this.currentPiece.shape[y][x]) {
                    const boardY = this.currentPiece.y + y;
                    const boardX = this.currentPiece.x + x;
                    if (boardY >= 0) {
                        this.board[boardY][boardX] = this.currentPiece.color;
                    }
                }
            }
        }
        
        // 播放方块固定音效
        this.playSound('pieceLock');
        console.log('Piece locked, playing lock sound effect');
    }
    
    clearLines() {
        let linesCleared = 0;
        
        for (let y = this.BOARD_HEIGHT - 1; y >= 0; y--) {
            if (this.board[y].every(cell => cell !== 0)) {
                this.board.splice(y, 1);
                this.board.unshift(Array(this.BOARD_WIDTH).fill(0));
                linesCleared++;
                y++; // 重新检查同一行
            }
        }
        
        if (linesCleared > 0) {
            this.lines += linesCleared;
            
            // 新的积分规则：1行=100分，2行=300分，3行=600分，4行=1000分
            let scoreToAdd = 0;
            switch (linesCleared) {
                case 1:
                    scoreToAdd = 100;
                    break;
                case 2:
                    scoreToAdd = 300;
                    break;
                case 3:
                    scoreToAdd = 600;
                    break;
                case 4:
                    scoreToAdd = 1000;
                    break;
                default:
                    scoreToAdd = linesCleared * 100; // 超过4行的情况（理论上不会发生）
            }
            
            // 等级加成
            this.score += scoreToAdd * this.level;
            this.level = Math.floor(this.lines / 10) + 1;
            // 降低初始速度，更适合新手：从800ms开始
            this.dropInterval = Math.max(120, 800 - (this.level - 1) * 60);
            
            // 播放不同的消行音效
            this.playLineClearSound(linesCleared);
            this.updateScore();
            
            // 显示得分提示
            this.showScorePopup(scoreToAdd * this.level, linesCleared);
        }
    }
    
    updateScore() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        document.getElementById('lines').textContent = this.lines;
    }
    
    // New method to update BLOCK_SIZE based on canvas dimensions
    updateBlockSize() {
        if (this.canvas && this.BOARD_WIDTH && this.BOARD_HEIGHT) {
            // 获取CSS设置的显示尺寸
            const displayWidth = this.canvas.clientWidth;
            const displayHeight = this.canvas.clientHeight;
            
            console.log(`Canvas display size: ${displayWidth}x${displayHeight}`);
            
            // 计算方块尺寸（基于宽度，确保正确的比例）
            this.BLOCK_SIZE = Math.floor(displayWidth / this.BOARD_WIDTH);
            
            // 设置canvas内部绘制尺寸（保持正确的游戏比例）
            this.canvas.width = this.BLOCK_SIZE * this.BOARD_WIDTH;
            this.canvas.height = this.BLOCK_SIZE * this.BOARD_HEIGHT;
            
            console.log(`Canvas internal size: ${this.canvas.width}x${this.canvas.height}, block size: ${this.BLOCK_SIZE}`);
        }
    }

    draw() {
        if (!this.ctx || !this.canvas) {
            console.error('Canvas or context not available for drawing');
            return;
        }
        this.updateBlockSize(); // Ensure BLOCK_SIZE is updated before drawing
        
        console.log('Drawing game, canvas size:', this.canvas.width, 'x', this.canvas.height);
        
        // 清空画布
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制网格
        this.drawGrid();
        
        // 绘制已放置的方块
        this.drawBoard();
        
        // 绘制当前方块
        if (this.currentPiece) {
            this.drawPiece(this.currentPiece, this.ctx);
        }
        
        // 绘制下一个方块
        this.drawNextPiece();
        
        console.log('Draw completed');
    }
    
    drawGrid() {
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x <= this.BOARD_WIDTH; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.BLOCK_SIZE, 0);
            this.ctx.lineTo(x * this.BLOCK_SIZE, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.BOARD_HEIGHT; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.BLOCK_SIZE);
            this.ctx.lineTo(this.canvas.width, y * this.BLOCK_SIZE);
            this.ctx.stroke();
        }
    }
    
    drawBoard() {
        for (let y = 0; y < this.BOARD_HEIGHT; y++) {
            for (let x = 0; x < this.BOARD_WIDTH; x++) {
                if (this.board[y][x]) {
                    // Pass boardX, boardY, and total board dimensions
                    this.drawBlock(x * this.BLOCK_SIZE, y * this.BLOCK_SIZE, this.board[y][x], this.ctx, x, y, this.BOARD_WIDTH, this.BOARD_HEIGHT);
                }
            }
        }
    }
    
    drawPiece(piece, context) {
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const drawX = (piece.x + x) * this.BLOCK_SIZE;
                    const drawY = (piece.y + y) * this.BLOCK_SIZE;
                    // Pass boardX, boardY, and total board dimensions
                    this.drawBlock(drawX, drawY, piece.color, context, piece.x + x, piece.y + y, this.BOARD_WIDTH, this.BOARD_HEIGHT);
                }
            }
        }
    }
    
    // 简化的方块绘制函数（用于Next预览，无圆角）
    drawSimpleBlock(x, y, color, context, blockSize) {
        const borderOffset = blockSize / 30;
        const innerOffset = blockSize * (2/30);
        const shadowOffset = blockSize * (3/30);
        const highlightThickness = blockSize * (2/30);
        
        // 绘制主体方块（矩形，无圆角）
        context.fillStyle = color;
        context.fillRect(x + borderOffset, y + borderOffset, blockSize - innerOffset, blockSize - innerOffset);
        
        // 绘制高光效果（顶部和左侧）
        context.fillStyle = this.lightenColor(color, 0.2);
        context.fillRect(x + borderOffset, y + borderOffset, blockSize - innerOffset, highlightThickness);
        context.fillRect(x + borderOffset, y + borderOffset, highlightThickness, blockSize - innerOffset);
        
        // 绘制阴影效果（底部和右侧）
        context.fillStyle = this.darkenColor(color, 0.2);
        context.fillRect(x + blockSize - shadowOffset, y + borderOffset, highlightThickness, blockSize - innerOffset);
        context.fillRect(x + borderOffset, y + blockSize - shadowOffset, blockSize - innerOffset, highlightThickness);
    }

    drawBlock(x, y, color, context, boardX, boardY, boardWidth, boardHeight) {
        const borderOffset = this.BLOCK_SIZE / 30;
        const innerOffset = this.BLOCK_SIZE * (2/30);
        const shadowOffset = this.BLOCK_SIZE * (3/30);
        const highlightThickness = this.BLOCK_SIZE * (2/30);
        
        const isBottomLeftCornerBlock = (boardX === 0 && boardY === boardHeight - 1);
        const isBottomRightCornerBlock = (boardX === boardWidth - 1 && boardY === boardHeight - 1);
        
        const cornerRadius = this.BLOCK_SIZE * (10/30); 

        // Function to draw a rounded rectangle path with individual corner control
        const drawRoundedRectPath = (ctx, x, y, width, height, radius, roundTopLeft, roundTopRight, roundBottomRight, roundBottomLeft) => {
            ctx.beginPath();
            
            // Top-left corner
            if (roundTopLeft) {
                ctx.moveTo(x + radius, y);
                ctx.arcTo(x, y, x, y + radius, radius);
            } else {
                ctx.moveTo(x, y);
            }

            // Top-right corner
            if (roundTopRight) {
                ctx.lineTo(x + width - radius, y);
                ctx.arcTo(x + width, y, x + width, y + radius, radius);
            } else {
                ctx.lineTo(x + width, y);
            }

            // Bottom-right corner
            if (roundBottomRight) {
                ctx.lineTo(x + width, y + height - radius);
                ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
            } else {
                ctx.lineTo(x + width, y + height);
            }

            // Bottom-left corner
            if (roundBottomLeft) {
                ctx.lineTo(x + radius, y + height);
                ctx.arcTo(x, y + height, x, y + height - radius, radius);
            } else {
                ctx.lineTo(x, y + height);
            }

            ctx.closePath();
        };

        // Save context state before clipping
        context.save();

        // Draw the main block body (rounded or rectangular)
        context.fillStyle = color;
        if (isBottomLeftCornerBlock) {
            drawRoundedRectPath(context, x + borderOffset, y + borderOffset, this.BLOCK_SIZE - innerOffset, this.BLOCK_SIZE - innerOffset, cornerRadius, false, false, false, true); // Only bottom-left
            context.fill();
            context.clip();
        } else if (isBottomRightCornerBlock) {
            drawRoundedRectPath(context, x + borderOffset, y + borderOffset, this.BLOCK_SIZE - innerOffset, this.BLOCK_SIZE - innerOffset, cornerRadius, false, false, true, false); // Only bottom-right
            context.fill();
            context.clip();
        } else {
            context.fillRect(x + borderOffset, y + borderOffset, this.BLOCK_SIZE - innerOffset, this.BLOCK_SIZE - innerOffset);
            context.beginPath();
            context.rect(x + borderOffset, y + borderOffset, this.BLOCK_SIZE - innerOffset, this.BLOCK_SIZE - innerOffset);
            context.clip();
        }
        
        // Draw highlight effects (now clipped to the block's shape)
        context.fillStyle = this.lightenColor(color, 0.2);
        context.fillRect(x + borderOffset, y + borderOffset, this.BLOCK_SIZE - innerOffset, highlightThickness);
        context.fillRect(x + borderOffset, y + borderOffset, highlightThickness, this.BLOCK_SIZE - innerOffset);
        
        // Draw shadow effects (now clipped to the block's shape)
        context.fillStyle = this.darkenColor(color, 0.2);
        context.fillRect(x + this.BLOCK_SIZE - shadowOffset, y + borderOffset, highlightThickness, this.BLOCK_SIZE - innerOffset);
        context.fillRect(x + borderOffset, y + this.BLOCK_SIZE - shadowOffset, this.BLOCK_SIZE - innerOffset, highlightThickness);

        // Restore context state to remove clipping
        context.restore();
    }
    
    drawNextPiece() {
        if (!this.nextCtx || !this.nextCanvas) {
            console.error('Next canvas or context not available');
            return;
        }
        
        console.log('Drawing next piece, canvas size:', this.nextCanvas.width, 'x', this.nextCanvas.height);
        
        this.nextCtx.fillStyle = '#000';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        if (this.nextPiece) {
            // 计算适合canvas的方块大小
            const canvasSize = Math.min(this.nextCanvas.width, this.nextCanvas.height);
            const pieceWidth = this.nextPiece.shape[0].length;
            const pieceHeight = this.nextPiece.shape.length;
            const maxPieceSize = Math.max(pieceWidth, pieceHeight);
            
            // 方块大小应该适合canvas，留一些边距
            const blockSize = Math.floor((canvasSize * 0.8) / maxPieceSize);
            const actualPieceWidth = pieceWidth * blockSize;
            const actualPieceHeight = pieceHeight * blockSize;
            
            // 居中显示
            const offsetX = (this.nextCanvas.width - actualPieceWidth) / 2;
            const offsetY = (this.nextCanvas.height - actualPieceHeight) / 2;
            
            // 临时保存原始BLOCK_SIZE并设置为next预览的方块大小
            const originalBlockSize = this.BLOCK_SIZE;
            this.BLOCK_SIZE = blockSize;
            
            for (let y = 0; y < this.nextPiece.shape.length; y++) {
                for (let x = 0; x < this.nextPiece.shape[y].length; x++) {
                    if (this.nextPiece.shape[y][x]) {
                        const drawX = offsetX + x * blockSize;
                        const drawY = offsetY + y * blockSize;
                        
                        // 使用简化的立体方块绘制（无圆角）
                        this.drawSimpleBlock(drawX, drawY, this.nextPiece.color, this.nextCtx, blockSize);
                    }
                }
            }
            
            // 恢复原始BLOCK_SIZE
            this.BLOCK_SIZE = originalBlockSize;
        }
    }
    
    lightenColor(color, amount) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * amount * 100);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
    
    darkenColor(color, amount) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * amount * 100);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return "#" + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
            (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
            (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
    }
    
    start() {
        this.gameRunning = true;
        // 确保画布尺寸正确
        this.updateBlockSize();
        // 移除HTML audio背景音乐控制，由Web Audio API处理
        document.body.classList.add('game-active');
        this.gameLoop = setInterval(() => {
            this.update();
            this.draw();
        }, 16); // 60 FPS
    }
    
    pause() {
        this.gameRunning = !this.gameRunning;
        // 移除HTML audio背景音乐控制，由Web Audio API处理
    }
    
    reset() {
        this.gameRunning = false;
        
        // 清除游戏循环
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
        
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropTime = 0;
        this.dropInterval = 800; // 0.8秒，等级1的初始速度（降低速度，更适合新手）
        this.initBoard();
        
        // 重置方块生成统计
        this.pieceHistory = [];
        this.iPieceCount = 0;
        this.totalPieceCount = 0;
        this.lastIPieceIndex = -10;
        
        // 通知重置下降速度（在生成新方块之前）
        if (this.onPiecePlaced) {
            this.onPiecePlaced();
        }
        
        this.generateNextPiece();
        this.spawnPiece();
        this.updateScore();
        // 移除HTML audio背景音乐控制，由Web Audio API处理
        document.body.classList.remove('game-active');
        this.draw();
    }
    
    update() {
        if (!this.gameRunning) return;
        
        this.dropTime += 16;
        if (this.dropTime >= this.dropInterval) {
            this.dropPiece();
            this.dropTime = 0;
        }
    }
    
    gameOver() {
        this.gameRunning = false;
        this.playSound('gameOver');
        // 移除HTML audio背景音乐控制，由Web Audio API处理
        document.body.classList.remove('game-active');
        
        // 清除游戏循环
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
        
        // 显示游戏结束弹窗
        if (typeof showGameOverModal === 'function') {
            showGameOverModal(this.score);
        } else {
            // 降级处理：如果弹窗函数不存在，使用原来的方式
            const gameOverDiv = document.createElement('div');
            gameOverDiv.className = 'game-over';
            gameOverDiv.innerHTML = `
                <h2>游戏结束!</h2>
                <p>最终分数: ${this.score}</p>
                <p>等级: ${this.level}</p>
                <p>Lines Cleared: ${this.lines}</p>
                <button onclick="this.parentElement.remove(); tetrisGame.reset(); updateButtonStates();">重新开始</button>
            `;
            document.body.appendChild(gameOverDiv);
            
            // 自动重置游戏
            setTimeout(() => {
                if (gameOverDiv.parentNode) {
                    gameOverDiv.parentNode.removeChild(gameOverDiv);
                }
                this.reset();
                if (typeof updateButtonStates === 'function') {
                    updateButtonStates();
                }
            }, 3000);
        }
    }
    
    playSound(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName].currentTime = 0;
            this.sounds[soundName].play().catch(error => {
                console.warn(`音效 "${soundName}" 播放失败:`, error);
            });
        }
    }
    
    // 播放不同的消行音效
    playLineClearSound(linesCleared) {
        // 根据消除行数播放不同音效
        if (linesCleared === 4) {
            this.playSound('tetris'); // 四行消除特殊音效
        } else {
            this.playSound('lineClear');
        }
    }
    
    // 显示得分弹窗
    showScorePopup(score, lines) {
        const popup = document.createElement('div');
        popup.className = 'score-popup';
        
        let message = '';
        let className = '';
        switch (lines) {
            case 1:
                message = `Single Line +${score}`;
                className = 'single';
                break;
            case 2:
                message = `Double Line +${score}`;
                className = 'double';
                break;
            case 3:
                message = `Triple Line +${score}`;
                className = 'triple';
                break;
            case 4:
                message = `TETRIS! +${score}`;
                className = 'tetris';
                break;
        }
        
        popup.innerHTML = `<span class="${className}">${message}</span>`;
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-size: 24px;
            font-weight: bold;
            z-index: 1000;
            animation: scorePopup 2s ease-out forwards;
        `;
        
        document.body.appendChild(popup);
        
        // Remove popup after 2 seconds
        setTimeout(() => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup);
            }
        }, 2000);
    }
    
    // I型方块中心旋转调整 - 基于标准SRS（Super Rotation System）
    adjustIPieceRotationCenter(originalShape, rotatedShape) {
        const originalIsHorizontal = originalShape.length === 1; // 原来是水平
        const rotatedIsHorizontal = rotatedShape.length === 1;   // 旋转后是水平
        
        console.log(`I型方块旋转: 原形状${originalShape.length}x${originalShape[0].length} → 新形状${rotatedShape.length}x${rotatedShape[0].length}`);
        console.log(`旋转前位置: (${this.currentPiece.x}, ${this.currentPiece.y})`);
        
        if (originalIsHorizontal && !rotatedIsHorizontal) {
            // 从水平 (1x4) 变为垂直 (4x1)
            // 调整以保持视觉中心不变
            this.currentPiece.x += 1;  // 向右移1格，补偿宽度变化
            this.currentPiece.y -= 1;  // 向上移1格，补偿高度变化
            console.log('I型方块：水平→垂直，中心旋转调整 (+1, -1)');
        } else if (!originalIsHorizontal && rotatedIsHorizontal) {
            // 从垂直 (4x1) 变为水平 (1x4)
            // 调整以保持视觉中心不变
            this.currentPiece.x -= 1;  // 向左移1格，补偿宽度变化
            this.currentPiece.y += 1;  // 向下移1格，补偿高度变化
            console.log('I型方块：垂直→水平，中心旋转调整 (-1, +1)');
        }
        
        console.log(`旋转后位置: (${this.currentPiece.x}, ${this.currentPiece.y})`);
    }
}