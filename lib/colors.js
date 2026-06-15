// lib/colors.js — 统一调色板和线路颜色分配
// 关键改动：从 discover_lines.js 提取，集中管理

const PALETTE = [
  "#E60012","#009944","#F39800","#0072BC","#8B2E9E","#00A0E9",
  "#77BB00","#E95295","#FFD400","#006B6B","#B6007E","#00B48D",
  "#F47B20","#003399","#99CC00","#D6004C","#0088CC","#FF6600",
  "#6600CC","#0099CC","#CC0033","#336633","#FF9933","#006699",
  "#993366","#339966","#CC6600","#003366","#996600","#336699"
];

/**
 * 根据线路编号分配颜色
 * @param {number} lineNum - 线路编号（1 起）
 * @returns {string} 十六进制颜色
 */
function getLineColor(lineNum) {
  return PALETTE[(lineNum - 1) % PALETTE.length];
}

/**
 * 获取调色板副本
 * @returns {string[]}
 */
function getPalette() {
  return [...PALETTE];
}

module.exports = { getLineColor, getPalette, PALETTE };
