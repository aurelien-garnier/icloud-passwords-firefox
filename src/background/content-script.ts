import browser from "webextension-polyfill";
import { LoginForm, fillLoginForm, getLoginForms } from "../utils/dom";
import { throttle } from "../utils/timings";

const observing = new Map<HTMLInputElement, () => void>();

const observe = (input: HTMLInputElement, form: LoginForm) => {
  let iframe: HTMLIFrameElement | undefined;

  const getSource = () => {
    const params = new URLSearchParams();
    params.set(
      "u",
      window === window.top ? window.location.href : document.referrer,
    );
    params.set("p", input === form.passwordInput ? "1" : "0");

    const query = form.usernameInput?.value ?? "";
    if (query !== "") params.set("q", query);

    return `${browser.runtime.getURL("./in_page.html")}#${params.toString()}`;
  };

  const destroy = () => {
    iframe?.remove();
    iframe = undefined;
  };

  const onFocus = () => {
    if (iframe !== undefined) {
      iframe.src = getSource();
      return;
    }

    iframe = document.createElement("iframe");
    iframe.src = getSource();

    const style = {
      "z-index": "2147483647",
      position: "absolute",
      top: `${input.offsetTop + input.offsetHeight}px`,
      left: `${input.offsetLeft}px`,
      width: `${Math.max(input.offsetWidth, 300)}px`,
      height: "180px",
      border: "none",
      "border-radius": "8px",
      display: "none",
    };

    for (const [property, value] of Object.entries(style))
      iframe.style.setProperty(property, value, "important");

    iframe.addEventListener("load", function () {
      this.style.removeProperty("display");
    });
    input.insertAdjacentElement("afterend", iframe);
  };

  const onInput = () => {
    if (input === form.passwordInput && input.value !== "") destroy();
    else onFocus();
  };

  const onKeyPress = (event: KeyboardEvent) => {
    if (event.key === "Escape") destroy();
  };

  const onBlur = () => {
    setTimeout(() => {
      if (
        document.hasFocus() &&
        (document.activeElement === input || document.activeElement === iframe)
      ) {
        return;
      }

      destroy();
    });
  };

  const onMessage = async (message: any) => {
    if (iframe === undefined) return;

    switch (message.cmd) {
      case "FILL_PASSWORD": {
        const { username, password } = message;
        const warnings = fillLoginForm(form, username, password);
        destroy();

        return {
          success: true,
          warnings,
        };
      }

      case "FILL_ONE_TIME_CODE": {
        const { username, code } = message;
        const warnings = fillLoginForm(form, username, code);
        destroy();

        return {
          success: true,
          warnings,
        };
      }
    }
  };

  if (input === document.activeElement) onFocus();

  input.addEventListener("focus", onFocus);
  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onKeyPress);
  window.addEventListener("focus", onBlur, true);
  window.addEventListener("blur", onBlur, true);
  window.addEventListener("click", onBlur, true);
  browser.runtime.onMessage.addListener(onMessage);

  // Disable Firefox's native autocomplete
  input.setAttribute("autocomplete", "off");

  const cleanup = () => {
    destroy();
    input.removeEventListener("focus", onFocus);
    input.removeEventListener("input", onInput);
    input.removeEventListener("keydown", onKeyPress);
    window.removeEventListener("focus", onBlur, true);
    window.removeEventListener("blur", onBlur, true);
    window.removeEventListener("click", onBlur, true);
    browser.runtime.onMessage.removeListener(onMessage);
  };
  observing.set(input, cleanup);
};

const refresh = throttle(() => {
  const forms = getLoginForms();

  const oldInputs = new Map(observing);
  for (const form of forms) {
    if (form.usernameInput !== null && !oldInputs.delete(form.usernameInput))
      observe(form.usernameInput, form);

    if (!oldInputs.delete(form.passwordInput))
      observe(form.passwordInput, form);
  }

  for (const [input, cleanup] of [...oldInputs.entries()]) {
    observing.delete(input);
    cleanup();
  }
});

refresh();

new MutationObserver(() => refresh()).observe(document.body, {
  subtree: true,
  childList: true,
});
