// API-based promo system (secure - no promo codes in frontend)
class PromoDatabase {
    constructor() {
        this.apiUrl = '/api/daily-promo';
        this.cachedData = null;
        this.cacheDate = null;
    }

    // Получить московское время
    getMoscowTime() {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const moscowTime = new Date(utc + (3600000 * 3));
        return moscowTime;
    }

    // Получить московскую дату в формате строки
    getMoscowDateString() {
        const moscowTime = this.getMoscowTime();
        return moscowTime.toDateString();
    }

    // Получить промокод с сервера
    async getDailyPromo() {
        const today = this.getMoscowDateString();
        
        // Проверяем кэш
        if (this.cachedData && this.cacheDate === today) {
            return this.cachedData.promo;
        }
        
        try {
            const response = await fetch(this.apiUrl);
            const data = await response.json();
            
            if (data.success) {
                // Кэшируем результат
                this.cachedData = data;
                this.cacheDate = today;
                return data.promo;
            } else {
                throw new Error('API returned error');
            }
        } catch (error) {
            console.error('Failed to fetch promo:', error);
            // Fallback: показываем сообщение об ошибке
            return null;
        }
    }

    // Получить время до следующего промокода
    async getTimeUntilNextPromo() {
        const today = this.getMoscowDateString();
        
        // Если есть кэш, используем его
        if (this.cachedData && this.cacheDate === today) {
            return this.cachedData.timeUntilNext;
        }
        
        try {
            const response = await fetch(this.apiUrl);
            const data = await response.json();
            
            if (data.success) {
                this.cachedData = data;
                this.cacheDate = today;
                return data.timeUntilNext;
            }
        } catch (error) {
            console.error('Failed to fetch time:', error);
        }
        
        // Fallback: вычисляем локально
        const moscowTime = this.getMoscowTime();
        const tomorrow = new Date(moscowTime);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow - moscowTime;
    }
}

// Initialize API-based database
const db = new PromoDatabase();

// Timer functionality (async)
async function updateTimer() {
    const timeLeft = await db.getTimeUntilNextPromo();
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
}

// Update timer every second
setInterval(updateTimer, 1000);
updateTimer();

// Promo code reveal functionality
const promoCodeElement = document.getElementById('promoCode');
const revealBtn = document.getElementById('revealBtn');
const promoCard = document.getElementById('promoCard');
let isRevealed = false;
let currentPromo = '';

if (revealBtn) {
    revealBtn.addEventListener('click', () => {
        if (!isRevealed) {
            revealPromoCode();
            const todayMoscow = db.getMoscowDateString();
            sessionStorage.setItem('promoRevealedToday', todayMoscow);
        }
    });
}

function revealPromoCode() {
    if (!promoCodeElement || !revealBtn) return;
    
    isRevealed = true;
    
    // Hide button
    revealBtn.classList.add('hidden');
    
    // Remove blur
    promoCodeElement.classList.remove('blurred');
    promoCodeElement.classList.add('generating');
    
    // Fetch promo from API
    db.getDailyPromo().then(promo => {
        if (!promo) {
            promoCodeElement.textContent = 'ОШИБКА ЗАГРУЗКИ';
            promoCodeElement.classList.remove('generating');
            showNotification('Ошибка загрузки промокода');
            return;
        }
        
        currentPromo = promo;
        
        // Generate animation
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let iterations = 0;
        const maxIterations = 20;
        
        const interval = setInterval(() => {
            promoCodeElement.textContent = currentPromo
                .split('')
                .map((_, index) => {
                    if (index < iterations) {
                        return currentPromo[index];
                    }
                    return chars[Math.floor(Math.random() * chars.length)];
                })
                .join('');
            
            iterations += 1;
            
            if (iterations > maxIterations) {
                clearInterval(interval);
                promoCodeElement.textContent = currentPromo;
                promoCodeElement.classList.remove('generating');
                promoCodeElement.classList.add('revealed');
                
                // Make it clickable
                promoCodeElement.style.cursor = 'pointer';
            }
        }, 50);
    }).catch(error => {
        console.error('Error revealing promo:', error);
        promoCodeElement.textContent = 'ОШИБКА';
        promoCodeElement.classList.remove('generating');
        showNotification('Ошибка загрузки промокода');
    });
}

