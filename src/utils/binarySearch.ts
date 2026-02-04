/**
 * binarySearch.ts - 二分查找工具
 *
 * 【为什么用二分查找？】
 * 场景：用户光标在第 150 行，我们要找出光标在哪个方法内
 * 方法列表按 startLine 排序：[10, 30, 80, 120, 200, ...]
 *
 * 线性查找：从头遍历，最坏情况 O(n)
 * 二分查找：每次排除一半，O(log n)
 *
 * 当文件有 200 个方法时：
 * - 线性查找最多比较 200 次
 * - 二分查找最多比较 8 次（log₂200 ≈ 7.6）
 */

import type { MethodDoc, LineNumber } from '../types.js';

/**
 * 二分查找：找到光标所在的方法
 *
 * 【算法思路】
 * 1. 找到最后一个 startLine <= cursorLine 的方法（候选方法）
 * 2. 验证 cursorLine <= endLine（确认光标确实在方法范围内）
 *
 * @param methods - 方法列表，必须按 startLine 升序排列
 * @param cursorLine - 当前光标所在行
 * @returns 匹配的方法，或 null（光标不在任何方法内）
 *
 * @example
 * // 假设有方法：
 * // methodA: startLine=10, endLine=30
 * // methodB: startLine=40, endLine=60
 *
 * binarySearchMethod(methods, 20);  // 返回 methodA（20 在 10-30 之间）
 * binarySearchMethod(methods, 35);  // 返回 null（35 不在任何方法内）
 * binarySearchMethod(methods, 50);  // 返回 methodB（50 在 40-60 之间）
 */
export function binarySearchMethod(
  methods: readonly MethodDoc[],
  cursorLine: LineNumber
): MethodDoc | null {
  // 边界情况：空数组直接返回
  if (methods.length === 0) {
    return null;
  }

  // 二分查找的两个指针
  let lo = 0;                    // 左边界
  let hi = methods.length - 1;   // 右边界
  let result: MethodDoc | null = null;  // 候选结果

  // 当搜索范围还有元素时继续
  while (lo <= hi) {
    // 计算中间位置
    // 【为什么用 Math.floor？】
    // (lo + hi) / 2 可能是小数，数组索引必须是整数
    const mid = Math.floor((lo + hi) / 2);

    // 获取中间位置的方法
    // 【为什么要检查 undefined？】
    // 因为 tsconfig 开启了 noUncheckedIndexedAccess
    // 数组访问可能返回 undefined（即使逻辑上不可能）
    const method = methods[mid];
    if (method === undefined) {
      break; // 理论上不会发生，但 TypeScript 需要这个检查
    }

    if (method.startLine <= cursorLine) {
      // 当前方法的起始行 <= 光标行
      // 说明光标可能在这个方法内，或者在更后面的方法内
      result = method;  // 先记录为候选
      lo = mid + 1;     // 继续向右搜索，看看有没有更靠后的方法也满足条件
    } else {
      // 当前方法的起始行 > 光标行
      // 说明目标在左边
      hi = mid - 1;
    }
  }

  // 找到候选后，还需要验证光标是否真的在方法范围内
  // 因为光标可能在两个方法之间的空白区域
  if (result !== null && result.endLine >= cursorLine) {
    return result;
  }

  return null;
}
