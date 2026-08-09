# IFMSA KMC — Project Workflow

## Repo
- Remote: https://github.com/Doctanaski/ifmsa-kmc.git
- Branch: `main` (default)

## Pushing after changes
After finishing any change in this project, commit and push automatically:

```powershell
git add -A
git commit -m "<short summary>"
git push origin main
```

Or use the one-liner shortcut `.\push.ps1 -Message "..."` (stages all, commits with the message, pushes to main).

Always verify the push succeeded before reporting done. Warning messages about LF/CRLF are harmless.