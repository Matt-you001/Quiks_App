(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-audience-tab]"));
  var panels = Array.prototype.slice.call(document.querySelectorAll("[data-audience-panel]"));
  var periodButtons = Array.prototype.slice.call(document.querySelectorAll("[data-school-period]"));

  function showAudience(audience, updateUrl) {
    var normalized = audience === "schools" ? "schools" : "individual";
    tabs.forEach(function (tab) {
      var active = tab.getAttribute("data-audience-tab") === normalized;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.setAttribute("tabindex", active ? "0" : "-1");
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-audience-panel") !== normalized;
    });
    if (updateUrl) {
      var url = new URL(window.location.href);
      if (normalized === "schools") url.searchParams.set("audience", "schools");
      else url.searchParams.delete("audience");
      window.history.replaceState({}, "", url.toString());
    }
  }

  function showSchoolPeriod(period) {
    var normalized = period === "session" ? "session" : "term";
    periodButtons.forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-school-period") === normalized);
    });
    document.querySelectorAll("[data-term-price][data-session-price]").forEach(function (price) {
      price.textContent = price.getAttribute(normalized === "session" ? "data-session-price" : "data-term-price");
    });
    document.documentElement.setAttribute("data-school-period", normalized);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      showAudience(tab.getAttribute("data-audience-tab"), true);
    });
  });
  periodButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      showSchoolPeriod(button.getAttribute("data-school-period"));
    });
  });

  var params = new URLSearchParams(window.location.search);
  showAudience(params.get("audience"), false);
  showSchoolPeriod(params.get("period"));

  var requestedPlan = params.get("plan");
  if (requestedPlan) {
    var requestedPeriod = params.get("period") === "session" ? "session" : "term";
    var requestedSelection = requestedPlan.replace(/[^a-z-]/g, "") + ":" + requestedPeriod;
    var planInput = document.querySelector('input[name="schoolPackageSelection"][value="' + requestedSelection + '"]');
    if (planInput) planInput.checked = true;
  }
})();
