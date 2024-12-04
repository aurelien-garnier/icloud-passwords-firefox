package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"slices"
)

const (
	NATIVE_MESSAGING_HOST = "com.apple.passwordmanager"
	EXTENSION_ID          = "password-manager-firefox-extension@apple.com"
)

func main() {
	// Arguments
	var customFirefoxManifest string

	flag.StringVar(&customFirefoxManifest, "manifest-path", "", "Specify a manifest location to register the extension with.")
	flag.Parse()

	// If a custom manifest path is specified, use it instead of the default one
	firefoxManifests := []string{customFirefoxManifest}
	if customFirefoxManifest == "" {
		firefoxManifests = GetFirefoxManifestPaths()
	}

	for _, manifestPath := range firefoxManifests {
		manifest, err := ReadManifest(manifestPath)
		if err != nil {
			continue
		}

		if slices.Contains(manifest.AllowedExtensions, EXTENSION_ID) {
			fmt.Printf("Firefox native messaging host already setup at %s\n", manifestPath)
			return
		}

		manifest.AllowedExtensions = append(manifest.AllowedExtensions, EXTENSION_ID)
		err = manifest.Register(manifestPath)
		if err != nil {
			fmt.Printf("Failed to update Firefox native messaging host manifest at %s: %s\n", manifestPath, err)
			os.Exit(1)
		}

		fmt.Printf("Successfully updated Firefox native messaging host manifest at %s\n", manifestPath)
		return
	}

	if len(firefoxManifests) == 0 {
		fmt.Printf("Couldn't find any Firefox native messaging host manifest path to use\n")
		os.Exit(2)
	}

	for _, manifestPath := range GetChromeManifestPaths() {
		manifest, err := ReadManifest(manifestPath)
		if err != nil {
			continue
		}

		manifest.Path = filepath.Join(filepath.Dir(manifestPath), manifest.Path)
		manifest.AllowedOrigins = nil
		manifest.AllowedExtensions = []string{EXTENSION_ID}

		err = manifest.Register(firefoxManifests[0])
		if err != nil {
			fmt.Printf("Failed to register Firefox native messaging host manifest at %s: %s\n", firefoxManifests[0], err)
			os.Exit(3)
		}

		fmt.Printf("Successfully registered Firefox native messaging host manifest at %s\n", firefoxManifests[0])
		return
	}

	fmt.Println("No Firefox/Chrome native messaging host manifest found")
	os.Exit(4)
}
