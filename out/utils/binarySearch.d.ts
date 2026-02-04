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
export declare function binarySearchMethod(methods: readonly MethodDoc[], cursorLine: LineNumber): MethodDoc | null;
