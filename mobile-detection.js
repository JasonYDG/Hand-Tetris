// 移动端检测和优化
class MobileDetection {
    constructor() {
        this.isMobile = this.detectMobile();
        this.isTablet = this.detectTablet();
        this.isIOS = this.detectIOS();
        this.isAndroid = this.detectAndroid();
        this.screenSize = this.getScreenSize();
        
        this.init();
    }
    
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ||
               window.innerWidth <= 768;
    }
    
    detectTablet() {
        return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent) ||
               (window.innerWidth > 768 && window.innerWidth <= 1024 && 'ontouchstart' in window);
    }
    
    detectIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }
    
    detectAndroid() {
        return /Android/i.test(navigator.userAgent);
    }
    
    getScreenSize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        if (width <= 480) return 'small';
        if (width <= 768) return 'medium';
        if (width <= 1024) return 'large';
        return 'desktop';
    }
    
    init() {
        this.addDeviceClasses();
        this.optimizeForDevice();
        this.setupOrientationHandling();
        this.setupViewportHandling();
        
        if (this.isMobile) {
            this.enableMobileOptimizations();
        }
    }
    
    addDeviceClasses() {
        const body = document.body;
        
        if (this.isMobile) body.classList.add('mobile-device');
        if (this.isTablet) body.classList.add('tablet-device');
        if (this.isIOS) body.classList.add('ios-device');
        if (this.isAndroid) body.classList.add('android-device');
        
        body.classList.add(`screen-${this.screenSize}`);
    }
    
    optimizeForDevice() {
        if (this.isMobile) {
            // 移动端优化
            this.optimizeCanvasSize();
            this.optimizeButtonSizes();
            this.enableTouchOptimizations();
        }
        
        if (this.isIOS) {
            // iOS特殊优化
            this.handleIOSViewport();
            this.preventIOSBounce();
        }
        
        if (this.isAndroid) {
            // Android特殊优化
            this.handleAndroidKeyboard();
        }
    }
    
    optimizeCanvasSize() {
        const canvas = document.getElementById('tetris-canvas');
        const outputCanvas = document.getElementById('output_canvas');
        const nextCanvas = document.getElementById('next-canvas');
        
        if (canvas) {
            // Get computed style to match CSS display size
            const computedStyle = getComputedStyle(canvas);
            const displayWidth = parseFloat(computedStyle.width);
            const displayHeight = parseFloat(computedStyle.height);
            
            // Set internal canvas resolution to match display size
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }
        
        if (outputCanvas) {
            const computedStyle = getComputedStyle(outputCanvas);
            const displayWidth = parseFloat(computedStyle.width);
            const displayHeight = parseFloat(computedStyle.height);
            
            outputCanvas.width = displayWidth;
            outputCanvas.height = displayHeight;
        }

        if (nextCanvas) {
            const computedStyle = getComputedStyle(nextCanvas);
            const displayWidth = parseFloat(computedStyle.width);
            const displayHeight = parseFloat(computedStyle.height);
            
            // 确保内部绘制尺寸是正方形，使用较小的尺寸
            const size = Math.min(displayWidth, displayHeight);
            nextCanvas.width = size;
            nextCanvas.height = size;
            
            console.log(`Next canvas set to: ${size}x${size} (display: ${displayWidth}x${displayHeight})`);
        }
    }
    
    optimizeButtonSizes() {
        const buttons = document.querySelectorAll('.game-controls button, .mobile-control-btn');
        const minTouchSize = this.isIOS ? 44 : 48; // iOS: 44pt, Android: 48dp
        
        buttons.forEach(button => {
            const currentHeight = parseInt(getComputedStyle(button).height);
            if (currentHeight < minTouchSize) {
                button.style.minHeight = minTouchSize + 'px';
                button.style.minWidth = minTouchSize + 'px';
            }
        });
    }
    
    enableTouchOptimizations() {
        // 禁用文本选择
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        
        // 禁用触摸高亮
        document.body.style.webkitTapHighlightColor = 'transparent';
        
        // 优化触摸延迟
        document.body.style.touchAction = 'manipulation';
    }
    
    handleIOSViewport() {
        // 处理iOS Safari的视口问题
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
                        // viewport.setAttribute('content', 
            //     'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
            // ); // 移除 user-scalable=no 和 maximum-scale=1.0 以允许缩放
        }
        
        // 隐藏地址栏
        window.addEventListener('load', () => {
            setTimeout(() => {
                window.scrollTo(0, 1);
            }, 0);
        });
        
        // 处理安全区域
        if (CSS.supports('padding: env(safe-area-inset-top)')) {
            document.documentElement.style.setProperty('--safe-area-top', 'env(safe-area-inset-top)');
            document.documentElement.style.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom)');
        }
    }
    
    preventIOSBounce() {
        // 防止iOS的弹性滚动
        document.addEventListener('touchmove', (e) => {
            if (e.target.closest('.scrollable')) return;
            e.preventDefault();
        }, { passive: false });
    }
    
    handleAndroidKeyboard() {
        // 处理Android虚拟键盘
        let initialViewportHeight = window.innerHeight;
        
        window.addEventListener('resize', () => {
            const currentHeight = window.innerHeight;
            const heightDifference = initialViewportHeight - currentHeight;
            
            if (heightDifference > 150) {
                // 键盘可能打开了
                document.body.classList.add('keyboard-open');
            } else {
                // 键盘关闭了
                document.body.classList.remove('keyboard-open');
            }
        });
    }
    
    setupOrientationHandling() {
        const handleOrientationChange = () => {
            setTimeout(() => {
                this.optimizeCanvasSize();
                this.updateScreenSize();
                
                // 触发自定义事件
                const event = new CustomEvent('orientationOptimized', {
                    detail: {
                        orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
                        screenSize: this.screenSize
                    }
                });
                document.dispatchEvent(event);
            }, 100);
        };
        
        window.addEventListener('orientationchange', handleOrientationChange);
        window.addEventListener('resize', handleOrientationChange);
    }
    
    updateScreenSize() {
        const oldSize = this.screenSize;
        this.screenSize = this.getScreenSize();
        
        if (oldSize !== this.screenSize) {
            document.body.classList.remove(`screen-${oldSize}`);
            document.body.classList.add(`screen-${this.screenSize}`);
        }
    }
    
    setupViewportHandling() {
        // 动态调整视口高度（处理移动端浏览器地址栏）
        const setViewportHeight = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        
        setViewportHeight();
        window.addEventListener('resize', setViewportHeight);
        window.addEventListener('orientationchange', () => {
            setTimeout(setViewportHeight, 100);
        });
    }
    
    enableMobileOptimizations() {
        // 启用移动端特定优化
        
        // 预加载关键资源
        this.preloadCriticalResources();
        
        // 优化动画性能
        this.optimizeAnimations();
        
        // 启用硬件加速
        this.enableHardwareAcceleration();
        
        // 优化字体渲染
        this.optimizeFontRendering();
    }
    
    preloadCriticalResources() {
        // 预加载关键CSS和JS
        const criticalResources = [
            'style.css',
            'tetris.js'
        ];
        
        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource;
            link.as = resource.endsWith('.css') ? 'style' : 'script';
            document.head.appendChild(link);
        });
    }
    
    optimizeAnimations() {
        // 为移动端优化动画
        const style = document.createElement('style');
        style.textContent = `
            @media (max-width: 768px){
                * {
                    -webkit-transform: translateZ(0);
                    transform: translateZ(0);
                }
                
                .mobile-control-btn,
                #tetris-canvas,
                .game-controls button {
                    will-change: transform, opacity;
                }
                
                /* Reduce complex animations */
                .title-decoration {
                    animation-duration: 10s;
                }
                
                @keyframes brainPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    enableHardwareAcceleration() {
        const elements = document.querySelectorAll('.mobile-control-btn, #tetris-canvas, .game-controls button');
        elements.forEach(el => {
            el.style.transform = 'translateZ(0)';
            el.style.backfaceVisibility = 'hidden';
        });
    }
    
    optimizeFontRendering() {
        const style = document.createElement('style');
        style.textContent = `
            body {
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                text-rendering: optimizeLegibility;
            }
        `;
        document.head.appendChild(style);
    }
    
    // 公共方法
    getDeviceInfo() {
        return {
            isMobile: this.isMobile,
            isTablet: this.isTablet,
            isIOS: this.isIOS,
            isAndroid: this.isAndroid,
            screenSize: this.screenSize,
            orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
            pixelRatio: window.devicePixelRatio || 1,
            touchSupport: 'ontouchstart' in window
        };
    }
    
    showDeviceInfo() {
        console.log('Device Info:', this.getDeviceInfo());
    }
}

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    window.mobileDetection = new MobileDetection();
});

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileDetection;
} else {
    window.MobileDetection = MobileDetection;
}