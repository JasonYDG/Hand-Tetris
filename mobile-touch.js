// 移动端触摸控制增强
class MobileTouchHandler {
    constructor() {
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        this.minSwipeDistance = 30;
        this.isTouch = false;
        this.lastTap = 0;
        this.tapTimeout = null;
        
        this.init();
    }
    
    init() {
        this.setupTouchEvents();
        this.setupMobileButtons();
        this.preventDefaultBehaviors();
        this.setupSwipeGestures();
    }
    
    setupTouchEvents() {
        const canvas = document.getElementById('tetris-canvas');
        if (!canvas) return;
        
        // 触摸开始
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
            this.isTouch = true;
            
            // 添加视觉反馈
            canvas.style.boxShadow = '0 0 30px rgba(78, 205, 196, 0.8)';
        }, { passive: false });
        
        // 触摸移动
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        // Touch end
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!this.isTouch) return;
            
            const touch = e.changedTouches[0];
            this.touchEndX = touch.clientX;
            this.touchEndY = touch.clientY;
            
            this.handleSwipe();
            this.handleTap();
            this.isTouch = false;
            
            // 移除视觉反馈
            setTimeout(() => {
                canvas.style.boxShadow = '';
            }, 200);
        }, { passive: false });
    }
    
    handleSwipe() {
        const deltaX = this.touchEndX - this.touchStartX;
        const deltaY = this.touchEndY - this.touchStartY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        
        // 判断是否为有效滑动
        if (Math.max(absDeltaX, absDeltaY) < this.minSwipeDistance) {
            return false; // 不是滑动，可能是点击
        }
        
        // 确定滑动方向
        if (absDeltaX > absDeltaY) {
            // 水平滑动
            if (deltaX > 0) {
                this.triggerGameAction('right');
            } else {
                this.triggerGameAction('left');
            }
        } else {
            // 垂直滑动
            if (deltaY > 0) {
                this.triggerGameAction('drop');
            } else {
                this.triggerGameAction('rotate');
            }
        }
        
        return true;
    }
    
    handleTap() {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - this.lastTap;
        
        if (tapLength < 300 && tapLength > 0) {
            // 双击 - 暂停游戏
            this.triggerGameAction('pause');
            clearTimeout(this.tapTimeout);
        } else {
            // 单击 - 延迟执行，等待可能的双击
            this.tapTimeout = setTimeout(() => {
                this.triggerGameAction('rotate');
            }, 300);
        }
        
        this.lastTap = currentTime;
    }
    
    setupMobileButtons() {
        const buttons = {
            'mobile-left': 'left',
            'mobile-right': 'right',
            'mobile-rotate': 'rotate',
            'mobile-drop': 'drop'
        };
        
        Object.keys(buttons).forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                // 触摸开始
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.addTouchFeedback(btn);
                    this.triggerGameAction(buttons[id]);
                }, { passive: false });
                
                // Touch end
                btn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    this.removeTouchFeedback(btn);
                }, { passive: false });
                
                // 点击事件（备用）
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.triggerGameAction(buttons[id]);
                });
            }
        });
    }
    
    addTouchFeedback(button) {
        button.classList.add('touched');
        button.style.transform = 'scale(0.9)';
        
        // 震动反馈
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }
    
    removeTouchFeedback(button) {
        button.classList.remove('touched');
        button.style.transform = 'scale(1)';
    }
    
    triggerGameAction(action) {
        // 这里需要与游戏逻辑集成
        const event = new CustomEvent('mobileGameAction', {
            detail: { action: action }
        });
        document.dispatchEvent(event);
        
        // 显示操作提示
        this.showActionFeedback(action);
    }
    
    showActionFeedback(action) {
        const feedback = document.createElement('div');
        feedback.className = 'action-feedback';
        feedback.textContent = this.getActionText(action);
        
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(78, 205, 196, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
            z-index: 2000;
            pointer-events: none;
            animation: actionFeedback 1s ease-out forwards;
        `;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 1000);
    }
    
    getActionText(action) {
        const texts = {
            'left': '← 左移',
            'right': '→ 右移',
            'rotate': '↻ 旋转',
            'drop': '↓ 下降',
            'pause': '⏸ 暂停'
        };
        return texts[action] || action;
    }
    
    preventDefaultBehaviors() {
        // 防止页面滚动
        document.body.addEventListener('touchmove', (e) => {
            if (e.target.closest('.mobile-controls') || e.target.closest('#tetris-canvas')) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // 防止双击缩放
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // 防止长按菜单
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.mobile-controls') || e.target.closest('#tetris-canvas')) {
                e.preventDefault();
            }
        });
    }
    
    setupSwipeGestures() {
        // 为整个游戏区域添加滑动手势
        const gameArea = document.querySelector('.game-board');
        if (!gameArea) return;
        
        let startX, startY;
        
        gameArea.addEventListener('touchstart', (e) => {
            if (e.target.id === 'tetris-canvas') return; // 画布已经处理了
            
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
        }, { passive: true });
        
        gameArea.addEventListener('touchend', (e) => {
            if (e.target.id === 'tetris-canvas') return;
            
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            const absDeltaX = Math.abs(deltaX);
            const absDeltaY = Math.abs(deltaY);
            
            if (Math.max(absDeltaX, absDeltaY) < this.minSwipeDistance) return;
            
            if (absDeltaX > absDeltaY) {
                this.triggerGameAction(deltaX > 0 ? 'right' : 'left');
            } else {
                this.triggerGameAction(deltaY > 0 ? 'drop' : 'rotate');
            }
        }, { passive: true });
    }
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes actionFeedback {
        0% {
            opacity: 0;
            transform: translateX(-50%) translateY(-10px) scale(0.8);
        }
        20% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1.1);
        }
        100% {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px) scale(1);
        }
    }
    
    .mobile-control-btn.touched {
        background: linear-gradient(135deg, #45b7d1, #667eea) !important;
        box-shadow: 0 0 20px rgba(69, 183, 209, 0.6) !important;
    }
    
    .mobile-control-btn.rotate.touched {
        background: linear-gradient(135deg, #ff7b42, #ff9a56) !important;
    }
    
    .mobile-control-btn.drop.touched {
        background: linear-gradient(135deg, #36d1dc, #4ecdc4) !important;
    }
`;
document.head.appendChild(style);

// 初始化移动端触摸处理
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.addEventListener('DOMContentLoaded', () => {
        new MobileTouchHandler();
    });
}

// Export class for use by other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileTouchHandler;
} else {
    window.MobileTouchHandler = MobileTouchHandler;
}