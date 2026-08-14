/**
 * Santander Navigation & View Router Module
 */
(function (global) {
    'use strict';

    const LOADER = {
        NAV: 1200,
        BACK: 850,
        SHORT: 1600,
        MEDIUM: 2400,
        LONG: 3200,
        XL: 4200
    };

    let historyStack = ['home-view'];

    function on(id, eventName, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(eventName, handler);
        }
    }

    function showLoader(text = 'Cargando...') {
        const loaderTextMsg = document.getElementById('loader-text');
        const globalLoader = document.getElementById('global-loader');
        if (loaderTextMsg) loaderTextMsg.textContent = text;
        if (globalLoader) globalLoader.classList.remove('hidden-loader');
    }

    function hideLoader() {
        const globalLoader = document.getElementById('global-loader');
        if (globalLoader) globalLoader.classList.add('hidden-loader');
    }

    function openSidebar() {
        const sidebar = document.getElementById('sidebar-menu');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        
        if (sidebarOverlay) {
            sidebarOverlay.classList.add('active');
            sidebarOverlay.style.setProperty('display', 'block', 'important');
            sidebarOverlay.style.setProperty('opacity', '1', 'important');
            sidebarOverlay.style.setProperty('pointer-events', 'auto', 'important');
            sidebarOverlay.style.setProperty('z-index', '99998', 'important');
        }
        if (sidebar) {
            sidebar.classList.add('active');
            sidebar.style.setProperty('transform', 'translate3d(0, 0, 0)', 'important');
            sidebar.style.setProperty('display', 'flex', 'important');
            sidebar.style.setProperty('visibility', 'visible', 'important');
            sidebar.style.setProperty('z-index', '99999', 'important');
        }

        const lastAccessEl = document.getElementById('sidebar-last-access');
        if (lastAccessEl) {
            const now = new Date();
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const pad = (num) => String(num).padStart(2, '0');
            lastAccessEl.textContent = `Último acceso: ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        }
    }

    function closeSidebar() {
        const sidebar = document.getElementById('sidebar-menu');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
            sidebarOverlay.style.setProperty('opacity', '0', 'important');
            sidebarOverlay.style.setProperty('pointer-events', 'none', 'important');
            setTimeout(() => {
                if (sidebarOverlay && !sidebarOverlay.classList.contains('active')) {
                    sidebarOverlay.style.setProperty('display', 'none', 'important');
                }
            }, 300);
        }
        if (sidebar) {
            sidebar.classList.remove('active');
            sidebar.style.setProperty('transform', 'translate3d(105%, 0, 0)', 'important');
        }
    }

    let isNavigating = false;

    function cleanupAnimationClasses(el) {
        if (!el) return;
        el.classList.remove('page-slide-in-right', 'page-slide-out-left', 'page-slide-in-left', 'page-slide-out-right');
    }

    function animateTransition(fromEl, toEl, direction = 'forward', callback) {
        if (!fromEl || !toEl || fromEl === toEl) {
            if (callback) callback();
            return;
        }

        cleanupAnimationClasses(fromEl);
        cleanupAnimationClasses(toEl);

        if (direction === 'forward') {
            toEl.classList.remove('hidden-view');
            toEl.classList.add('view-active', 'page-slide-in-right');
            fromEl.classList.add('page-slide-out-left');

            setTimeout(() => {
                cleanupAnimationClasses(fromEl);
                cleanupAnimationClasses(toEl);
                fromEl.classList.replace('view-active', 'hidden-view');
                if (callback) callback();
            }, 280);
        } else {
            toEl.classList.remove('hidden-view');
            toEl.classList.add('view-active', 'page-slide-in-left');
            fromEl.classList.add('page-slide-out-right');

            setTimeout(() => {
                cleanupAnimationClasses(fromEl);
                cleanupAnimationClasses(toEl);
                fromEl.classList.replace('view-active', 'hidden-view');
                if (callback) callback();
            }, 280);
        }
    }

    function navigateTo(viewId, loaderMsg = '', delay = 0) {
        if (isNavigating) return;
        const currentView = historyStack[historyStack.length - 1];
        if (currentView === viewId) return;

        const currentViewElement = document.getElementById(currentView);
        const nextViewElement = document.getElementById(viewId);
        closeSidebar();
        document.body.style.overflowX = 'hidden';

        if (!currentViewElement || !nextViewElement) return;

        if (global.SantanderHaptics && typeof global.SantanderHaptics.light === 'function') {
            global.SantanderHaptics.light();
        }

        if (delay > 0 && loaderMsg) {
            isNavigating = true;
            showLoader(loaderMsg);
            setTimeout(() => {
                hideLoader();
                animateTransition(currentViewElement, nextViewElement, 'forward', () => {
                    historyStack.push(viewId);
                    isNavigating = false;
                });
            }, delay);
        } else {
            isNavigating = true;
            animateTransition(currentViewElement, nextViewElement, 'forward', () => {
                historyStack.push(viewId);
                isNavigating = false;
            });
        }
    }

    function goBack() {
        if (isNavigating || historyStack.length <= 1) return;
        closeSidebar();
        document.body.style.overflowX = 'hidden';

        if (global.SantanderHaptics && typeof global.SantanderHaptics.selection === 'function') {
            global.SantanderHaptics.selection();
        }

        isNavigating = true;
        const currentView = historyStack.pop();
        const previousView = historyStack[historyStack.length - 1];

        const currentViewElement = document.getElementById(currentView);
        const previousViewElement = document.getElementById(previousView);

        if (currentViewElement && previousViewElement) {
            animateTransition(currentViewElement, previousViewElement, 'backward', () => {
                isNavigating = false;
            });
        } else {
            isNavigating = false;
        }
    }

    function goHome() {
        if (isNavigating) return;
        closeSidebar();
        document.body.style.overflowX = 'hidden';
        const currentView = historyStack[historyStack.length - 1];
        if (currentView === 'home-view') return;

        if (global.SantanderHaptics && typeof global.SantanderHaptics.selection === 'function') {
            global.SantanderHaptics.selection();
        }

        isNavigating = true;
        const currentViewElement = document.getElementById(currentView);
        const homeViewElement = document.getElementById('home-view');

        if (currentViewElement && homeViewElement) {
            animateTransition(currentViewElement, homeViewElement, 'backward', () => {
                historyStack = ['home-view'];
                isNavigating = false;
            });
        } else {
            historyStack = ['home-view'];
            isNavigating = false;
        }
    }

    function initNavigation() {
        document.querySelectorAll('.back-btn').forEach((btn) => {
            btn.removeEventListener('click', goBack);
            btn.addEventListener('click', goBack);
        });
        document.querySelectorAll('.btn-home-action').forEach((btn) => {
            btn.removeEventListener('click', goHome);
            btn.addEventListener('click', goHome);
        });

        const bindSidebarOpen = (id) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.onclick = (e) => {
                    e.preventDefault();
                    try {
                        if (global.SantanderHaptics && typeof global.SantanderHaptics.selection === 'function') {
                            global.SantanderHaptics.selection();
                        } else if (typeof global.triggerHaptic === 'function') {
                            global.triggerHaptic('selection');
                        }
                    } catch (err) {}
                    openSidebar();
                };
            }
        };

        bindSidebarOpen('btn-open-sidebar-home');
        bindSidebarOpen('btn-open-sidebar-detail');
        bindSidebarOpen('btn-open-sidebar-account');

        const closeBtn = document.getElementById('btn-close-sidebar');
        if (closeBtn) closeBtn.onclick = closeSidebar;

        const sidebarOverlay = document.getElementById('sidebar-overlay');
        if (sidebarOverlay) sidebarOverlay.onclick = closeSidebar;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavigation);
    } else {
        initNavigation();
    }

    global.SantanderNav = {
        LOADER,
        on,
        showLoader,
        hideLoader,
        openSidebar,
        closeSidebar,
        navigateTo,
        goBack,
        goHome,
        initNavigation,
        getHistory: () => historyStack
    };

    global.on = on;
    global.showLoader = showLoader;
    global.hideLoader = hideLoader;
    global.navigateTo = navigateTo;
    global.goBack = goBack;
    global.goHome = goHome;
    global.openSidebar = openSidebar;
    global.closeSidebar = closeSidebar;

})(typeof window !== 'undefined' ? window : this);
