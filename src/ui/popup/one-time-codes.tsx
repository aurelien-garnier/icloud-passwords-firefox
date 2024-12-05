import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import browser from "webextension-polyfill";
import { HomeContext } from "./home";
import { OneTimeCode } from "../shared/hooks/use-one-time-codes";
import { ErrorView } from "../shared/error";
import { CopyIcon } from "../shared/icons/copy";
import styles from "./one-time-codes.module.scss";

export function OneTimeCodesView() {
  const navigate = useNavigate();
  const { tab, oneTimeCodes } = useOutletContext<HomeContext>();
  const [fillError, setFillError] = useState<string>();

  const hasOneTimeCode = oneTimeCodes.length !== 0;

  useEffect(() => {
    if (hasOneTimeCode) return;
    navigate("/");
  }, [hasOneTimeCode]);

  const handleFillOneTimeCode = async (
    oneTimeCode: OneTimeCode,
    action: "FILL" | "COPY" = "FILL",
  ) => {
    if (tab?.id === undefined || tab?.url === undefined) return;

    setFillError(undefined);

    try {
      // Can't use FETCH_ONE_TIME_CODE here
      // See https://bugzilla.mozilla.org/show_bug.cgi?id=1292701
      const { success, error } = await browser.runtime.sendMessage({
        cmd: `${action}_ONE_TIME_CODE`,
        tabId: tab.id,
        url: tab.url,
        oneTimeCode,
      });

      if (error !== undefined || !success) throw error;

      window.close();
    } catch (e: any) {
      setFillError(e.message ?? e.toString());
    }
  };

  if (fillError !== undefined) return <ErrorView error={fillError} />;

  if (!hasOneTimeCode) return null;

  return (
    <div className={styles.oneTimeCodes}>
      <h2>Select a verification code to use:</h2>

      <ul>
        {oneTimeCodes.map((oneTimeCode, i) => (
          <li
            key={i}
            onClick={(e) => {
              e.preventDefault();
              handleFillOneTimeCode(oneTimeCode);
            }}
          >
            <div>
              <span>{oneTimeCode.username}</span>
              <span>{oneTimeCode.domain}</span>
            </div>
            <a
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleFillOneTimeCode(oneTimeCode, "COPY");
              }}
            >
              <CopyIcon title="Copy one-time code to clipboard" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
