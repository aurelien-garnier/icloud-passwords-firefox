import { fillLoginForm, getLoginForms } from "../utils/dom";

declare global {
  interface Window {
    iCPFillOneTimeCode: (
      username: string,
      code: string,
    ) => Promise<{ success: true; warnings: string[] }>;
  }
}

window.iCPFillOneTimeCode = async (username, code) => {
  const warnings: string[] = [];

  const forms = getLoginForms();

  if (forms.length === 0) {
    throw new Error("AutoFill failed: no one-time code field on page");
  } else if (forms.length > 1) {
    warnings.push(
      "Multiple one-time codes detected on page, only filling the last",
    );
  }

  warnings.push(...fillLoginForm(forms[forms.length - 1], username, code));

  return {
    success: true,
    warnings,
  };
};
