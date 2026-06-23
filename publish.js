#!/usr/bin/env node

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = __dirname;
const IS_DEV_PUBLISH = process.argv.includes("--dev");
const SOURCE_BRANCH = "master";
const TARGET_BRANCH = IS_DEV_PUBLISH ? "dev-release" : "release";
const REMOTE_NAME = "origin";
const REMOTE_SOURCE_BRANCH = `${REMOTE_NAME}/${SOURCE_BRANCH}`;
const REMOTE_TARGET_BRANCH = `${REMOTE_NAME}/${TARGET_BRANCH}`;

function formatTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getPart = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")} ${getPart("hour")}:${getPart("minute")}:${getPart("second")} +09:00`;
}

function log(message, isError = false) {
  const stream = isError ? process.stderr : process.stdout;
  stream.write(`[publish] ${formatTimestamp()} ${message}\n`);
}

function runCommand(command, args, { capture = false, allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    let stdout = "";
    let stderr = "";

    if (capture) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      const trimmedStdout = stdout.trim();
      const trimmedStderr = stderr.trim();

      if (code === 0 || allowFailure) {
        resolve({
          code,
          stdout: trimmedStdout,
          stderr: trimmedStderr,
        });
        return;
      }

      const details = trimmedStderr || trimmedStdout;
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}${details ? `: ${details}` : ""}`));
    });
  });
}

async function getCurrentBranch() {
  const { stdout } = await runCommand("git", ["rev-parse", "--abbrev-ref", "HEAD"], { capture: true });
  return stdout;
}

async function ensureStartedOnMaster() {
  const currentBranch = await getCurrentBranch();
  if (currentBranch !== SOURCE_BRANCH) {
    throw new Error(`publish.js must be started on ${SOURCE_BRANCH}; current branch is ${currentBranch}`);
  }
}

async function ensureCleanWorktree() {
  const { stdout } = await runCommand("git", ["status", "--porcelain"], { capture: true });
  if (!stdout) {
    return;
  }

  for (const line of stdout.split("\n").map((entry) => entry.trim()).filter(Boolean)) {
    log(`dirty worktree entry: ${line}`, true);
  }

  throw new Error("working tree is dirty; aborting publish");
}

async function ensureRemoteBranch(remoteBranchName, branchName) {
  const remoteRef = await runCommand("git", ["show-ref", "--verify", "--quiet", `refs/remotes/${remoteBranchName}`], {
    allowFailure: true,
  });

  if (remoteRef.code === 0) {
    return;
  }

  log(`remote ref ${remoteBranchName} is missing locally, fetching it first`);
  await runCommand("git", ["fetch", REMOTE_NAME, branchName]);

  const verified = await runCommand("git", ["show-ref", "--verify", "--quiet", `refs/remotes/${remoteBranchName}`], {
    allowFailure: true,
  });

  if (verified.code !== 0) {
    throw new Error(`remote branch ${remoteBranchName} does not exist`);
  }
}

async function ensureTrackingBranch(branchName, remoteBranchName) {
  await ensureRemoteBranch(remoteBranchName, branchName);

  const localBranch = await runCommand("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], {
    allowFailure: true,
  });

  if (localBranch.code !== 0) {
    log(`creating local ${branchName} branch and tracking ${remoteBranchName}`);
    await runCommand("git", ["checkout", "-b", branchName, "--track", remoteBranchName]);
  } else {
    const currentBranch = await getCurrentBranch();
    if (currentBranch !== branchName) {
      log(`switching branch from ${currentBranch} to ${branchName}`);
      await runCommand("git", ["checkout", branchName]);
    }
  }

  const { stdout: upstream } = await runCommand(
    "git",
    ["for-each-ref", `refs/heads/${branchName}`, "--format=%(upstream:short)"],
    { capture: true },
  );

  if (upstream !== remoteBranchName) {
    log(`setting ${branchName} to track ${remoteBranchName}`);
    await runCommand("git", ["branch", "--set-upstream-to", remoteBranchName, branchName]);
  }
}

async function fastForwardCurrentBranch(branchName) {
  log(`updating ${branchName} from origin`);
  await runCommand("git", ["pull", "--ff-only", REMOTE_NAME, branchName]);
}

async function isMergeInProgress() {
  const mergeStatus = await runCommand("git", ["rev-parse", "-q", "--verify", "MERGE_HEAD"], {
    allowFailure: true,
    capture: true,
  });

  return mergeStatus.code === 0;
}

async function main() {
  let shouldReturnToMaster = false;

  try {
    log(`starting publish from ${SOURCE_BRANCH} to ${TARGET_BRANCH}`);
    await ensureStartedOnMaster();
    await ensureCleanWorktree();

    log("fetching latest refs from origin");
    await runCommand("git", ["fetch", REMOTE_NAME, SOURCE_BRANCH, TARGET_BRANCH]);

    await ensureTrackingBranch(SOURCE_BRANCH, REMOTE_SOURCE_BRANCH);
    await fastForwardCurrentBranch(SOURCE_BRANCH);

    await ensureTrackingBranch(TARGET_BRANCH, REMOTE_TARGET_BRANCH);
    shouldReturnToMaster = true;
    await fastForwardCurrentBranch(TARGET_BRANCH);

    log(`merging ${SOURCE_BRANCH} into ${TARGET_BRANCH}`);
    await runCommand("git", ["merge", "--no-ff", "--no-edit", SOURCE_BRANCH]);

    log(`pushing ${TARGET_BRANCH} to ${REMOTE_TARGET_BRANCH}`);
    await runCommand("git", ["push", REMOTE_NAME, TARGET_BRANCH]);

    await runCommand("git", ["checkout", SOURCE_BRANCH]);
    shouldReturnToMaster = false;
    log(`publish completed successfully for ${TARGET_BRANCH}`);
  } catch (error) {
    log(`publish failed: ${error.message}`, true);

    if (await isMergeInProgress().catch(() => false)) {
      try {
        log("merge conflict detected, aborting merge", true);
        await runCommand("git", ["merge", "--abort"]);
      } catch (abortError) {
        log(`merge abort failed: ${abortError.message}`, true);
      }
    }

    if (shouldReturnToMaster) {
      try {
        const currentBranch = await getCurrentBranch();
        if (currentBranch !== SOURCE_BRANCH) {
          log(`returning to ${SOURCE_BRANCH}`, true);
          await runCommand("git", ["checkout", SOURCE_BRANCH]);
        }
      } catch (checkoutError) {
        log(`failed to switch back to ${SOURCE_BRANCH}: ${checkoutError.message}`, true);
      }
    }

    process.exitCode = 1;
  }
}

main();
