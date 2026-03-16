import os
import sys

# Define the root directory (Leo)
root_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, root_dir)

print(f"Checking imports with PYTHONPATH={root_dir}")

files_to_check = []
for root, dirs, files in os.walk(os.path.join(root_dir, "backend")):
    for file in files:
        if file.endswith(".py"):
            files_to_check.append(os.path.join(root, file))

errors = []
for file_path in files_to_check:
    rel_path = os.path.relpath(file_path, root_dir)
    module_path = rel_path.replace(os.path.sep, ".").replace(".py", "")
    
    # Don't try to import if it ends with __init__
    if module_path.endswith(".__init__"):
        module_path = module_path[:-9]
        
    try:
        print(f"Importing {module_path}...", end=" ")
        __import__(module_path)
        print("SUCCESS")
    except Exception as e:
        print(f"FAILED: {e}")
        errors.append((module_path, str(e)))

if errors:
    print("\n--- IMPORT ERRORS FOUND ---")
    for mod, err in errors:
        print(f"{mod}: {err}")
else:
    print("\nNo import errors found!")
