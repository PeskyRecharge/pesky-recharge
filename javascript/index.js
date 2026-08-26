const signupBtn = document.getElementById("signupBtn");
const options = document.getElementById("options");

signupBtn.addEventListener("click", function() {
  options.classList.remove("hidden");
  signupBtn.style.display = "none"; // hide Sign Up button
});
