import browser from "webextension-polyfill";
import { LoginForm, fillLoginForm, getLoginForms } from "../utils/dom";
import { throttle } from "../utils/timings";

const observing = new Map<HTMLInputElement, () => void>();

const observe = (input: HTMLInputElement, form: LoginForm) => {
  let iframe: HTMLIFrameElement | undefined;

  const getSource = () => {
    const params = new URLSearchParams();
    params.set("u", window.location.href);
    params.set("p", input === form.passwordInput ? "1" : "0");

    const query = form.usernameInput?.value ?? "";
    if (query !== "") params.set("q", query);

    return `${browser.runtime.getURL("./in_page.html")}#${params.toString()}`;
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
    if (input === form.passwordInput && input.value !== "") onBlur();
    else onFocus();
  };

  const onKeyPress = (event: KeyboardEvent) => {
    if (event.key === "Escape") onBlur();
  };

  const onBlur = () => {
    iframe?.remove();
    iframe = undefined;
  };

  const onMessage = async (message: any) => {
    if (iframe === undefined) return;

    switch (message.cmd) {
      case "FILL_PASSWORD": {
        const { username, password } = message;
        const warnings = fillLoginForm(form, username, password);
        onBlur();

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
  input.addEventListener("blur", onBlur);
  browser.runtime.onMessage.addListener(onMessage);

  // Disable Firefox's native autocomplete
  input.setAttribute("autocomplete", "off");

  const cleanup = () => {
    onBlur();
    input.removeEventListener("focus", onFocus);
    input.removeEventListener("input", onInput);
    input.removeEventListener("keydown", onKeyPress);
    input.removeEventListener("blur", onBlur);
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
