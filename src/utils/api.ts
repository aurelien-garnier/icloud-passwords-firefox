import browser, { Runtime } from "webextension-polyfill";
import { Buffer } from "buffer";
import { EventEmitter } from "events";
import {
  Action,
  Command,
  MSGTypes,
  QueryStatus,
  SecretSessionVersion,
} from "./enums";
import { SRPSession } from "./srp";
import {
  readBigInt,
  throwQueryStatusError,
  toBase64,
  toBuffer,
} from "./crypto";

const BROWSER_NAME = "Firefox";
const VERSION = "1.0";

export class ApplePasswordManager extends EventEmitter {
  private port?: Runtime.Port;
  private session?: SRPSession;
  private challengeTimestamp = 0;

  get ready() {
    return (
      this.port !== undefined &&
      this.session !== undefined &&
      this.session.serverPublicKey !== undefined &&
      this.session.salt !== undefined &&
      this.session.sharedKey !== undefined
    );
  }

  private async _postMessage<T extends Command, R = any>(
    cmd: T,
    body: object = {},
    delay: number | null = 5000,
  ) {
    if (this.port === undefined)
      throw new Error("Invalid session state: connection closed");

    const response = new Promise<R | undefined>((resolve, reject) => {
      let timeout: NodeJS.Timeout | undefined;

      const cleanup = () => {
        clearTimeout(timeout);
        this.removeListener("message", onMessage);
        this.removeListener("error", onError);
      };

      const onMessage = (message: any) => {
        if (message.cmd !== cmd) return;
        cleanup();
        return resolve(message);
      };

      const onError = (
        error?:
          | browser.Runtime.PortErrorType
          | browser.Runtime.PropertyLastErrorType,
      ) => {
        cleanup();
        return reject(error);
      };

      this.addListener("message", onMessage);
      this.addListener("error", onError);

      if (delay !== null) {
        timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Timeout while waiting for response"));
        }, delay);
      }
    });

    this.port.postMessage({
      cmd,
      ...body,
    });

    return await response;
  }

  async connect() {
    if (this.port === undefined) {
      this.port = browser.runtime.connectNative("com.apple.passwordmanager");

      this.port?.onMessage.addListener((message, port) => {
        if (this.port !== port) return;

        this.emit("message", message);
      });

      this.port?.onDisconnect.addListener((port) => {
        if (this.port !== port) return;

        this.emit("error", port.error ?? browser.runtime.lastError);

        delete this.port;
      });

      delete this.session;
      this.challengeTimestamp = 0;
    }

    if (this.session === undefined) {
      const { capabilities } = await this._postMessage(
        Command.GET_CAPABILITIES,
      );

      if (
        capabilities.secretSessionVersion !== undefined &&
        capabilities.secretSessionVersion !==
          SecretSessionVersion.SRP_WITH_RFC_VERIFICATION
      ) {
        throw new Error(
          "Unsupported capabilities: should use RFC verification",
        );
      }

      this.session = await SRPSession.new(capabilities.shouldUseBase64);
    }
  }

  async requestChallenge() {
    if (this.session === undefined)
      throw new Error("Invalid session state: not initialized");

    // Allow to reopen the popup on Windows less than 5s after requesting a challenge
    const challengeTimestamp = Date.now();
    if (this.challengeTimestamp >= challengeTimestamp - 5 * 1000) return;
    this.challengeTimestamp = challengeTimestamp;

    delete this.session.serverPublicKey;
    delete this.session.salt;
    delete this.session.sharedKey;

    const { payload } = await this._postMessage(Command.HANDSHAKE, {
      msg: {
        QID: "m0",
        PAKE: toBase64({
          TID: this.session.username,
          MSG: MSGTypes.CLIENT_KEY_EXCHANGE,
          A: this.session.serialize(toBuffer(this.session.clientPublicKey)),
          VER: VERSION,
          PROTO: [SecretSessionVersion.SRP_WITH_RFC_VERIFICATION],
        }),
        HSTBRSR: BROWSER_NAME,
      },
    });

    let pake;
    try {
      pake = JSON.parse(Buffer.from(payload.PAKE, "base64").toString("utf8"));
    } catch (e) {
      throw new Error("Invalid server hello: missing payload");
    }

    if (pake.TID !== this.session.username)
      throw new Error("Invalid server hello: destined to another session");

    switch (pake.ErrCode) {
      case undefined:
        break;

      default:
        throw new Error(`Invalid server hello: error code ${pake.ErrCode}`);
    }

    // macOS sends this as a number, but iCloud for Windows as a string
    if (pake.MSG.toString() !== MSGTypes.SERVER_KEY_EXCHANGE.toString())
      throw new Error("Invalid server hello: unexpected message");

    if (pake.PROTO !== SecretSessionVersion.SRP_WITH_RFC_VERIFICATION)
      throw new Error("Invalid server hello: unsupported protocol");

    if ("VER" in pake && pake.VER !== VERSION)
      throw new Error("Invalid server hello: unsupported version");

    const serverPublicKey = readBigInt(this.session.deserialize(pake.B));
    const salt = readBigInt(this.session.deserialize(pake.s));
    this.session.setServerPublicKey(serverPublicKey, salt);
  }

  async verifyChallenge(password: string) {
    if (this.session === undefined)
      throw new Error("Invalid session state: not initialized");

    // Allow requesting a new challenge instantly
    this.challengeTimestamp = 0;

    try {
      await this.session.setSharedKey(password);

      const m = await this.session.computeM();

      const { payload } = await this._postMessage(Command.HANDSHAKE, {
        msg: {
          QID: "m2",
          PAKE: toBase64({
            TID: this.session.username,
            MSG: MSGTypes.CLIENT_VERIFICATION,
            M: this.session.serialize(m, false),
          }),
        },
      });

      let pake;
      try {
        pake = JSON.parse(Buffer.from(payload.PAKE, "base64").toString("utf8"));
      } catch (e) {
        throw new Error("Invalid server verification: missing payload");
      }

      if (pake.TID !== this.session.username) {
        throw new Error(
          "Invalid server verification: destined to another session",
        );
      }

      // macOS sends this as a number, but iCloud for Windows as a string
      if (pake.MSG.toString() !== MSGTypes.SERVER_VERIFICATION.toString())
        throw new Error("Invalid server verification: unexpected message");

      switch (pake.ErrCode) {
        case 0:
          break;

        case 1:
          throw new Error("Incorrect challenge PIN");

        default:
          throw new Error(
            `Invalid server verification: error code ${pake.ErrCode}`,
          );
      }

      const hmac = await this.session.computeHMAC(m);
      if (readBigInt(this.session.deserialize(pake.HAMK)) !== readBigInt(hmac))
        throw new Error("Invalid server verification: HAMK mismatch");
    } catch (e) {
      delete this.session.sharedKey;
      throw e;
    }
  }

  async sendActiveTab(tabId: number, active: boolean) {
    await this._postMessage(Command.TAB_EVENT, {
      tabId,
      event: active ? 1 : 0,
    });
  }

  async listLoginNamesForURL(tabId: number, url: string) {
    if (this.session === undefined)
      throw new Error("Invalid session state: not initialized");

    const { hostname } = new URL(url);

    const sdata = this.session.serialize(
      await this.session.encrypt({
        ACT: Action.GHOST_SEARCH,
        URL: hostname,
      }),
    );

    const { payload } = await this._postMessage(
      Command.GET_LOGIN_NAMES_FOR_URL,
      {
        tabId,
        frameId: 0,
        url: hostname,
        payload: {
          QID: "CmdGetLoginNames4URL",
          SMSG: JSON.stringify({
            TID: this.session.username,
            SDATA: sdata,
          }),
        },
      },
    );

    // macOS sends this as an object, Windows as a string
    if (typeof payload.SMSG === "string")
      payload.SMSG = JSON.parse(payload.SMSG);

    if (payload.SMSG.TID !== this.session.username)
      throw new Error("Invalid server response: destined to another session");

    let response;
    try {
      const data = await this.session.decrypt(
        this.session.deserialize(payload.SMSG.SDATA),
      );
      response = JSON.parse(data.toString("utf8"));
    } catch (e) {
      throw new Error("Invalid server response: missing payload");
    }

    switch (response.STATUS) {
      case QueryStatus.SUCCESS:
        return (response.Entries as any[]).map(({ USR, sites }) => ({
          username: USR,
          sites,
        }));

      case QueryStatus.NO_RESULTS:
        return [];

      default:
        throwQueryStatusError(response.STATUS);
    }
  }

  async fetchPasswordForLoginName(
    tabId: number,
    url: string,
    loginName: { username: string; sites: string[] },
  ) {
    if (this.session === undefined)
      throw new Error("Invalid session state: not initialized");

    const { hostname } = new URL(url);

    const sdata = this.session.serialize(
      await this.session.encrypt({
        ACT: Action.SEARCH,
        URL: hostname,
        USR: loginName.username,
      }),
    );

    const { payload } = await this._postMessage(
      Command.GET_PASSWORD_FOR_LOGIN_NAME,
      {
        tabId,
        frameId: 0,
        url: loginName.sites?.[0] ?? hostname,
        payload: {
          QID: "CmdGetPassword4LoginName",
          SMSG: JSON.stringify({
            TID: this.session.username,
            SDATA: sdata,
          }),
        },
      },
      null,
    );

    // macOS sends this as an object, Windows as a string
    if (typeof payload.SMSG === "string")
      payload.SMSG = JSON.parse(payload.SMSG);

    if (payload.SMSG.TID !== this.session.username)
      throw new Error("Invalid server response: destined to another session");

    let response;
    try {
      const data = await this.session.decrypt(
        this.session.deserialize(payload.SMSG.SDATA),
      );
      response = JSON.parse(data.toString("utf8"));
    } catch (e) {
      throw new Error("Invalid server response: missing payload");
    }

    switch (response.STATUS) {
      case QueryStatus.SUCCESS: {
        const { USR, PWD, sites } = response.Entries[0];
        return {
          username: USR,
          password: PWD,
          sites,
        };
      }

      default:
        throwQueryStatusError(response.STATUS);
    }
  }

  async listOneTimeCodes(tabId: number, url: string) {
    if (this.session === undefined)
      throw new Error("Invalid session state: not initialized");

    const sdata = this.session.serialize(
      await this.session.encrypt({
        ACT: Action.GHOST_SEARCH,
        TYPE: "oneTimeCodes",
        frameURLs: [url],
      }),
    );

    const { payload } = await this._postMessage(Command.GET_ONE_TIME_CODES, {
      tabId,
      frameId: 0,
      payload: {
        QID: "CmdGetOneTimeCodes",
        SMSG: JSON.stringify({
          TID: this.session.username,
          SDATA: sdata,
        }),
      },
    });

    // macOS sends this as an object, Windows as a string
    if (typeof payload.SMSG === "string")
      payload.SMSG = JSON.parse(payload.SMSG);

    if (payload.SMSG.TID !== this.session.username)
      throw new Error("Invalid server response: destined to another session");

    let response;
    try {
      const data = await this.session.decrypt(
        this.session.deserialize(payload.SMSG.SDATA),
      );
      response = JSON.parse(data.toString("utf8"));
    } catch (e) {
      throw new Error("Invalid server response: missing payload");
    }

    switch (response.STATUS) {
      case QueryStatus.SUCCESS:
        return (response.Entries as any[]).map(
          ({ username, domain, source, code }) => ({
            username,
            domain,
            source,
            code,
          }),
        );

      case QueryStatus.NO_RESULTS:
        return [];

      default:
        throwQueryStatusError(response.STATUS);
    }
  }

  async fetchOneTimeCode(tabId: number, url: string, username: string) {
    if (this.session === undefined)
      throw new Error("Invalid session state: not initialized");

    const sdata = this.session.serialize(
      await this.session.encrypt({
        ACT: Action.SEARCH,
        TYPE: "oneTimeCodes",
        frameURLs: [url],
        username,
      }),
    );

    const { payload } = await this._postMessage(
      Command.DID_FILL_ONE_TIME_CODE,
      {
        tabId,
        frameId: 0,
        payload: {
          QID: "CmdDidFillOneTimeCode",
          SMSG: JSON.stringify({
            TID: this.session.username,
            SDATA: sdata,
          }),
        },
      },
      null,
    );

    // macOS sends this as an object, Windows as a string
    if (typeof payload.SMSG === "string")
      payload.SMSG = JSON.parse(payload.SMSG);

    if (payload.SMSG.TID !== this.session.username)
      throw new Error("Invalid server response: destined to another session");

    let response;
    try {
      const data = await this.session.decrypt(
        this.session.deserialize(payload.SMSG.SDATA),
      );
      response = JSON.parse(data.toString("utf8"));
    } catch (e) {
      throw new Error("Invalid server response: missing payload");
    }

    switch (response.STATUS) {
      case QueryStatus.SUCCESS: {
        const { username, domain, source, code } = response.Entries[0];
        return {
          username,
          domain,
          source,
          code,
        };
      }

      default:
        throwQueryStatusError(response.STATUS);
    }
  }

  async close() {
    const port = this.port;
    if (port === undefined) return;

    this._postMessage(Command.END);

    await new Promise<void>((resolve) => {
      port.onDisconnect.addListener(() => resolve());
    });
  }
}
