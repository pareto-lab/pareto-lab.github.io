#!/usr/bin/env node

import { spawn } from "child_process";
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import http from "http";
import https from "https";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_DEV_DEPLOY = process.argv.includes("--dev");
const BASE_URL = IS_DEV_DEPLOY ? "http://127.0.0.1:31080" : "http://127.0.0.1:30080";
const DEPLOY_ENV = IS_DEV_DEPLOY ? "dev" : "prod";
const PROJECT_ROOT = __dirname;
const RELEASE_BRANCH = IS_DEV_DEPLOY ? "dev-release" : "release";
const LOG_FILE_NAME = IS_DEV_DEPLOY ? "houseinus-release-dev.log" : "houseinus-release.log";
const REMOTE_NAME = "origin";
const REMOTE_BRANCH = `${REMOTE_NAME}/${RELEASE_BRANCH}`;
const TELEGRAM_BOT_TOKEN = "8705331578:AAFvjGr8nU8k4DU4pG3MUzeqcdfh4iLVBug";
const TELEGRAM_CHAT_ID_JEONGMIN = "8549321834";
const TELEGRAM_CHAT_ID_YEIBEEN = "8692181457";
const TELEGRAM_RECIPIENTS = [
  { name: "Jeongmin", chatId: TELEGRAM_CHAT_ID_JEONGMIN },
  { name: "Yeibeen", chatId: TELEGRAM_CHAT_ID_YEIBEEN },
];
const LOG_FILE = path.join(PROJECT_ROOT, LOG_FILE_NAME);
const LOCK_FILE = path.join(PROJECT_ROOT, ".release.lock");
const DIST_DIR = path.join(PROJECT_ROOT, "dist");
const PRE_DIST_DIR = path.join(PROJECT_ROOT, "pre-dist");
const FAILED_DIST_DIR = path.join(PROJECT_ROOT, "pre-dist.failed");
const BACKUP_DIST_DIR = path.join(PROJECT_ROOT, "dist.rollback");
const LOG_FILE_MAX_BYTES = 10 * 1024 * 1024;
const LOG_FILE_BACKUP_COUNT = 5;
const LOCK_STALE_MS = 15 * 60 * 1000;
const HEALTHCHECK_TIMEOUT_MS = 10_000;
const HEALTHCHECK_RETRIES = 10;
const HEALTHCHECK_INTERVAL_MS = 3_000;
const TELEGRAM_TIMEOUT_MS = 10_000;
const TELEGRAM_RETRY_COUNT = 3;
const TELEGRAM_RETRY_DELAY_MS = 2_000;

let lockHandle = null;

