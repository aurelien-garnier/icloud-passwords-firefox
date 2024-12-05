import { useMemo, useState } from "react";
import browser from "webextension-polyfill";
import { LoginName, useLoginNames } from "../shared/hooks/use-login-names";
import { KeyIcon } from "../shared/icons/key";
import { LoadingView } from "../shared/loading";
import { ErrorView } from "../shared/error";
import { Header } from "../shared/header";
import styles from "./suggestions.module.scss";

interface Props {
  url: string;
  isPassword: boolean;
  query: string;
}

export function SuggestionsView({ url, query }: Props) {
  const { loginNames, error } = useLoginNames(-1, url);
  const [fillError, setFillError] = useState<string>();

  const handleFillPassword = async (loginName: LoginName) => {
    setFillError(undefined);

    try {
      const { success, error } = await browser.runtime.sendMessage({
        cmd: "FILL_PASSWORD",
        url,
        loginName,
        forwardToContentScript: true,
      });

      if (error !== undefined || !success) throw error;
    } catch (e: any) {
      setFillError(e.message ?? e.toString());
    }
  };

  const matchingLoginNames = useMemo(
    () =>
      loginNames?.filter((loginName) => loginName.username.startsWith(query)),
    [loginNames, query],
  );

  if (error !== undefined) return <ErrorView error={error} />;
  if (fillError !== undefined) return <ErrorView error={fillError} />;
  if (matchingLoginNames === undefined)
    return <LoadingView action="LIST_LOGIN_NAMES_FOR_URL" />;

  return (
    <>
      <Header />

      <div className={styles.suggestions}>
        {matchingLoginNames.length > 0 ? (
          <ul>
            {matchingLoginNames.map((loginName, i) => (
              <li
                key={i}
                onClick={(e) => {
                  e.preventDefault();
                  handleFillPassword(loginName);
                }}
              >
                <KeyIcon title="Password item" />
                <div>
                  <span>{loginName.username}</span>
                  <span>{loginName.sites[0] ?? ""}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {query === "" ? (
              <>No passwords saved on this website.</>
            ) : (
              <>No matching passwords found for this website.</>
            )}
          </p>
        )}
      </div>
    </>
  );
}
