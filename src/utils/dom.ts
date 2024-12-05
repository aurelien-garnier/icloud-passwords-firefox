export interface LoginForm {
  usernameInput: HTMLInputElement | null;
  passwordInput: HTMLInputElement;
}

const LOOKUP_FIELDS = [
  "autocomplete",
  "name",
  "id",
  "className",
  "placeholder",
  "aria-label",
  "ng-model",
];

export const isPasswordInput = (input: HTMLInputElement) => {
  if (!input.checkVisibility()) return false;
  if (input.type !== "password") return false;
  if (input.autocomplete === "new-password") return false;

  return true;
};

export const isOneTimeCodeInput = (input: HTMLInputElement) => {
  if (!input.checkVisibility()) return false;
  if (!["text", "number", undefined].includes(input.type)) return false;

  const keywords = [
    "one-time",
    "onetime",
    "one_time",
    "one time",
    "two-factor",
    "twofactor",
    "two_factor",
    "two factor",
    "2-factor",
    "2factor",
    "2_factor",
    "2 factor",
    "2fa",
    "otp",
  ];

  return LOOKUP_FIELDS.some((field) => {
    const value = input.getAttribute(field)?.toLowerCase();
    if (!value) return false;
    return keywords.some((keyword) => value.includes(keyword));
  });
};

export const isUsernameInput = (input: HTMLInputElement) => {
  if (!input.checkVisibility()) return false;
  if (!["text", "email", undefined].includes(input.type)) return false;

  const keywords = [
    "email",
    "e-mail",
    "mail",
    "username",
    "user",
    "login",
    "account",
  ];

  return LOOKUP_FIELDS.some((field) => {
    const value = input.getAttribute(field)?.toLowerCase();
    if (!value) return false;
    return keywords.some((keyword) => value.includes(keyword));
  });
};

export const getLoginForms = () => {
  const passwordInputs = [...document.querySelectorAll("input")].filter(
    (input) => isPasswordInput(input) || isOneTimeCodeInput(input),
  );

  return passwordInputs.map<LoginForm>((passwordInput) => {
    let usernameInput: Element | null = passwordInput;
    let success = false;
    outer: do {
      if (usernameInput.lastElementChild !== null) {
        usernameInput = usernameInput.lastElementChild;
        continue;
      }

      while (usernameInput.previousElementSibling === null) {
        usernameInput = usernameInput.parentElement;
        if (usernameInput === null) break outer;
      }

      usernameInput = usernameInput.previousElementSibling;
    } while (
      usernameInput.tagName !== "INPUT" ||
      !(usernameInput instanceof HTMLInputElement) ||
      !(
        (success = isUsernameInput(usernameInput)) ||
        passwordInputs.includes(usernameInput)
      )
    );

    if (!success) usernameInput = null;

    return {
      usernameInput,
      passwordInput,
    };
  });
};

// Necessary for some JS libraries like React to detect the value correctly
// See https://stackoverflow.com/a/46012210
export const setNativeValue = (input: HTMLInputElement, value: string) => {
  input.value = value;

  // React <= 15.5
  input.dispatchEvent(
    Object.assign(new InputEvent("input", { bubbles: true }), {
      simulated: true,
      value,
    }),
  );

  // React >= 15.6
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  nativeInputValueSetter?.call(input, value);

  input.dispatchEvent(new Event("change", { bubbles: true }));

  // Angular
  input.dispatchEvent(new Event("blur", { bubbles: true }));
};

export const fillLoginForm = (
  { usernameInput, passwordInput }: LoginForm,
  username: string,
  password: string,
) => {
  const warnings: string[] = [];

  if (usernameInput !== null) setNativeValue(usernameInput, username);
  else warnings.push("No username field found on page");

  setNativeValue(passwordInput, password);

  usernameInput?.blur();
  passwordInput.blur();

  return warnings;
};
