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
    
    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
}

// Update timer every second
setInterval(updateTimer, 1000);
updateTimer();

// Promo code reveal functionality
const promoCodeElement = document.getElementById('promoCode');
const revealBtn = document.getElementById('revealBtn');
const promoCard = document.getElementById('promoCard');
const promoHint = document.querySelector('.promo-hint');
let isRevealed = false;
let currentPromo = '';

revealBtn.addEventListener('click', () => {
    if (!isRevealed) {
        revealPromoCode();
    }
});

function revealPromoCode() {
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
                .map((char, index) => {
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
                promoHint.classList.add('visible');
                
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
promoCodeElement.addEventListener('click', () => {
    if (isRevealed && promoCodeElement.classList.contains('revealed')) {
        copyToClipboard(currentPromo);
    }
});

function copyToClipboard(text) {
    // Create temporary textarea
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        showNotification('Промокод скопирован!');
        
        // Add copied effect to card
        promoCard.classList.add('copied');
        setTimeout(() => {
            promoCard.classList.remove('copied');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
    
    document.body.removeChild(textarea);
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');
    
    notificationText.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Smooth scroll for scroll indicator
document.querySelector('.scroll-indicator').addEventListener('click', () => {
    document.querySelector('.promo-section').scrollIntoView({ 
        behavior: 'smooth' 
    });
});

// Navigation smooth scroll
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        
        if (targetSection) {
            targetSection.scrollIntoView({ 
                behavior: 'smooth' 
            });
            
            // Update active link
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        }
    });
});

// Update active nav link on scroll
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section[id]');
    const scrollY = window.pageYOffset;
    
    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 100;
        const sectionId = section.getAttribute('id');
        
        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${sectionId}`) {
                    link.classList.add('active');
                }
            });
        }
    });
});

// Check if promo was already revealed today
window.addEventListener('load', () => {
    const revealedToday = sessionStorage.getItem('promoRevealedToday');
    const todayMoscow = db.getMoscowDateString();
    
    if (revealedToday === todayMoscow) {
        // Auto-reveal if already revealed in this session
        setTimeout(() => {
            revealPromoCode();
        }, 500);
    }
});

// Save reveal state (с московским временем)
revealBtn.addEventListener('click', () => {
    const todayMoscow = db.getMoscowDateString();
    sessionStorage.setItem('promoRevealedToday', todayMoscow);
});

// Display Moscow time info (optional - можно показать пользователю)
console.log('🕐 Сайт работает по московскому времени (UTC+3)');
console.log('📅 Текущая дата (Москва):', db.getMoscowDateString());
console.log('🔒 Промокоды защищены на сервере - клиент получает только один код в день');
