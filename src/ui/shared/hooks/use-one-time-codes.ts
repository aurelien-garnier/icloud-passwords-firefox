import { useEffect, useState } from "react";
import browser from "webextension-polyfill";

export interface OneTimeCode {
  username: string;
  domain: string;
  source: string;
  code: string | null;
}

export const useOneTimeCodes = (tabId?: number, url?: string) => {
  const [oneTimeCodes, setOneTimeCodes] = useState<OneTimeCode[]>();
  const [error, setError] = useState<string>();

  const refetch = async () => {
    setOneTimeCodes(undefined);
    setError(undefined);

    if (tabId === undefined || url === undefined) return;
    if (url === "" || new URL(url).hostname === "") return;

    try {
      const { success, oneTimeCodes, error } =
        await browser.runtime.sendMessage({
          cmd: "LIST_ONE_TIME_CODES",
          tabId,
          url,
        });

      if (error !== undefined || !success) throw error;

      setOneTimeCodes(oneTimeCodes);
    } catch (e: any) {
      setError(e.message ?? e.toString());
    }
  };

  useEffect(() => {
    if (tabId === undefined || url === undefined) return;

    // Refresh one time codes list every time the URL changes
    refetch();
  }, [tabId, url]);

  return { oneTimeCodes, error, refetch };
};