// Copy to clipboard functionality
if (promoCodeElement) {
    promoCodeElement.addEventListener('click', () => {
        if (isRevealed && promoCodeElement.classList.contains('revealed')) {
            copyToClipboard(currentPromo);
        }
    });
}

function copyToClipboard(text) {
    // Use modern clipboard API if available
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Промокод скопирован!');
            if (promoCard) {
                promoCard.classList.add('copied');
                setTimeout(() => {
                    promoCard.classList.remove('copied');
                }, 2000);
            }
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        showNotification('Промокод скопирован!');
        
        if (promoCard) {
            promoCard.classList.add('copied');
            setTimeout(() => {
                promoCard.classList.remove('copied');
            }, 2000);
        }
    } catch (err) {
        console.error('Failed to copy:', err);
    }
    
    document.body.removeChild(textarea);
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');
    
    if (notification && notificationText) {
        notificationText.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// Page Navigation with animations
function showPage(pageId) {
    const heroSection = document.querySelector('.min-h-screen');
    const promoPage = document.querySelector('.promo-page');
    
    if (!heroSection || !promoPage) return;
    
    if (pageId === 'promo') {
        // Animate out hero, animate in promo
        heroSection.classList.add('page-exit');
        promoPage.classList.add('page-enter');
        
        setTimeout(() => {
            heroSection.style.display = 'none';
            heroSection.classList.remove('page-exit');
            
            promoPage.style.display = 'block';
            
            // Trigger reflow
            promoPage.offsetHeight;
            
            promoPage.classList.remove('page-enter');
            promoPage.classList.add('page-active');
        }, 50);
    } else {
        // Animate out promo, animate in hero
        promoPage.classList.add('page-exit');
        heroSection.classList.add('page-enter');
        
        setTimeout(() => {
            promoPage.style.display = 'none';
            promoPage.classList.remove('page-exit', 'page-active');
            
            heroSection.style.display = 'block';
            
            // Trigger reflow
            heroSection.offsetHeight;
            
            heroSection.classList.remove('page-enter');
            heroSection.classList.add('page-active');
        }, 50);
    }
}

// Handle hash navigation
function handleNavigation() {
    const hash = window.location.hash.substring(1);
    
    if (hash === 'promo') {
        showPage('promo');
    } else if (hash === 'home' || hash === '') {
        showPage('home');
    }
}

// Listen to hash changes
window.addEventListener('hashchange', handleNavigation);

// Initial page load with blur animation
window.addEventListener('load', () => {
    // Add loading class to body
    document.body.classList.add('loading');
    
    // Remove loading class after animation
    setTimeout(() => {
        document.body.classList.remove('loading');
    }, 100);
    
    // Handle initial navigation after blur animation
    setTimeout(() => {
        handleNavigation();
        
        // Check if promo was already revealed today
        const revealedToday = sessionStorage.getItem('promoRevealedToday');
        const todayMoscow = db.getMoscowDateString();
        
        if (revealedToday === todayMoscow && window.location.hash === '#promo') {
            // Auto-reveal if already revealed in this session
            setTimeout(() => {
                revealPromoCode();
            }, 500);
        }
    }, 900);
});

// Smooth scroll for navigation links
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            const targetId = href.substring(1);
            
            // Check if it's a page navigation (promo, home)
            if (targetId === 'promo' || targetId === 'home') {
                e.preventDefault();
                window.location.hash = targetId;
                return;
            }
            
            // For other anchors, check if target exists in current page
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

// Display Moscow time info
console.log('🕐 Сайт работает по московскому времени (UTC+3)');
console.log('📅 Текущая дата (Москва):', db.getMoscowDateString());
console.log('🔒 Промокоды защищены на сервере - клиент получает только один код в день');
