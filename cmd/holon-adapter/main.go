package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/jolestar/holon/pkg/agent"
	"github.com/jolestar/holon/pkg/agent/llm"
	v1 "github.com/jolestar/holon/pkg/api/v1"
	"gopkg.in/yaml.v3"
)

func main() {
	fmt.Println("Holon Adapter v0.1")
	if len(os.Args) < 2 {
		fmt.Println("Usage: holon-adapter run <spec.yaml>")
		os.Exit(1)
	}

	command := os.Args[1]
	if command != "run" {
		fmt.Printf("Unknown command: %s\n", command)
		os.Exit(1)
	}

	fmt.Println("Adapter starting execution loop...")

	// 1. Read Spec
	specData, err := os.ReadFile("/holon/input/spec.yaml")
	if err != nil {
		fmt.Printf("Failed to read spec: %v\n", err)
		os.Exit(1)
	}

	var spec v1.HolonSpec
	if err := yaml.Unmarshal(specData, &spec); err != nil {
		fmt.Printf("Failed to unmarshal spec: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Spec loaded: %s\n", spec.Metadata.Name)

	// 2. Initialize Agent
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		fmt.Println("Error: ANTHROPIC_API_KEY environment variable is not set")
		os.Exit(1)
	}

	provider := llm.NewAnthropicClient(apiKey, "")
	a := agent.NewAgent(provider, &spec)
	ctx := context.Background()

	// 3. Execution
	manifest, err := a.Run(ctx)
	if err != nil {
		fmt.Printf("Agent execution failed: %v\n", err)
		os.Exit(1)
	}

	// 4. Write Manifest
	manifestData, _ := json.MarshalIndent(manifest, "", "  ")
	err = os.WriteFile("/holon/output/manifest.json", manifestData, 0644)
	if err != nil {
		fmt.Printf("Failed to write manifest: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Execution finished successfully.")
}
