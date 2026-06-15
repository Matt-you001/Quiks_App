document.addEventListener("DOMContentLoaded", function () {
  var buttons = document.querySelectorAll("[data-menu-toggle]");
  buttons.forEach(function (button) {
    var targetId = button.getAttribute("data-menu-toggle");
    if (!targetId) {
      return;
    }

    var nav = document.getElementById(targetId);
    if (!nav) {
      return;
    }

    button.addEventListener("click", function () {
      var nextOpen = nav.getAttribute("data-open") !== "true";
      nav.setAttribute("data-open", nextOpen ? "true" : "false");
      button.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      button.textContent = nextOpen ? "Close" : "Menu";
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.setAttribute("data-open", "false");
        button.setAttribute("aria-expanded", "false");
        button.textContent = "Menu";
      });
    });
  });
});
