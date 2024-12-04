//go:build windows

package main

import (
	"golang.org/x/sys/windows/registry"
)

var CHROME_MANIFEST_KEYS = []struct {
	registry.Key
	string
}{
	{registry.LOCAL_MACHINE, `SOFTWARE\Google\Chrome\NativeMessagingHosts\`},
	{registry.LOCAL_MACHINE, `SOFTWARE\Chromium\NativeMessagingHosts\`},
	{registry.LOCAL_MACHINE, `SOFTWARE\WOW6432Node\Google\Chrome\NativeMessagingHosts\`},
	{registry.LOCAL_MACHINE, `SOFTWARE\WOW6432Node\Chromium\NativeMessagingHosts\`},
	{registry.CURRENT_USER, `SOFTWARE\Google\Chrome\NativeMessagingHosts\`},
	{registry.CURRENT_USER, `SOFTWARE\Chromium\NativeMessagingHosts\`},
}

var FIREFOX_MANIFEST_KEYS = []struct {
	registry.Key
	string
}{
	{registry.LOCAL_MACHINE, `SOFTWARE\Mozilla\NativeMessagingHosts\`},
	{registry.LOCAL_MACHINE, `SOFTWARE\WOW6432Node\WOW6432Node\NativeMessagingHosts\`},
	{registry.CURRENT_USER, `SOFTWARE\Mozilla\NativeMessagingHosts\`},
}

func getWindowsManifestPaths(keys []struct {
	registry.Key
	string
}) []string {
	paths := []string{}

	for _, key := range keys {
		k, err := registry.OpenKey(key.Key, key.string+NATIVE_MESSAGING_HOST, registry.QUERY_VALUE)
		if err != nil {
			continue
		}
		defer k.Close()

		path, _, err := k.GetStringValue("")
		if err != nil {
			continue
		}

		paths = append(paths, path)
	}

	return paths
}

func GetChromeManifestPaths() []string {
	return getWindowsManifestPaths(CHROME_MANIFEST_KEYS)
}

func GetFirefoxManifestPaths() []string {
	return append(
		[]string{`C:\ProgramData\Mozilla Firefox\FirefoxPwdMgrHostApp_manifest.json`},
		getWindowsManifestPaths(FIREFOX_MANIFEST_KEYS)...,
	)
}

func RegisterFirefoxManifestPath(path string) error {
	key := FIREFOX_MANIFEST_KEYS[0]

	k, _, err := registry.CreateKey(key.Key, key.string+NATIVE_MESSAGING_HOST, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()

	err = k.SetStringValue("", path)
	if err != nil {
		return err
	}

	return nil
}
