document.addEventListener('DOMContentLoaded', () => {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // 1. INJECT SYSTEM KEYFRAMES & SPOTLIGHT STYLES
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        /* Fluid Entrance Revealer */
        .reveal-item {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1),
                        transform 0.65s cubic-bezier(0.16, 1, 0.3, 1);
            will-change: opacity, transform;
        }
        .reveal-item.revealed {
            opacity: 1;
            transform: translateY(0);
        }

        /* Ambient Cursor Lighting on Cards */
        .card, .team-card, .hero-preview-card {
            position: relative;
            overflow: hidden;
        }
        .card-spotlight {
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.35s ease;
            background: radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(59, 130, 246, 0.14), transparent 80%);
            z-index: 1;
        }
        .card:hover .card-spotlight,
        .team-card:hover .card-spotlight,
        .hero-preview-card:hover .card-spotlight {
            opacity: 1;
        }
    `;
    document.head.appendChild(styleSheet);

    // 2. HAMBURGER MENU TOGGLE
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navbar = document.getElementById('navbar');

    if (hamburgerBtn && navbar) {
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = navbar.classList.toggle('open');
            hamburgerBtn.classList.toggle('active');
            hamburgerBtn.setAttribute('aria-expanded', isOpen);
        });

        navbar.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navbar.classList.remove('open');
                hamburgerBtn.classList.remove('active');
                hamburgerBtn.setAttribute('aria-expanded', 'false');
            });
        });

        document.addEventListener('click', (e) => {
            if (!navbar.contains(e.target) && !hamburgerBtn.contains(e.target)) {
                navbar.classList.remove('open');
                hamburgerBtn.classList.remove('active');
                hamburgerBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // 3. SCROLL REVEAL OBSERVER
    const elementsToReveal = document.querySelectorAll(
        '.badge-wrapper, .hero h1, .hero-subtitle, .hero-buttons, .quick-chips-wrapper, .hero-preview-card, .section-heading, .card, .team-card'
    );

    elementsToReveal.forEach((el, index) => {
        el.classList.add('reveal-item');
        el.style.transitionDelay = `${(index % 3) * 60}ms`;
    });

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

    elementsToReveal.forEach(el => revealObserver.observe(el));

    // 4. 60FPS 3D TILT ON INTERACTIVE CARDS (DESKTOP ONLY)
    if (!isTouchDevice) {
        const tiltCards = document.querySelectorAll('.card, .team-card, .hero-preview-card');

        tiltCards.forEach(card => {
            const spotlight = document.createElement('div');
            spotlight.className = 'card-spotlight';
            card.appendChild(spotlight);

            let isHovered = false;
            let mouseX = 0;
            let mouseY = 0;
            let currentRotateX = 0;
            let currentRotateY = 0;
            let rafId = null;

            const renderFrame = () => {
                if (!isHovered) {
                    currentRotateX += (0 - currentRotateX) * 0.12;
                    currentRotateY += (0 - currentRotateY) * 0.12;
                    card.style.transform = `perspective(1000px) rotateX(${currentRotateX.toFixed(2)}deg) rotateY(${currentRotateY.toFixed(2)}deg) translateY(0px) scale(1)`;

                    if (Math.abs(currentRotateX) > 0.01 || Math.abs(currentRotateY) > 0.01) {
                        rafId = requestAnimationFrame(renderFrame);
                    } else {
                        card.style.transform = '';
                        card.style.boxShadow = '';
                        cancelAnimationFrame(rafId);
                        rafId = null;
                    }
                    return;
                }

                const rect = card.getBoundingClientRect();
                const xPercent = (mouseX - rect.left) / rect.width - 0.5;
                const yPercent = (mouseY - rect.top) / rect.height - 0.5;

                const targetRotateX = yPercent * -8;
                const targetRotateY = xPercent * 8;

                currentRotateX += (targetRotateX - currentRotateX) * 0.18;
                currentRotateY += (targetRotateY - currentRotateY) * 0.18;

                const shadowX = (xPercent * 20).toFixed(1);
                const shadowY = (yPercent * 20 + 12).toFixed(1);

                card.style.transform = `perspective(1000px) rotateX(${currentRotateX.toFixed(2)}deg) rotateY(${currentRotateY.toFixed(2)}deg) translateY(-5px) scale(1.012)`;
                card.style.boxShadow = `${shadowX}px ${shadowY}px 30px -4px rgba(37, 99, 235, 0.16), 0 8px 16px -2px rgba(15, 23, 42, 0.04)`;

                rafId = requestAnimationFrame(renderFrame);
            };

            card.addEventListener('mousemove', (e) => {
                mouseX = e.clientX;
                mouseY = e.clientY;

                const rect = card.getBoundingClientRect();
                card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);

                if (!rafId) rafId = requestAnimationFrame(renderFrame);
            });

            card.addEventListener('mouseenter', () => {
                isHovered = true;
                if (!rafId) rafId = requestAnimationFrame(renderFrame);
            });

            card.addEventListener('mouseleave', () => {
                isHovered = false;
            });
        });
    }

    // 5. FLOATING PILL NAVBAR SCROLL DYNAMICS
    const header = document.querySelector('.header');
    if (header) {
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    if (window.scrollY > 20) {
                        header.classList.add('scrolled');
                    } else {
                        header.classList.remove('scrolled');
                    }
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    }
});