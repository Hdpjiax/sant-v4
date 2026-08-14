/**
 * Santander Haptic Feedback Engine
 * Soporte para iOS, Android (Capacitor) y Web Vibration API
 */
(function (global) {
    'use strict';

    function triggerHaptic(type = 'light') {
        try {
            if (global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.Haptics) {
                const Haptics = global.Capacitor.Plugins.Haptics;
                if (type === 'light') Haptics.impact({ style: 'LIGHT' });
                else if (type === 'medium') Haptics.impact({ style: 'MEDIUM' });
                else if (type === 'heavy') Haptics.impact({ style: 'HEAVY' });
                else if (type === 'selection') Haptics.selectionStart();
                else if (type === 'success') Haptics.notification({ type: 'SUCCESS' });
                else if (type === 'error') Haptics.notification({ type: 'ERROR' });
                return;
            }

            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                if (type === 'light' || type === 'selection') navigator.vibrate(10);
                else if (type === 'medium') navigator.vibrate(25);
                else if (type === 'heavy') navigator.vibrate(50);
                else if (type === 'success') navigator.vibrate([15, 30, 20]);
                else if (type === 'error') navigator.vibrate([40, 40, 40]);
            }
        } catch (e) {
            // Silencioso si el navegador no permite vibración
        }
    }

    function attachHapticsToElements(selector = '.nav-item, .account-option-row, .back-btn, .filter-tab') {
        document.querySelectorAll(selector).forEach((btn) => {
            btn.addEventListener('click', () => triggerHaptic('light'), { passive: true });
        });
    }

    global.SantanderHaptics = {
        trigger: triggerHaptic,
        attach: attachHapticsToElements,
        light: () => triggerHaptic('light'),
        selection: () => triggerHaptic('selection'),
        medium: () => triggerHaptic('medium'),
        heavy: () => triggerHaptic('heavy'),
        success: () => triggerHaptic('success'),
        error: () => triggerHaptic('error')
    };

    global.triggerHaptic = triggerHaptic;

})(typeof window !== 'undefined' ? window : this);
