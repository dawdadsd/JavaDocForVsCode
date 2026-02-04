/**
 * GitService.ts - Git 信息服务
 *
 * 提供 Git blame 信息查询功能，用于获取代码作者和修改时间
 */
/**
 * Git Blame 信息
 */
export interface GitBlameInfo {
    readonly author: string;
    readonly email: string;
    readonly date: string;
    readonly commitHash: string;
}
/**
 * 类级别的 Git 信息
 */
export interface ClassGitInfo {
    readonly author: string;
    readonly lastModifier: string;
    readonly lastModifyDate: string;
}
/**
 * Git 服务类
 */
export declare class GitService {
    private cache;
    private cacheTimeout;
    /**
     * 获取指定行的 Git blame 信息
     */
    getBlameForLine(filePath: string, line: number): Promise<GitBlameInfo | null>;
    /**
     * 获取类的 Git 信息（原始作者 + 最后修改者）
     */
    getClassGitInfo(filePath: string, classLine: number): Promise<ClassGitInfo | null>;
    /**
     * 批量获取多行的 blame 信息（更高效）
     */
    getBlameForLines(filePath: string, lines: number[]): Promise<Map<number, GitBlameInfo>>;
    /**
     * 解析 git blame --porcelain 输出
     */
    private parseBlameOutput;
    /**
     * 检查当前目录是否是 Git 仓库
     */
    isGitRepository(filePath: string): Promise<boolean>;
    /**
     * 清除缓存
     */
    clearCache(): void;
}
export declare const gitService: GitService;
