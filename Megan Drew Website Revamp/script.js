document.addEventListener('DOMContentLoaded', () => {
  /* ==========================================
     1. Sticky Navbar & Image Injection
     ========================================== */
  const navbar = document.getElementById('navbar');
  const heroSection = document.getElementById('home');
  const aboutImg = document.getElementById('about-img');

  // Inject the about image dynamically (Using an 8K Unsplash image scaled perfectly).
  aboutImg.src = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=100&w=2560&auto=format&fit=crop";

  const navObserver = new IntersectionObserver(
    ([entry]) => {
      // If hero is NOT intersecting (user scrolled past it), add class
      if (!entry.isIntersecting) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    },
    { threshold: 0.1 }
  );

  navObserver.observe(heroSection);

  /* ==========================================
     2. Mobile Menu Toggle
     ========================================== */
  const mobileToggle = document.querySelector('.mobile-menu-toggle');
  const navLinks = document.getElementById('nav-links');

  mobileToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    const isExpanded = navLinks.classList.contains('active');
    mobileToggle.setAttribute('aria-expanded', isExpanded);
  });

  // Close menu when clicking a link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
      mobileToggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* ==========================================
     3. Scroll Reveal Animations
     ========================================== */
  const revealElements = document.querySelectorAll('.scroll-reveal');

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');

          // If it's a stat block, trigger counter logic
          if (entry.target.classList.contains('stat-block')) {
            const numberEl = entry.target.querySelector('.stat-number');
            if (numberEl && numberEl.dataset.target) {
              animateValue(numberEl, 0, parseFloat(numberEl.dataset.target), 1500, numberEl.dataset.decimal === 'true');
              // Remove target data so it only animates once
              delete numberEl.dataset.target;
            }
          }

          // Optional: stop observing once revealed
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -100px 0px', threshold: 0.1 }
  );

  revealElements.forEach(el => revealObserver.observe(el));

  /* ==========================================
     4. Number Count-Up Animation Logic
     ========================================== */
  function animateValue(obj, start, end, duration, isDecimal) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      const currentVal = progress * (end - start) + start;

      if (isDecimal) {
        obj.innerHTML = currentVal.toFixed(1);
      } else {
        obj.innerHTML = Math.floor(currentVal);
      }

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        // Ensure exact final value is set
        obj.innerHTML = isDecimal ? end.toFixed(1) : end;
      }
    };
    window.requestAnimationFrame(step);
  }

  /* ==========================================
     5. Apple-style Scrollytelling Story Frame
     ========================================== */
  const storySection = document.getElementById('story-scroll');
  const storyFrames = document.querySelectorAll('.story-frame');

  if (storySection && storyFrames.length > 0) {
    window.addEventListener('scroll', () => {
      const rect = storySection.getBoundingClientRect();
      const sectionTop = rect.top;
      const sectionHeight = rect.height;
      const viewportHeight = window.innerHeight;

      // Calculate scroll progress exclusively inside the 400vh section (range 0 to 1)
      let progress = 0;
      if (sectionTop <= 0) {
        progress = Math.abs(sectionTop) / (sectionHeight - viewportHeight);
      }
      progress = Math.max(0, Math.min(1, progress));

      const numFrames = storyFrames.length;
      const progressPerFrame = 1 / numFrames;

      storyFrames.forEach((frame, index) => {
        // Find start and end range for this specific frame
        const frameStart = index * progressPerFrame;
        const frameEnd = (index + 1) * progressPerFrame;

        // 25% overlap zone for cross-fading smoothly
        const fadeThreshold = 0.25 * progressPerFrame;

        let opacity = 0;

        if (progress >= frameStart && progress <= frameEnd) {
          opacity = 1;
          // Cross-fade intro
          if (progress < frameStart + fadeThreshold) {
            opacity = (progress - frameStart) / fadeThreshold;
          }
          // Cross-fade outro (unless it's the absolute last frame staying on screen)
          else if (progress > frameEnd - fadeThreshold && index !== numFrames - 1) {
            opacity = (frameEnd - progress) / fadeThreshold;
          }
        }

        frame.style.opacity = opacity;

        const caption = frame.querySelector('.story-caption');
        if (caption) {
          caption.style.transform = `translateY(${opacity === 1 ? 0 : 30}px)`;
        }

        const bg = frame.querySelector('.story-bg');
        if (bg) {
          // Very slow continuous zoom effect
          const zoomAmount = 1 + ((progress - frameStart) * 0.15);
          bg.style.transform = `scale(${Math.max(1, zoomAmount)})`;
        }
      });
    }, { passive: true });

    // Kickstart the effect once
    window.dispatchEvent(new Event('scroll'));
  }

  /* ==========================================
     6. 3D Hover Tilt Effect for Services
     ========================================== */
  const tiltCards = document.querySelectorAll('.tilt-card');

  tiltCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      let rotateX = ((y - centerY) / centerY) * -12; // Max 12deg
      let rotateY = ((x - centerX) / centerX) * 12;  // Max 12deg

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transition = 'transform 0.5s ease-out, box-shadow 0.5s ease-out';
      card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;

      setTimeout(() => {
        card.style.transition = '';
      }, 500);
    });
  });
});
