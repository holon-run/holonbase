import os
import sys
import yaml
import json
import asyncio
import subprocess
import glob
from datetime import datetime
from pathlib import Path
from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

async def run_adapter():
    print("Holon Claude Adapter Starting...")
    
    # Define output_dir early
    output_dir = "/holon/output"
    os.makedirs(output_dir, exist_ok=True)
    evidence_dir = os.path.join(output_dir, "evidence")
    os.makedirs(evidence_dir, exist_ok=True)
    
    # 1. Load Spec
    spec_path = "/holon/input/spec.yaml"
    if not os.path.exists(spec_path):
        print(f"Error: Spec not found at {spec_path}")
        sys.exit(1)
        
    with open(spec_path, 'r') as f:
        spec = yaml.safe_load(f)
    
    # Handle goal
    goal_val = spec.get('goal', '')
    if isinstance(goal_val, dict):
        goal = goal_val.get('description', '')
    else:
        goal = str(goal_val)
        
    print(f"Task Goal: {goal}")

    # 2. Context Injection
    context_dir = "/holon/input/context"
    context_header = "\n\n### ADDITIONAL CONTEXT\n"
    context_content = ""
    if os.path.exists(context_dir):
        files = glob.glob(os.path.join(context_dir, "*"))
        for file_path in files:
            if os.path.isfile(file_path):
                file_name = os.path.basename(file_path)
                with open(file_path, 'r') as f:
                    content = f.read()
                    context_content += f"\nFile: {file_name}\n---\n{content}\n---\n"
    
    full_prompt = goal
    if context_content:
        full_prompt += context_header + context_content

    # 3. Preflight: Git Baseline
    workspace_path = "/workspace"
    os.chdir(workspace_path)
    
    has_git = os.path.exists(os.path.join(workspace_path, ".git"))
    if not has_git:
        print("No git repo found in workspace. Initializing temporary baseline...")
        subprocess.run(["git", "init"], check=True)
        subprocess.run(["git", "config", "user.name", "holon-adapter"], check=True)
        subprocess.run(["git", "config", "user.email", "adapter@holon.local"], check=True)
        subprocess.run(["git", "add", "-A"], check=True)
        subprocess.run(["git", "commit", "-m", "holon-baseline"], check=True)
    else:
        print("Existing git repo found. Baseline established.")

    # 4. Initialize Claude SDK (Robust)
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not set")
        sys.exit(1)

    client = ClaudeSDKClient(api_key=api_key)
    
    # Options for headless behavior
    options = ClaudeAgentOptions(
        permission_mode="bypassPermissions",
        cwd=workspace_path
    )
    
    start_time = datetime.now()
    log_file_path = os.path.join(evidence_dir, "execution.log")
    
    try:
        print("Connecting to Claude Code...")
        # Start session
        async with client.connect() as session:
            print("Session established. Running query...")
            
            # Simple wrapper to capture everything to evidence
            with open(log_file_path, 'w') as log_file:
                # Run the query
                # Note: client.query() usually returns a Response object
                # We want to capture thinking steps too if possible.
                # In this v0.1 simplified bridge, we'll wait for final response.
                result = await session.query(full_prompt, options=options)
                
                # Write final output to log
                log_file.write(f"--- FINAL OUTPUT ---\n{result}\n")

        print("Claude Code execution finished.")
        
        # 5. Generate Artifacts
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        # Diff Patch
        diff_proc = subprocess.run(["git", "diff", "--patch"], capture_output=True, text=True)
        patch_content = diff_proc.stdout
        
        # Manifest
        manifest = {
            "metadata": {
                "adapter": "claude-code",
                "version": "0.1.0"
            },
            "status": "completed",
            "outcome": "success",
            "duration": duration,
            "artifacts": [
                {"name": "diff.patch", "path": "diff.patch"},
                {"name": "summary.md", "path": "summary.md"},
                {"name": "evidence", "path": "evidence/"}
            ]
        }
        
        # Write Files
        with open(os.path.join(output_dir, "manifest.json"), 'w') as f:
            json.dump(manifest, f, indent=2)
            
        with open(os.path.join(output_dir, "diff.patch"), 'w') as f:
            f.write(patch_content)
            
        with open(os.path.join(output_dir, "summary.md"), 'w') as f:
            f.write(f"# Task Summary\n\nGoal: {goal}\n\nOutcome: Success\n\n## Actions\n{result}\n")

        print(f"Artifacts written to {output_dir}")
        
    except Exception as e:
        print(f"Execution failed: {e}")
        # Write failure manifest
        manifest = {
            "status": "completed",
            "outcome": "failure",
            "error": str(e)
        }
        with open(os.path.join(output_dir, "manifest.json"), 'w') as f:
            json.dump(manifest, f, indent=2)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_adapter())
