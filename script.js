// Handles mobile menu toggle
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("mobileMenuBtn");
  const overlay = document.getElementById("overlay");
  const menuFrame = document.querySelector(".menu-frame");

  if (!btn || !overlay || !menuFrame) return;

  btn.addEventListener("click", () => {
    menuFrame.classList.toggle("mobile-open");
    overlay.classList.toggle("show");
  });

  overlay.addEventListener("click", () => {
    menuFrame.classList.remove("mobile-open");
    overlay.classList.remove("show");
  });
});

