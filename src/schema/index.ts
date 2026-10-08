/**
 * 领域类型的**唯一来源**。
 *
 * 其余包一律引用本包，不得各自声明领域类型。
 *
 * 本包**不依赖任何框架或运行时环境**——不得引用 React / DOM / Next.js / Node API。
 * 这条约束由 `schema.test.ts` 机械护栏，不靠约定。
 */

/*
 * 显式 `.ts` 扩展名：这几条是**运行时**重导出（`import type` 会被擦除，不受影响）。
 * 显式扩展名让本包可以被裸 Node 直接加载——卡 4 的数据管道（Node 侧）需要它。
 */
export * from "./tune.ts";
export * from "./corpus.ts";
export * from "./rhyme.ts";
export * from "./verdict.ts";
export * from "./storage.ts";
