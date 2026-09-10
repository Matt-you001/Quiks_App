(function () {
  var form = document.getElementById("school-checkout-form");
  if (!form) return;

  var status = document.getElementById("school-checkout-status");
  var submit = document.getElementById("start-school-checkout");
  var config = window.QUIKS_SCHOOL_PADDLE_CONFIG || {};
  var initialized = false;
  var activePurchase = null;

  function setStatus(message, kind) {
    status.textContent = message;
    status.classList.toggle("checkout-status-error", kind === "error");
    status.classList.toggle("checkout-status-success", kind === "success");
  }

  function selectedValue(name) {
    var input = form.querySelector('input[name="' + name + '"]:checked');
    return input ? input.value : "";
  }

  function validateLearnerCount(packageId, learnerCount) {
    var ranges = {
      starter: [10, 100],
      growth: [101, 200],
      complete: [201, 500]
    };
    var range = ranges[packageId];
    if (!Number.isInteger(learnerCount) || learnerCount < 1) return "Enter a valid whole-number learner count.";
    if (range && (learnerCount < range[0] || learnerCount > range[1])) {
      return "The selected package covers " + range[0] + "–" + range[1] + " learners. Choose the matching package or adjust the learner count.";
    }
    return "";
  }

  async function postJson(path, payload) {
    var response = await fetch(String(config.apiBaseUrl || "").replace(/\/$/, "") + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    var result = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(result.error || "Quiks could not prepare this school purchase.");
    return result;
  }

  async function waitForActivation(purchase) {
    for (var attempt = 0; attempt < 20; attempt += 1) {
      await new Promise(function (resolve) { window.setTimeout(resolve, 3000); });
      var result = await postJson("/school/purchases/status", purchase);
      if (result.status === "active") {
        setStatus("Payment verified. Your Quiks School licence is active until " + new Date(result.licenceEndAt).toLocaleDateString() + ". The first administrator invitation has been sent by email.", "success");
        return;
      }
      if (result.status === "refunded" || result.status === "expired" || result.status === "failed") {
        setStatus(result.failureReason || "The school licence could not be activated. Please contact Quiks support with your payment receipt.", "error");
        return;
      }
    }
    setStatus("Payment was received and is still being verified. The administrator invitation will be emailed after activation.", "success");
  }

  function initializePaddle() {
    if (initialized) return true;
    if (!window.Paddle || !config.clientToken) return false;
    if (config.environment === "sandbox") window.Paddle.Environment.set("sandbox");
    window.Paddle.Initialize({
      token: config.clientToken,
      eventCallback: function (event) {
        if (event && event.name === "checkout.completed") {
          setStatus("Payment received. Quiks is verifying and activating the licence…", "success");
          submit.disabled = false;
          if (activePurchase) void waitForActivation(activePurchase).catch(function () {
            setStatus("Payment was received and is still being verified. The administrator invitation will be emailed after activation.", "success");
          });
        } else if (event && event.name === "checkout.closed") {
          submit.disabled = false;
        }
      }
    });
    initialized = true;
    return true;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;

    var packageSelection = selectedValue("schoolPackageSelection").split(":");
    var packageId = packageSelection[0] || "";
    var period = packageSelection[1] === "session" ? "session" : "term";
    var learnerCount = Number(form.elements.learnerCount.value);
    var learnerCountError = validateLearnerCount(packageId, learnerCount);
    if (learnerCountError) {
      setStatus(learnerCountError, "error");
      form.elements.learnerCount.focus();
      return;
    }
    var priceId = config.prices && config.prices[packageId] && config.prices[packageId][period];
    if (!config.enabled || !priceId || !initializePaddle()) {
      setStatus("This school price is not connected to Paddle yet. No charge was made. Add the sandbox client token and price IDs to school-paddle-config.js, then enable checkout after the licence-activation webhook is ready.", "error");
      return;
    }

    submit.disabled = true;
    setStatus("Preparing a secure school purchase…");
    try {
      var pending = await postJson("/school/purchases/pending", {
        schoolName: form.elements.schoolName.value.trim(),
        administratorName: form.elements.administratorName.value.trim(),
        administratorEmail: form.elements.administratorEmail.value.trim().toLowerCase(),
        enrolmentMode: form.elements.enrolmentMode.value,
        packageId: packageId,
        period: period,
        learnerCount: learnerCount
      });
      if (!pending.purchaseReference || !pending.statusToken || pending.priceId !== priceId) {
        throw new Error("The server package does not match the selected Paddle price. No charge was made.");
      }
      activePurchase = { purchaseReference: pending.purchaseReference, statusToken: pending.statusToken };
      setStatus("Opening secure Paddle checkout…");
      window.Paddle.Checkout.open({
        items: [{ priceId: pending.priceId, quantity: packageId === "per-learner" ? learnerCount : 1 }],
        customer: { email: form.elements.administratorEmail.value.trim() },
        customData: {
          app_user_id: pending.purchaseReference,
          quiks_purchase_kind: "school"
        },
        settings: { displayMode: "overlay", theme: "light" }
      });
    } catch (error) {
      submit.disabled = false;
      setStatus(error instanceof Error ? error.message : "Quiks could not prepare this school purchase. No charge was made.", "error");
    }
  });
})();