function formatLogTimestamp(date = new Date()) {
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

function emitConsoleLine(line, isError = false) {
  const stream = isError ? process.stderr : process.stdout;

  if (stream.isTTY) {
    stream.write(`${line}\n`);
  }
}

function emitLoggingFailure(message) {
  process.stderr.write(`${message}\n`);
}

function rotateLogFileIfNeeded(nextLine) {
  try {
    if (!fsSync.existsSync(LOG_FILE)) {
      return;
    }

    const nextBytes = Buffer.byteLength(`${nextLine}\n`);
    const currentBytes = fsSync.statSync(LOG_FILE).size;

    if (currentBytes + nextBytes < LOG_FILE_MAX_BYTES) {
      return;
    }

    const oldestBackup = `${LOG_FILE}.${LOG_FILE_BACKUP_COUNT}`;
    if (fsSync.existsSync(oldestBackup)) {
      fsSync.rmSync(oldestBackup, { force: true });
    }

    for (let index = LOG_FILE_BACKUP_COUNT - 1; index >= 1; index -= 1) {
      const source = `${LOG_FILE}.${index}`;
      const target = `${LOG_FILE}.${index + 1}`;

      if (fsSync.existsSync(source)) {
        fsSync.renameSync(source, target);
      }
    }

    fsSync.renameSync(LOG_FILE, `${LOG_FILE}.1`);
  } catch (error) {
    emitLoggingFailure(`[release] ${formatLogTimestamp()} failed to rotate ${LOG_FILE_NAME}: ${error.message}`);
  }
}

function writeLog(message, { isError = false } = {}) {
  const line = `[release] ${formatLogTimestamp()} ${message}`;

  try {
    rotateLogFileIfNeeded(line);
    fsSync.appendFileSync(LOG_FILE, `${line}\n`, "utf8");
  } catch (error) {
    emitLoggingFailure(`[release] ${formatLogTimestamp()} failed to write ${LOG_FILE_NAME}: ${error.message}`);
  }

  emitConsoleLine(line, isError);
}

function log(message) {
  writeLog(message);
}

function logError(message) {
  writeLog(message, { isError: true });
}

function handleStreamOutput(stream, { capture = false, isError = false } = {}) {
  return new Promise((resolve) => {
    let captured = "";
    let pending = "";

    stream.on("data", (chunk) => {
      const text = chunk.toString();

      if (capture) {
        captured += text;
        return;
      }

      pending += text.replace(/\r/g, "\n");
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";

      for (const line of lines) {
        if (!line) {
          continue;
        }

        if (isError) {
          logError(line);
        } else {
          log(line);
        }
      }
    });

    stream.on("end", () => {
      if (!capture && pending) {
        if (isError) {
          logError(pending);
        } else {
          log(pending);
        }
      }

      resolve(capture ? captured : "");
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortenText(text, maxLength = 400) {
  const normalized = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function shortSha(sha) {
  return sha ? sha.slice(0, 7) : "unknown";
}

function parseJsonSafely(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function formatErrorDetails(error) {
  if (error instanceof Error) {
    const code = typeof error.code === "string" ? ` code=${error.code}` : "";
    const message = error.message ? ` message=${error.message}` : "";
    const cause =
      error.cause instanceof Error
        ? ` cause=${causeToString(error.cause)}`
        : error.cause
          ? ` cause=${shortenText(String(error.cause), 200)}`
          : "";

    return `${error.name}${code}${message}${cause}`.trim();
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    return shortenText(JSON.stringify(error), 200);
  }

  return String(error);
}

function causeToString(error) {
  if (error instanceof Error) {
    return `${error.name}${error.message ? `: ${error.message}` : ""}`;
  }

  return shortenText(String(error), 200);
}

function isRetryableTelegramError(error) {
  const retryableCodes = new Set([
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNABORTED",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "EAI_AGAIN",
    "ENOTFOUND",
  ]);

  if (error instanceof AggregateError) {
    if (typeof error.code === "string" && retryableCodes.has(error.code)) {
      return true;
    }

    return error.errors.some((nestedError) => isRetryableTelegramError(nestedError));
  }

  if (error instanceof Error) {
    if (typeof error.code === "string" && retryableCodes.has(error.code)) {
      return true;
    }

    if (/timed?\s*out|timeout/i.test(error.message)) {
      return true;
    }

    if (error.cause) {
      return isRetryableTelegramError(error.cause);
    }
  }

  return false;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "EPERM") {
      return true;
    }
    return false;
  }
}

function runCommand(command, args, { cwd = PROJECT_ROOT, env = {}, capture = false, allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutPromise = handleStreamOutput(child.stdout, { capture });
    const stderrPromise = handleStreamOutput(child.stderr, { capture, isError: true });

    child.on("error", reject);
    child.on("close", async (code) => {
      const stdout = (await stdoutPromise).trim();
      const stderr = (await stderrPromise).trim();

      if (code === 0 || allowFailure) {
        resolve({ code, stdout, stderr });
        return;
      }

      const details = stderr || stdout;
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}${details ? `: ${details}` : ""}`));
    });
  });
}

async function releaseLock() {
  if (lockHandle) {
    try {
      await lockHandle.close();
    } catch {
      // Ignore cleanup errors here and try to unlink below.
    }
    lockHandle = null;
  }

  try {
    await fs.unlink(LOCK_FILE);
  } catch (error) {
    if (error.code !== "ENOENT") {
      log(`lock cleanup warning: ${error.message}`);
    }
  }
}

async function acquireLock() {
  while (true) {
    try {
      lockHandle = await fs.open(LOCK_FILE, "wx");
      await lockHandle.writeFile(
        JSON.stringify(
          {
            pid: process.pid,
            startedAt: new Date().toISOString(),
            branch: RELEASE_BRANCH,
          },
          null,
          2,
        ),
      );
      return true;
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }

      const stats = await fs.stat(LOCK_FILE).catch(() => null);
      const ageMs = stats ? Date.now() - stats.mtimeMs : 0;

      let lockData = null;
      try {
        const raw = await fs.readFile(LOCK_FILE, "utf8");
        lockData = raw ? JSON.parse(raw) : null;
      } catch {
        lockData = null;
      }

      if (lockData?.pid && isProcessAlive(lockData.pid)) {
        log(`another deploy is already running (pid: ${lockData.pid}), skipping`);
        return false;
      }

      if (!lockData && stats && ageMs < LOCK_STALE_MS) {
        log("found a fresh but unreadable deploy lock, skipping");
        return false;
      }

      log("found a stale deploy lock, removing it");
      await fs.unlink(LOCK_FILE).catch(() => {});
    }
  }
}

async function cleanupArtifacts() {
  await fs.rm(PRE_DIST_DIR, { recursive: true, force: true });
  await fs.rm(FAILED_DIST_DIR, { recursive: true, force: true });
}

async function ensureCleanWorktree() {
  const { stdout } = await runCommand("git", ["status", "--porcelain"], { capture: true });
  if (stdout) {
    for (const line of stdout.split("\n").map((entry) => entry.trim()).filter(Boolean)) {
      log(`dirty worktree entry: ${line}`);
    }
    throw new Error("working tree is dirty; aborting automated release to avoid overwriting local changes");
  }
}

async function ensureRemoteReleaseRef() {
  const remoteRef = await runCommand("git", ["show-ref", "--verify", "--quiet", `refs/remotes/${REMOTE_BRANCH}`], {
    allowFailure: true,
  });

  if (remoteRef.code === 0) {
    return;
  }

  log(`remote ref ${REMOTE_BRANCH} is missing locally, fetching it first`);
  await runCommand("git", ["fetch", REMOTE_NAME, RELEASE_BRANCH]);

  const verified = await runCommand("git", ["show-ref", "--verify", "--quiet", `refs/remotes/${REMOTE_BRANCH}`], {
    allowFailure: true,
  });

  if (verified.code !== 0) {
    throw new Error(`remote branch ${REMOTE_BRANCH} does not exist`);
  }
}

async function ensureReleaseBranchTracking() {
  await ensureRemoteReleaseRef();

  const localBranch = await runCommand("git", ["show-ref", "--verify", "--quiet", `refs/heads/${RELEASE_BRANCH}`], {
    allowFailure: true,
  });

  if (localBranch.code !== 0) {
    log(`creating local ${RELEASE_BRANCH} branch and tracking ${REMOTE_BRANCH}`);
    await runCommand("git", ["checkout", "-b", RELEASE_BRANCH, "--track", REMOTE_BRANCH]);
  } else {
    const { stdout: currentBranch } = await runCommand("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      capture: true,
    });

    if (currentBranch !== RELEASE_BRANCH) {
      log(`switching branch from ${currentBranch} to ${RELEASE_BRANCH}`);
      await runCommand("git", ["checkout", RELEASE_BRANCH]);
    }
  }

  const { stdout: upstream } = await runCommand(
    "git",
    ["for-each-ref", `refs/heads/${RELEASE_BRANCH}`, "--format=%(upstream:short)"],
    { capture: true },
  );

  if (upstream !== REMOTE_BRANCH) {
    log(`setting ${RELEASE_BRANCH} to track ${REMOTE_BRANCH}`);
    await runCommand("git", ["branch", "--set-upstream-to", REMOTE_BRANCH, RELEASE_BRANCH]);
  }
}

async function fetchLatestRelease() {
  log(`fetching latest commits from ${REMOTE_BRANCH}`);
  await runCommand("git", ["fetch", REMOTE_NAME, RELEASE_BRANCH]);
}

async function getRevisionState() {
  const { stdout } = await runCommand(
    "git",
    ["rev-list", "--left-right", "--count", `${RELEASE_BRANCH}...${REMOTE_BRANCH}`],
    { capture: true },
  );

  const [aheadRaw = "0", behindRaw = "0"] = stdout.split(/\s+/);
  return {
    ahead: Number.parseInt(aheadRaw, 10) || 0,
    behind: Number.parseInt(behindRaw, 10) || 0,
  };
}

async function getHeadSha() {
  const { stdout } = await runCommand("git", ["rev-parse", "HEAD"], { capture: true });
  return stdout;
}

async function buildIntoPreDist() {
  await cleanupArtifacts();
  log("installing dependencies");
  await runCommand("npm", ["install"]);
  log("building release into pre-dist");
  await runCommand("npm", ["run", "build", "--", "--outDir", "pre-dist"]);
}

async function swapDist() {
  const distExists = await pathExists(DIST_DIR);

  await fs.rm(BACKUP_DIST_DIR, { recursive: true, force: true });
  await fs.rm(FAILED_DIST_DIR, { recursive: true, force: true });

  try {
    if (distExists) {
      await fs.rename(DIST_DIR, BACKUP_DIST_DIR);
    }

    await fs.rename(PRE_DIST_DIR, DIST_DIR);
    return distExists;
  } catch (error) {
    if (distExists && !(await pathExists(DIST_DIR)) && (await pathExists(BACKUP_DIST_DIR))) {
      await fs.rename(BACKUP_DIST_DIR, DIST_DIR);
    }

    throw error;
  }
}

function requestUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const request = client.request(
      parsedUrl,
      {
        method: "GET",
        timeout: HEALTHCHECK_TIMEOUT_MS,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("health check timed out"));
    });

    request.on("error", reject);
    request.end();
  });
}

function postJson(
  targetUrl,
  payload,
  { timeout = TELEGRAM_TIMEOUT_MS, lookup = undefined, family = undefined, autoSelectFamily = undefined } = {},
) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const client = parsedUrl.protocol === "https:" ? https : http;
    const body = JSON.stringify(payload);

    const request = client.request(
      parsedUrl,
      {
        method: "POST",
        timeout,
        lookup,
        family,
        autoSelectFamily,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (response) => {
        let responseBody = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: responseBody,
          });
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("request timed out"));
    });

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

async function sendTelegramMessage(chatId, text) {
  const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  let lastError = null;

  for (let attempt = 1; attempt <= TELEGRAM_RETRY_COUNT; attempt += 1) {
    try {
      const response = await postJson(
        telegramUrl,
        {
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        },
        { family: 4, autoSelectFamily: false },
      );
      const parsedBody = parseJsonSafely(response.body);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`telegram sendMessage returned ${response.statusCode}: ${shortenText(response.body, 200)}`);
      }

      if (!parsedBody?.ok) {
        throw new Error(
          `telegram sendMessage returned ok=false (${response.statusCode}): ${shortenText(parsedBody?.description ?? response.body, 200)}`,
        );
      }

      return;
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < TELEGRAM_RETRY_COUNT && isRetryableTelegramError(error);

      if (!shouldRetry) {
        throw error;
      }

      log(`telegram send attempt ${attempt}/${TELEGRAM_RETRY_COUNT} failed, retrying: ${formatErrorDetails(error)}`);
      await sleep(TELEGRAM_RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

async function notifyTelegramRecipients(text) {
  for (const recipient of TELEGRAM_RECIPIENTS) {
    try {
      await sendTelegramMessage(recipient.chatId, text);
      log(`telegram notification sent to ${recipient.name}`);
    } catch (error) {
      log(`telegram notification failed for ${recipient.name}: ${formatErrorDetails(error)}`);
    }
  }
}

function buildReleaseNotification({
  success,
  commitCount,
  previousHead,
  currentHead,
  errorMessage,
  rollbackStatus,
}) {
  const lines = [
    `[houseinus-web] release ${success ? "success" : "failed"}`,
    `env: ${DEPLOY_ENV}`,
    `branch: ${RELEASE_BRANCH}`,
    `commits: ${commitCount}`,
    `url: ${BASE_URL}`,
    `time: ${formatLogTimestamp()}`,
  ];

  if (previousHead) {
    lines.push(`from: ${shortSha(previousHead)}`);
  }

  if (currentHead) {
    lines.push(`to: ${shortSha(currentHead)}`);
  }

  if (!success && rollbackStatus) {
    lines.push(`rollback: ${rollbackStatus}`);
  }

  if (!success && errorMessage) {
    lines.push(`error: ${shortenText(errorMessage)}`);
  }

  return lines.join("\n");
}

async function waitForHealthyService() {
  for (let attempt = 1; attempt <= HEALTHCHECK_RETRIES; attempt += 1) {
    try {
      const statusCode = await requestUrl(BASE_URL);
      if (statusCode >= 200 && statusCode < 500) {
        log(`health check passed with status ${statusCode}`);
        return;
      }

      log(`health check attempt ${attempt}/${HEALTHCHECK_RETRIES} returned ${statusCode}`);
    } catch (error) {
      log(`health check attempt ${attempt}/${HEALTHCHECK_RETRIES} failed: ${error.message}`);
    }

    if (attempt < HEALTHCHECK_RETRIES) {
      await sleep(HEALTHCHECK_INTERVAL_MS);
    }
  }

  throw new Error(`service health check failed for ${BASE_URL}`);
}

async function restoreDistFromBackup() {
  if (!(await pathExists(BACKUP_DIST_DIR))) {
    return false;
  }

  await fs.rm(FAILED_DIST_DIR, { recursive: true, force: true });

  if (await pathExists(DIST_DIR)) {
    await fs.rename(DIST_DIR, FAILED_DIST_DIR);
  }

  await fs.rename(BACKUP_DIST_DIR, DIST_DIR);
  await fs.rm(FAILED_DIST_DIR, { recursive: true, force: true });
  return true;
}

async function rollbackCode(previousHead) {
  log(`rolling back git state to ${previousHead}`);
  await runCommand("git", ["reset", "--hard", previousHead]);
  log("reinstalling dependencies for rolled back revision");
  await runCommand("npm", ["install"]);
}

async function rebuildRolledBackDist() {
  log("rebuilding dist for rolled back revision");
  await cleanupArtifacts();
  await runCommand("npm", ["run", "build", "--", "--outDir", "pre-dist"]);
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.rename(PRE_DIST_DIR, DIST_DIR);
}

async function normalizeWorktree() {
  await runCommand("git", ["reset", "--hard", "HEAD"]);
  await cleanupArtifacts();
  await fs.rm(BACKUP_DIST_DIR, { recursive: true, force: true });
}

async function main() {
  const locked = await acquireLock();
  if (!locked) {
    return;
  }

  let previousHead = null;
  let currentHead = null;
  let pulledNewRelease = false;
  let distSwapped = false;
  let backupDistExists = false;
  let commitCount = 0;
  let rollbackStatus = "not needed";

  try {
    log(`starting deploy for ${RELEASE_BRANCH}`);
    await cleanupArtifacts();
    await ensureCleanWorktree();
    await ensureReleaseBranchTracking();
    await fetchLatestRelease();

    const { ahead, behind } = await getRevisionState();
    commitCount = behind;
    if (ahead > 0 && behind > 0) {
      throw new Error(`${RELEASE_BRANCH} has diverged from ${REMOTE_BRANCH}; manual intervention is required`);
    }

    if (ahead > 0) {
      throw new Error(`${RELEASE_BRANCH} is ahead of ${REMOTE_BRANCH}; automated deploy aborted`);
    }

    if (behind === 0) {
      log("no new commits on origin/release, skipping deploy");
      return;
    }

    previousHead = await getHeadSha();
    log(`${behind} new commit(s) detected, starting deploy`);

    await runCommand("git", ["pull", "--ff-only", REMOTE_NAME, RELEASE_BRANCH]);
    pulledNewRelease = true;

    await buildIntoPreDist();
    backupDistExists = await swapDist();
    distSwapped = true;

    await waitForHealthyService();
    await normalizeWorktree();
    currentHead = await getHeadSha();
    log("release deploy completed successfully");

    await notifyTelegramRecipients(
      buildReleaseNotification({
        success: true,
        commitCount,
        previousHead,
        currentHead,
      }),
    );
  } catch (error) {
    log(`deploy failed: ${error.message}`);

    if (distSwapped) {
      try {
        const restored = await restoreDistFromBackup();
        if (restored) {
          log("restored previous dist directory");
        }
      } catch (restoreError) {
        log(`dist restore failed: ${restoreError.message}`);
      }
    }

    if (pulledNewRelease && previousHead) {
      try {
        rollbackStatus = "started";
        await rollbackCode(previousHead);
        rollbackStatus = "completed";

        if (distSwapped && !backupDistExists) {
          await rebuildRolledBackDist();
        }
      } catch (rollbackError) {
        rollbackStatus = `failed (${shortenText(rollbackError.message, 120)})`;
        log(`rollback failed: ${rollbackError.message}`);
      }
    }

    if (commitCount > 0) {
      await notifyTelegramRecipients(
        buildReleaseNotification({
          success: false,
          commitCount,
          previousHead,
          currentHead,
          errorMessage: error.message,
          rollbackStatus,
        }),
      );
    }

    throw error;
  } finally {
    await cleanupArtifacts();
    await fs.rm(BACKUP_DIST_DIR, { recursive: true, force: true });
    await releaseLock();
  }
}

main().catch((error) => {
  logError(error.message);
  process.exitCode = 1;
});
