package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/jolestar/holon/pkg/runtime/docker"
	"github.com/spf13/cobra"
)

var specPath string
var adapterImage string
var workspacePath string
var contextPath string
var outDir string
var envVarsList []string

var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Run a Holon execution unit",
	Run: func(cmd *cobra.Command, args []string) {
		if specPath == "" {
			fmt.Println("Error: --spec is required")
			os.Exit(1)
		}

		ctx := context.Background()
		rt, err := docker.NewRuntime()
		if err != nil {
			fmt.Printf("Failed to initialize runtime: %v\n", err)
			os.Exit(1)
		}

		absWorkspace, _ := filepath.Abs(workspacePath)
		absSpec, _ := filepath.Abs(specPath)
		absOut, _ := filepath.Abs(outDir)
		var absContext string
		if contextPath != "" {
			absContext, _ = filepath.Abs(contextPath)
		}

		// Ensure out dir exists
		os.MkdirAll(absOut, 0755)

		// Collect Env Vars
		envVars := make(map[string]string)

		// 1. Automatic Secret Injection (v0.1: Anthropic Key & URL)
		if key := os.Getenv("ANTHROPIC_API_KEY"); key != "" {
			envVars["ANTHROPIC_API_KEY"] = key
			envVars["ANTHROPIC_AUTH_TOKEN"] = key
		}
		// Support both ANTHROPIC_BASE_URL (new) and ANTHROPIC_API_URL (alias for convenience)
		if url := os.Getenv("ANTHROPIC_BASE_URL"); url != "" {
			envVars["ANTHROPIC_BASE_URL"] = url
		} else if url := os.Getenv("ANTHROPIC_API_URL"); url != "" {
			envVars["ANTHROPIC_BASE_URL"] = url
		}

		// 2. Custom Env Vars from CLI (--env K=V)
		for _, pair := range envVarsList {
			parts := strings.SplitN(pair, "=", 2)
			if len(parts) == 2 {
				envVars[parts[0]] = parts[1]
			}
		}

		cfg := &docker.ContainerConfig{
			BaseImage:    adapterImage,
			AdapterImage: "holon-adapter-claude",
			Workspace:    absWorkspace,
			SpecPath:     absSpec,
			ContextPath:  absContext,
			OutDir:       absOut,
			Env:          envVars,
		}

		fmt.Printf("Running Holon: %s with base image %s\n", specPath, adapterImage)
		if err := rt.RunHolon(ctx, cfg); err != nil {
			fmt.Printf("Execution failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Holon execution completed.")
	},
}

var rootCmd = &cobra.Command{
	Use:   "holon",
	Short: "Holon is a standardized execution unit for AI-driven software engineering.",
}

func init() {
	runCmd.Flags().StringVarP(&specPath, "spec", "s", "", "Path to holon spec file")
	runCmd.Flags().StringVarP(&adapterImage, "image", "i", "golang:1.22", "Docker image for execution (Base toolchain)")
	runCmd.Flags().StringVarP(&workspacePath, "workspace", "w", ".", "Path to workspace")
	runCmd.Flags().StringVarP(&contextPath, "context", "c", "", "Path to context directory")
	runCmd.Flags().StringVarP(&outDir, "out", "o", "./holon-out", "Path to output directory")
	runCmd.Flags().StringSliceVarP(&envVarsList, "env", "e", []string{}, "Environment variables to pass to the container (K=V)")
	rootCmd.AddCommand(runCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
