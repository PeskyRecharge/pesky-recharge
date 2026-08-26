// Toggle FAQ answers
document.querySelectorAll(".faq-question").forEach(btn => {
  btn.addEventListener("click", () => {
    const answer = btn.nextElementSibling;
    if (answer.style.display === "block") {
      answer.style.display = "none";
    } else {
      // hide all others
      document.querySelectorAll(".faq-answer").forEach(a => a.style.display = "none");
      answer.style.display = "block";
    }
  });
});
