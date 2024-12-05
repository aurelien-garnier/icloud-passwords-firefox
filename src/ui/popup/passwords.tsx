import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import browser from "webextension-polyfill";
import { HomeContext } from "./home";
import { LoginName } from "../shared/hooks/use-login-names";
import { ErrorView } from "../shared/error";
import { CopyIcon } from "../shared/icons/copy";
import styles from "./passwords.module.scss";

export function PasswordsView() {
  const { tab, loginNames } = useOutletContext<HomeContext>();
  const [fillError, setFillError] = useState<string>();

  const handleFillPassword = async (
    loginName: LoginName,
    action: "FILL" | "COPY" = "FILL",
  ) => {
    if (tab?.id === undefined || tab?.url === undefined) return;

    setFillError(undefined);

    try {
      // Can't use FETCH_PASSWORD_FOR_LOGIN_NAME here
      // See https://bugzilla.mozilla.org/show_bug.cgi?id=1292701
      const { success, error } = await browser.runtime.sendMessage({
        cmd: `${action}_PASSWORD`,
        tabId: tab.id,
        url: tab.url,
        loginName,
      });

      if (error !== undefined || !success) throw error;

      window.close();
    } catch (e: any) {
      setFillError(e.message ?? e.toString());
    }
  };

  if (fillError !== undefined) return <ErrorView error={fillError} />;

  return (
    <div className={styles.passwords}>
      {loginNames.length > 0 ? (
        <>
          <h2>Select an account to login with:</h2>

          <ul>
            {loginNames.map((loginName, i) => (
              <li
                key={i}
                onClick={(e) => {
                  e.preventDefault();
                  handleFillPassword(loginName);
                }}
              >
                <div>
                  <span>{loginName.username}</span>
                  <span>{loginName.sites[0] ?? ""}</span>
                </div>
                <a
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFillPassword(loginName, "COPY");
                  }}
                >
                  <CopyIcon title="Copy password to clipboard" />
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>
          <br />
          No passwords saved on this website.
          <br />
          <br />
        </p>
      )}

      <hr />

      <p>
        <Link to="/generate">Create Strong Password...</Link>
      </p>
    </div>
  );
}
