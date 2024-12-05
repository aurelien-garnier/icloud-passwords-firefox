import { useMemo } from "react";
import browser from "webextension-polyfill";
import styles from "./error.module.scss";

interface Props {
  error: string;
}

export function ErrorView({ error }: Props) {
  const message = useMemo(() => {
    if (error === "AutoFill failed: no password field on page") {
      return (
        <>
          No password field was found on the current page. Make sure you have
          the login form open.
        </>
      );
    } else if (error === "AutoFill failed: no one-time code field on page") {
      return (
        <>
          No one-time code field was found on the current page. Make sure you
          have the login form open.
        </>
      );
    } else if (error === "AutoFill failed: tab is no longer active") {
      return (
        <>
          The tab you were trying to AutoFill on is no longer active. AutoFill
          was cancelled.
        </>
      );
    } else if (error === "AutoFill failed: tab no longer exists") {
      return (
        <>
          The tab you were trying to AutoFill on no longer exists. AutoFill was
          cancelled.
        </>
      );
    } else if (error === "AutoFill failed: tab has changed URL") {
      return (
        <>
          The tab you were trying to AutoFill on changed URL. AutoFill was
          cancelled.
        </>
      );
    } else if (
      error === "Timeout while waiting for response" ||
      error.startsWith("Loading timed out while waiting for ")
    ) {
      return (
        <>
          iCloud Keychain failed to respond in time. Please try reinstalling the
          extension.
        </>
      );
    } else if (
      error === "No such native application com.apple.passwordmanager" ||
      error === "Specified native messaging host not found."
    ) {
      if (
        navigator.platform === "MacIntel" ||
        navigator.userAgent.includes("Intel Mac OS X")
      ) {
        return (
          <>
            This extension requires macOS Sonoma or later to be installed.
            Please upgrade to be able to use this extension.
          </>
        );
      } else {
        let downloadUrl: string | undefined;

        const windowsVersion = /\(Windows\s*\w*\s*(\d+)[._](\d+)/i.exec(
          navigator.userAgent,
        );
        if (windowsVersion !== null && windowsVersion.length === 3) {
          const major = parseInt(windowsVersion?.[1], 10),
            minor = parseInt(windowsVersion?.[2], 10);

          if (major >= 10) {
            // Windows 10+
            downloadUrl = "ms-windows-store://pdp/?productid=9PKTQ5699M62";
          } else if (major >= 6 && minor >= 1) {
            // Windows 7-8 (NT 6.1 - 6.3)
            downloadUrl = "https://support.apple.com/kb/DL1455";
          }
        }

        if (downloadUrl !== undefined) {
          return (
            <>
              This extension requires iCloud for Windows to be installed. You
              can download it{" "}
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                here
              </a>
              .<br />
              Then, follow{" "}
              <a
                href="https://github.com/au2001/icloud-passwords-firefox#additional-setup"
                target="_blank"
                rel="noopener noreferrer"
              >
                these instructions
              </a>
              .
            </>
          );
        } else {
          return (
            <>
              This extension requires Windows 10 or later to be installed.
              Please upgrade to be able to use this extension.
            </>
          );
        }
      }
    } else if (
      error === "Access to the specified native messaging host is forbidden."
    ) {
      return (
        <>
          The setup process could not complete successfully. Follow{" "}
          <a
            href="https://github.com/au2001/icloud-passwords-firefox#additional-setup"
            target="_blank"
            rel="noopener noreferrer"
          >
            these instructions
          </a>{" "}
          to use the extension.
        </>
      );
    } else if (error === "Duplicate item in query") {
      return <>An account already exists under that name.</>;
    } else if (error === "Query failed to delete") {
      return <>Could not delete this account.</>;
    } else if (error === "Query failed to update") {
      return <>Could not update this account.</>;
    } else if (error === "No query results") {
      return <>This account could not be found.</>;
    } else if (
      error === "Unsupported capabilities: should use RFC verification" ||
      error === "Invalid server hello: unsupported protocol" ||
      error === "Invalid server hello: unsupported version"
    ) {
      if (
        navigator.platform === "MacIntel" ||
        navigator.userAgent.includes("Intel Mac OS X")
      ) {
        return (
          <>This extension is not yet compatible with your version of macOS.</>
        );
      } else {
        return (
          <>
            This extension is not yet compatible with your version of iCloud for
            Windows.
          </>
        );
      }
    } else if (error.startsWith("URL is not compatible: ")) {
      return <>Passwords cannot be saved on this website.</>;
    } else {
      if (error) console.error(error);
      return (
        <>
          An unknown error occurred. Make sure you have the latest version of
          the extension installed. If the error persists, please try restarting
          Firefox.
        </>
      );
    }
  }, [error]);

  const handleReload = async () => {
    try {
      const { success, error } = await browser.runtime.sendMessage({
        cmd: "LOCK",
      });

      if (error !== undefined || !success) throw error;
    } catch (e) {
      console.error(e);
    }

    window.location.reload();
  };

  return (
    <div className={styles.error}>
      <h1>Error</h1>
      <p>{message}</p>

      <a
        href=""
        onClick={(e) => {
          e.preventDefault();
          handleReload();
        }}
      >
        Retry
      </a>
    </div>
  );
}
