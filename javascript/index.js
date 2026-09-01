const signupBtn = document.getElementById("signupBtn");
const options = document.getElementById("options");
const ctaButtons = document.querySelector(".cta-buttons");

signupBtn.addEventListener("click", function() {
  ctaButtons.style.opacity = "0";
  ctaButtons.style.transform = "translateY(-10px)";
  ctaButtons.style.pointerEvents = "none";
  
  setTimeout(() => {
    ctaButtons.classList.add("hidden");
    options.classList.remove("hidden");
    options.style.opacity = "0";
    options.style.transform = "translateY(10px)";
    
    // Trigger animation
    setTimeout(() => {
      options.style.transition = "all 0.4s ease-out";
      options.style.opacity = "1";
      options.style.transform = "translateY(0)";
    }, 10);
  }, 300);
});

// Smooth scroll for navigation links
document.querySelectorAll("a[href^='#']").forEach(anchor => {
  anchor.addEventListener("click", function(e) {
    const href = this.getAttribute("href");
    if (href !== "#") {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
});
