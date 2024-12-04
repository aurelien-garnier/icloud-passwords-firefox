export interface LoginForm {
  usernameInput: HTMLInputElement | null;
  passwordInput: HTMLInputElement;
  formElement: HTMLFormElement | null;
}

export const isUsernameInput = (input: HTMLInputElement) => {
  if (!["text", "email", undefined].includes(input.type)) return false;
  if (!input.checkVisibility()) return false;

  const types = [
    "email",
    "e-mail",
    "mail",
    "username",
    "user",
    "login",
    "account",
  ];

  const fields = [
    "autocomplete",
    "name",
    "id",
    "className",
    "placeholder",
    "aria-label",
    "ng-model",
  ];

  return fields.some((field) => {
    const value = input.getAttribute(field)?.toLowerCase();
    if (!value) return false;
    return types.some((type) => value.includes(type));
  });
};

export const getLoginForms = () => {
  let passwordInputs = [
    ...document.querySelectorAll<HTMLInputElement>(
      "input[autocomplete=current-password]",
    ),
  ].filter((input) => input.checkVisibility());

  if (passwordInputs.length === 0) {
    passwordInputs = [
      ...document.querySelectorAll<HTMLInputElement>("input[type=password]"),
    ].filter((input) => input.checkVisibility());
  }

  return passwordInputs.map<LoginForm>((passwordInput) => {
    let usernameInput: Element | null = passwordInput;
    const formElement: HTMLFormElement | null = passwordInput.closest("form");
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

    if (!success) {
      usernameInput = null;
    }

    return {
      usernameInput,
      passwordInput,
      formElement
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
