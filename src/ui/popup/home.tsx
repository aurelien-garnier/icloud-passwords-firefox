import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import browser from "webextension-polyfill";
import { useCurrentTab } from "../shared/hooks/use-current-tab";
import { LoginName, useLoginNames } from "../shared/hooks/use-login-names";
import {
  OneTimeCode,
  useOneTimeCodes,
} from "../shared/hooks/use-one-time-codes";
import { LoadingView } from "../shared/loading";
import { ErrorView } from "../shared/error";
import { Header } from "../shared/header";
import styles from "./home.module.scss";

export interface HomeContext {
  tab?: browser.Tabs.Tab;
  loginNames: LoginName[];
  oneTimeCodes: OneTimeCode[];
}

export function HomeView() {
  const tab = useCurrentTab();
  const { loginNames, error: loginNamesError } = useLoginNames(
    tab?.id,
    tab?.url,
  );
  const { oneTimeCodes, error: oneTimeCodesError } = useOneTimeCodes(
    tab?.id,
    tab?.url,
  );
  const [lockError, setLockError] = useState<string>();

  const handleLock = async () => {
    setLockError(undefined);

    try {
      const { success, error } = await browser.runtime.sendMessage({
        cmd: "LOCK",
      });

      if (error !== undefined || !success) throw error;

      // We don't want to show the challenge view right away, so we close the extension instead
      // Next time the user opens the extension, they will see the challenge view automatically
      window.close();
    } catch (e: any) {
      setLockError(e.message ?? e.toString());
    }
  };

  if (loginNamesError !== undefined)
    return <ErrorView error={loginNamesError} />;
  if (oneTimeCodesError !== undefined)
    return <ErrorView error={oneTimeCodesError} />;
  if (lockError !== undefined) return <ErrorView error={lockError} />;
  if (tab?.id === undefined || tab?.url === undefined)
    return <LoadingView action="CURRENT_TAB" />;
  if (new URL(tab.url).hostname === "")
    return <ErrorView error={`URL is not compatible: ${tab.url}`} />;
  if (loginNames === undefined)
    return <LoadingView action="LIST_LOGIN_NAMES_FOR_URL" />;

  const context: HomeContext = {
    tab,
    loginNames,
    oneTimeCodes: oneTimeCodes ?? [],
  };

  return (
    <div className={styles.home}>
      <Header sticky actionLabel="Lock" action={handleLock} />

      {oneTimeCodes !== undefined && oneTimeCodes.length !== 0 && (
        <nav>
          <NavLink
            to="/"
            className={({ isActive }) => (isActive ? styles.active : "")}
          >
            Passwords
          </NavLink>
          <NavLink
            to="/otc"
            className={({ isActive }) => (isActive ? styles.active : "")}
          >
            One-Time Codes
          </NavLink>
        </nav>
      )}

      <Outlet context={context} />
    </div>
  );
}
