// lib/io.js — 统一的文件 I/O 和路径解析模块
// 关键改动：消除所有硬编码路径，集中管理

const fs = require("fs");
const path = require("path");
const os = require("os");

// skill 根目录（lib/ 的父目录）
const SKILL_DIR = path.resolve(__dirname, "..");

/**
 * 获取 skill 目录下的路径
 * @param {...string} segments - 路径片段
 */
function skillPath(...segments) {
  return path.join(SKILL_DIR, ...segments);
}

/**
 * 获取 Downloads 目录下的输出路径
 * @param {string} filename - 文件名
 */
function downloadPath(filename) {
  return path.join(os.homedir(), "Downloads", filename);
}

/**
 * 安全读取 JSON 文件
 * @param {string} filePath
 * @returns {object|null}
 */
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

/**
 * 写入 JSON 文件
 * @param {string} filePath
 * @param {object} data
 */
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

/**
 * 确保目录存在，不存在则创建
 * @param {string} dirPath
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 获取 references 目录路径
 */
function refPath(slug) {
  return skillPath("references", slug + "_lines.json");
}

/**
 * 获取 archives 目录路径
 */
function archivePath(slug) {
  return skillPath("archives", slug + "_metro.json");
}

/**
 * 原始AMap polyline缓存路径
 */
function rawCachePath(slug) {
  return skillPath("cache", slug + "_raw_polylines.json");
}

module.exports = { skillPath, downloadPath, readJSON, writeJSON, ensureDir, refPath, archivePath, rawCachePath };
