(function () {
  const MARKED = "data-required-marked";
  const ORIGINAL_LABEL = "data-original-label-text";
  const OLD_STAR_CLASS = "required-star";

  // V66 hidden monthly fields should not keep required star when trial is selected.
function isRequiredField(field) {
    if (!field) return false;
    if (!["INPUT", "SELECT", "TEXTAREA"].includes(field.tagName)) return false;
    if (field.type === "hidden") return false;
    if (field.disabled) return false;
    if (field.closest?.(".paid-access-only.is-hidden")) return false;
    return field.required || field.getAttribute("aria-required") === "true";
  }

  function findFieldLabel(field) {
    if (!field) return null;

    if (field.id) {
      const byFor = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
      if (byFor) return byFor;
    }

    const wrapped = field.closest("label");
    if (wrapped) return wrapped;

    const group = field.closest(".form-row, .field-row, .auth-card, .admin-field, .form-group, .input-group, .client-section, .user-card, .grid");
    if (group) {
      const labels = [...group.querySelectorAll("label")];
      if (labels.length === 1) return labels[0];
    }

    return null;
  }

  function removeOldInsertedStars(label) {
    if (!label) return;
    label.querySelectorAll(`.${OLD_STAR_CLASS}`).forEach((star) => star.remove());
  }

  function getTextNodesBeforeField(label) {
    const field = label.querySelector("input, select, textarea");
    const nodes = [];
    for (const node of label.childNodes) {
      if (field && node === field) break;
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) nodes.push(node);
    }
    return nodes;
  }

  function getPrimaryTextNode(label) {
    const beforeField = getTextNodesBeforeField(label);
    if (beforeField.length) return beforeField[0];

    for (const node of label.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) return node;
    }

    return null;
  }

  function cleanRequiredStarFromText(text) {
    return String(text || "").replace(/\s*\*+\s*$/, "").trimEnd();
  }

  function markLabel(label) {
    if (!label) return;

    removeOldInsertedStars(label);

    const textNode = getPrimaryTextNode(label);

    if (textNode) {
      if (!label.dataset.originalLabelText) {
        label.dataset.originalLabelText = cleanRequiredStarFromText(textNode.textContent);
      }

      const base = cleanRequiredStarFromText(label.dataset.originalLabelText || textNode.textContent);
      textNode.textContent = `${base}*`;
      label.classList.add("has-required-field");
      label.setAttribute(MARKED, "true");
      return;
    }

    // Fallback for rare labels with nested text containers only.
    const field = label.querySelector("input, select, textarea");
    const candidate = [...label.children].find((el) => {
      if (el === field) return false;
      if (["INPUT", "SELECT", "TEXTAREA", "BUTTON", "SMALL"].includes(el.tagName)) return false;
      return (el.textContent || "").trim();
    });

    if (candidate) {
      if (!candidate.dataset.originalLabelText) {
        candidate.dataset.originalLabelText = cleanRequiredStarFromText(candidate.textContent);
      }
      const base = cleanRequiredStarFromText(candidate.dataset.originalLabelText || candidate.textContent);
      candidate.textContent = `${base}*`;
      label.classList.add("has-required-field");
      label.setAttribute(MARKED, "true");
    }
  }

  function unmarkLabel(label) {
    if (!label) return;

    removeOldInsertedStars(label);

    const textNode = getPrimaryTextNode(label);
    if (textNode && label.dataset.originalLabelText) {
      textNode.textContent = label.dataset.originalLabelText;
    } else if (textNode) {
      textNode.textContent = cleanRequiredStarFromText(textNode.textContent);
    }

    [...label.children].forEach((el) => {
      if (el.dataset?.originalLabelText) {
        el.textContent = el.dataset.originalLabelText;
        delete el.dataset.originalLabelText;
      }
    });

    label.classList.remove("has-required-field");
    label.removeAttribute(MARKED);
  }

  function labelStillHasRequiredField(label) {
    if (!label) return false;

    const fields = [...label.querySelectorAll("input, select, textarea")];
    if (fields.some(isRequiredField)) return true;

    const forId = label.getAttribute("for");
    const linked = forId ? document.getElementById(forId) : null;
    return isRequiredField(linked);
  }

  function removeRequiredLegends(root = document) {
    root.querySelectorAll(".required-field-legend").forEach((el) => el.remove());
    root.querySelectorAll("form[data-required-legend-added]").forEach((form) => {
      delete form.dataset.requiredLegendAdded;
    });
  }

  function refreshRequiredMarkers(root = document) {
    removeRequiredLegends(root);

    // First clean labels that are no longer required.
    root.querySelectorAll("label.has-required-field").forEach((label) => {
      if (!labelStillHasRequiredField(label)) unmarkLabel(label);
    });

    // Then apply inline label-text stars.
    [...root.querySelectorAll("input, select, textarea")].forEach((field) => {
      const label = findFieldLabel(field);

      if (isRequiredField(field)) {
        field.setAttribute("aria-required", "true");
        markLabel(label);
      } else if (label && !labelStillHasRequiredField(label)) {
        unmarkLabel(label);
      }
    });
  }

  let pending = false;
  function scheduleRefresh() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      refreshRequiredMarkers(document);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    refreshRequiredMarkers(document);

    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["required", "aria-required", "disabled"]
    });

    document.addEventListener("change", scheduleRefresh, true);
    document.addEventListener("input", scheduleRefresh, true);
  });

  window.refreshRequiredMarkers = () => refreshRequiredMarkers(document);
})();