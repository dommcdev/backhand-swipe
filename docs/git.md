# Git Workflow

## 1. Set up feature branch

Before starting on a new feature, make sure your local main is up to date with the remote main:

```bash
git switch main
git pull origin main
```

Then, create a local branch and push it up to our Github repo:

```bash
git switch -c your-feature-branch
git push -u origin your-feature-branch
```

## 2. Work and commit

Run the following commands periodically as you work on your feature to commit your changes. A commit is like a snapshot of your code.

```bash
# Make sure you are on your feature branch (run `git branch` to check)
git add .                               # Adds all files to the "staging area" so they can be committed
git commit -m "description of changes"  # Makes a commit with all the files in the staging area
git push                                # Send your work to your remote branch on GitHub
```

## 3. Finish and open a PR

Once you are finished with your feature, you need to:

- Pull any changes from main into your feature branch and ensure your code still works with those changes applied
- Open a Github pull request (PR) to merge your finished feature branch into the main branch so everyone can use it

```bash
# Pull down the latest changes from remote main
git switch main && git pull

# Bring those changes onto your own branch
git switch your-branch
git rebase main

# Update your remote branch on Github.
git push --force-with-lease

# Open a PR
gh pr create --title "Your PR title" --body "Description of your changes"
# Or go to github.com and use the "Create PR" button.
```
