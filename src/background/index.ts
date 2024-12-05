import browser from "webextension-polyfill";
import { ApplePasswordManager } from "../utils/api";

let api: ApplePasswordManager | null = null;
const getAPI = () => (api ??= new ApplePasswordManager());

browser.runtime.onMessage.addListener(async (message, sender) => {
  try {
    switch (message.cmd) {
      case "IS_READY":
        return {
          success: true,
          ready: api?.ready ?? false,
        };

      case "LOCK":
        if (!api?.ready) return false;

        await api.close();
        api = null;

        return {
          success: true,
          locked: true,
        };

      case "REQUEST_CHALLENGE":
        await getAPI().connect();
        await getAPI().requestChallenge();

        try {
          // On Windows, the PIN notification closes the extension popup
          // https://bugzilla.mozilla.org/show_bug.cgi?id=1292701
          // https://bugzilla.mozilla.org/show_bug.cgi?id=1378527
          await browser.action.openPopup();
        } catch (e) {
          // https://bugzilla.mozilla.org/show_bug.cgi?id=1799344
        }

        return {
          success: true,
        };

      case "VERIFY_CHALLENGE":
        await getAPI().verifyChallenge(message.pin);
        return {
          success: true,
        };

      case "LIST_LOGIN_NAMES_FOR_URL":
        return {
          success: true,
          loginNames: await getAPI().listLoginNamesForURL(
            message.tabId,
            message.url,
          ),
        };

      case "FETCH_PASSWORD_FOR_LOGIN_NAME":
        return {
          success: true,
          loginName: await getAPI().fetchPasswordForLoginName(
            message.tabId,
            message.url,
            message.loginName,
          ),
        };

      case "FILL_PASSWORD": {
        const { username, password } = await getAPI().fetchPasswordForLoginName(
          message.tabId ?? sender.tab?.id ?? -1,
          message.url,
          message.loginName,
        );

        const tab = sender.tab ?? (await browser.tabs.get(message.tabId));
        if (tab.id === undefined)
          throw new Error("AutoFill failed: tab no longer exists");
        if (!tab.active)
          throw new Error("AutoFill failed: tab is no longer active");
        if (tab.url !== message.url)
          throw new Error("AutoFill failed: tab has changed URL");

        if (message.forwardToContentScript) {
          const { success, warnings } = await browser.tabs.sendMessage(tab.id, {
            cmd: "FILL_PASSWORD",
            username,
            password,
          });

          (warnings as string[]).forEach((warning) => console.warn(warning));

          return {
            success,
            warnings,
          };
        } else {
          await browser.scripting.executeScript({
            target: {
              tabId: tab.id,
            },
            files: ["./fill_password.js"],
          });

          const [{ result, error }] = await browser.scripting.executeScript({
            target: {
              tabId: tab.id,
            },
            func: (username, password) =>
              window.iCPFillPassword(username, password),
            args: [username, password],
          });

          if (error !== undefined) throw error;

          const { success, warnings } = result;
          (warnings as string[]).forEach((warning) => console.warn(warning));

          return {
            success,
            warnings,
          };
        }
      }

      case "COPY_PASSWORD": {
        const { password } = await getAPI().fetchPasswordForLoginName(
          message.tabId,
          message.url,
          message.loginName,
        );

        await navigator.clipboard.writeText(password);

        return {
          success: true,
        };
      }

      case "LIST_ONE_TIME_CODES":
        return {
          success: true,
          oneTimeCodes: await getAPI().listOneTimeCodes(
            message.tabId,
            message.url,
          ),
        };

      case "FETCH_ONE_TIME_CODE":
        return {
          success: true,
          oneTimeCode: await getAPI().fetchOneTimeCode(
            message.tabId,
            message.url,
            message.oneTimeCode.username,
          ),
        };

      case "FILL_ONE_TIME_CODE": {
        const { username, code } = await getAPI().fetchOneTimeCode(
          message.tabId ?? sender.tab?.id ?? -1,
          message.url,
          message.loginName,
        );

        const tab = sender.tab ?? (await browser.tabs.get(message.tabId));
        if (tab.id === undefined)
          throw new Error("AutoFill failed: tab no longer exists");
        if (!tab.active)
          throw new Error("AutoFill failed: tab is no longer active");
        if (tab.url !== message.url)
          throw new Error("AutoFill failed: tab has changed URL");

        if (message.forwardToContentScript) {
          const { success, warnings } = await browser.tabs.sendMessage(tab.id, {
            cmd: "FILL_ONE_TIME_CODE",
            username,
            code,
          });

          (warnings as string[]).forEach((warning) => console.warn(warning));

          return {
            success,
            warnings,
          };
        } else {
          await browser.scripting.executeScript({
            target: {
              tabId: tab.id,
            },
            files: ["./fill_one_time_code.js"],
          });

          const [{ result, error }] = await browser.scripting.executeScript({
            target: {
              tabId: tab.id,
            },
            func: (username, code) => window.iCPFillOneTimeCode(username, code),
            args: [username, code],
          });

          if (error !== undefined) throw error;

          const { success, warnings } = result;
          (warnings as string[]).forEach((warning) => console.warn(warning));

          return {
            success,
            warnings,
          };
        }
      }

      case "COPY_ONE_TIME_CODE": {
        const { code } = await getAPI().fetchOneTimeCode(
          message.tabId,
          message.url,
          message.loginName,
        );

        await navigator.clipboard.writeText(code);

        return {
          success: true,
        };
      }
    }
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: e,
    };
  }
});

browser.runtime.onSuspend.addListener(() => {
  api?.close();
  api = null;
});

const updateContentScript = async () => {
  const { settings } = await browser.storage.sync.get("settings");
  const { permissions, origins } = await browser.permissions.getAll();

  try {
    if (
      settings.inPage &&
      permissions?.includes("tabs") &&
      origins?.includes("<all_urls>")
    ) {
      await browser.scripting.registerContentScripts([
        {
          id: "content_script",
          js: ["content_script.js"],
          matches: ["<all_urls>"],
          runAt: "document_idle",
          allFrames: true,
        },
      ]);
    } else {
      await browser.scripting.unregisterContentScripts({
        ids: ["content_script"],
      });
    }
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message ===
        'Content script with id "content_script" is already registered.' ||
        e.message === 'Content script with id "content_script" does not exist.')
    ) {
      return;
    }

    throw e;
  }
};

updateContentScript();
browser.storage.sync.onChanged.addListener(updateContentScript);
browser.permissions.onAdded.addListener(updateContentScript);
browser.permissions.onRemoved.addListener(updateContentScript);
